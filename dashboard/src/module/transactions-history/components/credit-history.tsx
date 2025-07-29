"use client";
import { APP_TABS, cn, formatDataBytes } from "@/lib/utils";
import { useOverview } from "@/providers/OverviewProvider";
import HistoryService from "@/services/history";
import { CreditRequest } from "@/services/history/response";
import { SignedIn, SignInButton } from "@clerk/clerk-react";
import { SignedOut } from "@clerk/nextjs";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/button";
import DynamicTable from "@/components/data-table";
import Label from "@/components/label";
import { Text } from "@/components/text";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "./empty-state";

const CreditHistory = ({ token }: { token?: string }) => {
  const [historyList, setHistoryList] = useState<CreditRequest[]>();
  const [loading, setLoading] = useState(true);
  const { setMainTabSelected } = useOverview();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await HistoryService.getCreditHistory({
        token: token!,
      });
      console.log("Credit history response:", response); // Debug: Check actual API response structure
      // const processedHistory = response?.data?.filter(
      //   (credit: any) => credit?.request_status === "Processed"
      // );
      setHistoryList(response?.data ?? []);
    } catch (error) {
      console.log(error);
      setHistoryList([]);
    } finally {
      setLoading(false);
    }
  };

  const chainList: Record<string, { logo: string; name: string; tokens: Array<{ name: string; logo: string }> }> = useMemo(
    () => ({
      "11155111": {
        logo: "/currency/eth.png",
        name: "Ethereum",
        tokens: [
          { name: "ETH", logo: "/currency/eth.png" },
          { name: "AVAIL", logo: "/avail-icon.svg" }
        ]
      },
      "1": {
        logo: "/currency/eth.png",
        name: "Ethereum",
        tokens: [
          { name: "ETH", logo: "/currency/eth.png" },
          { name: "AVAIL", logo: "/avail-icon.svg" }
        ]
      },
      "0": {
        logo: "/avail-icon.svg",
        name: "Avail",
        tokens: [
          { name: "AVAIL", logo: "/avail-icon.svg" }
        ]
      },
    }),
    []
  );

  const displayValues = useCallback(
    (heading: string, value: any) => {
      switch (heading) {
        case "created_at":
          return new Date(value).toLocaleDateString().replaceAll("/", "-");
        case "request_status":
          // Map the API status to Label component status
          let labelStatus: "pending" | "complete" | "cancelled";
          switch (value?.toLowerCase()) {
            case "completed":
            case "success":
              labelStatus = "complete";
              break;
            case "pending":
              labelStatus = "pending";
              break;
            case "failed":
            case "cancelled":
              labelStatus = "cancelled";
              break;
            default:
              labelStatus = "pending";
          }
          return <Label status={labelStatus} />;
        case "amount_credit":
          return value ? `${Number(value).toLocaleString()} Credits` : "-";
        case "amount_paid":
          return value === "-" ? <Text variant={"light-grey"} size={"sm"}>-</Text> : 
                 value === "Amount from blockchain" ? <Text variant={"light-grey"} size={"sm"}>View on Explorer</Text> : 
                 value;
        case "chain_id":
          const chainInfo = chainList[value];
          if (!chainInfo) {
            return <Text variant={"light-grey"} weight={"semibold"} size={"sm"}>Unknown Chain</Text>;
          }
          return (
            <div className="flex items-center gap-x-2">
              <Image
                src={chainInfo.logo}
                alt={chainInfo.name}
                width={20}
                height={20}
              />
              <Text variant={"light-grey"} weight={"semibold"} size={"sm"}>
                {chainInfo.name}
              </Text>
            </div>
          );
        case "token_used":
          const chainData = chainList[value];
          if (!chainData) {
            return <Text variant={"light-grey"} weight={"semibold"} size={"sm"}>Unknown Token</Text>;
          }
          
          // Determine token based on chain:
          // - Avail chain (0): Always AVAIL token
          // - Ethereum chains (1, 11155111): Default to AVAIL token (most common in this app)
          let selectedToken;
          if (value === "0") {
            // Avail chain - native AVAIL
            selectedToken = chainData.tokens[0]; // AVAIL
          } else {
            // Ethereum chains - assume AVAIL ERC20 token (most common use case)
            selectedToken = chainData.tokens.find(token => token.name === "AVAIL") || chainData.tokens[0];
          }
          
          return (
            <div className="flex items-center gap-x-2">
              <Image
                src={selectedToken.logo}
                alt={selectedToken.name}
                width={20}
                height={20}
              />
              <Text variant={"light-grey"} weight={"semibold"} size={"sm"}>
                {selectedToken.name}
              </Text>
            </div>
          );
        default:
          return value ?? "-";
      }
    },
    [chainList]
  );

  return (
    <>
      <div className="h-px bg-[#2B4761]" />
      {!loading && !historyList?.length ? (
        <EmptyState
          message="Your Credit History Would Be Shown Here"
          cta={
            <>
              <SignedOut>
                <SignInButton mode="modal" component="div">
                  <Button className="w-[195px]">Sign In</Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Button
                  className="w-[195px]"
                  onClick={() => {
                    setMainTabSelected(APP_TABS.OVERVIEW);
                  }}
                >
                  Buy Credits
                </Button>
              </SignedIn>
            </>
          }
        />
      ) : null}
      {loading ? (
        <div className="flex flex-col gap-y-4 mt-4">
          <Skeleton />
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : historyList?.length ? (
        <DynamicTable
          headings={[
            { key: "created_at", label: "Purchasing Date" },
            { key: "request_status", label: "Status" },
            { key: "request_type", label: "Type" },
            { key: "chain_id", label: "Chain" },
            { key: "token_used", label: "Token" },
            { key: "amount_paid", label: "Amount Paid" },
            { key: "amount_credit", label: "Credit Received" },
          ]}
          listdata={historyList.map(item => ({
            ...item,
            token_used: item.chain_id, // Use chain_id for token mapping as well
            amount_paid: item.token_address ? "Amount from blockchain" : "-" // Will show amount when transaction is successful
          }))}
          renderCell={(heading: string, value: any, last: boolean) => (
            <div className={cn("flex w-[150px]", last && "justify-end")}>
              <Text
                weight={"bold"}
                size={"base"}
                className={cn("py-3 px-4", !last && "text-right")}
                variant={heading === "request_type" ? "green" : "white"}
                as={heading === "chain_id" || heading === "token_used" || heading === "request_status" || heading === "amount_paid" ? "div" : "p"}
              >
                {displayValues(heading, value)}
              </Text>
            </div>
          )}
        />
      ) : null}
    </>
  );
};

export default CreditHistory;
