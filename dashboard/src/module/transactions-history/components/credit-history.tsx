"use client";
import { APP_TABS, cn, formatDataBytes } from "@/lib/utils";
import { useOverview } from "@/providers/OverviewProvider";
import HistoryService from "@/services/history";
import { CreditRequest } from "@/services/history/response";
import { SignInButton, useAuth } from "@clerk/nextjs";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supportedTokensAndChains } from "@/lib/types";

import Button from "@/components/button";
import DynamicTable from "@/components/data-table";
import { Text } from "@/components/text";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "./empty-state";

const CreditHistory = ({ token }: { token?: string }) => {
  const [historyList, setHistoryList] = useState<CreditRequest[]>();
  const [loading, setLoading] = useState(true);
  const { setMainTabSelected } = useOverview();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await HistoryService.getCreditHistory({
        token: token!,
      });
      // Sort by latest transactions first
      const sortedData = (response?.data ?? []).sort((a: CreditRequest, b: CreditRequest) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setHistoryList(sortedData);
    } catch (error) {
      console.log(error);
      setHistoryList([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get chain info from supportedTokensAndChains
  const getChainInfo = useCallback((chainId: number) => {
    // Find the chain by ID in supportedTokensAndChains
    for (const [chainKey, chainData] of Object.entries(supportedTokensAndChains)) {
      if (chainData.id === chainId) {
        return {
          logo: chainData.icon,
          name: chainData.name,
          tokens: chainData.tokens
        };
      }
    }
    // Fallback for unknown chains
    return {
      logo: "/favicon.ico",
      name: "Unknown",
      tokens: []
    };
  }, []);

  const displayValues = useCallback(
    (heading: string, value: any) => {
      switch (heading) {
        case "created_at":
          return new Date(value).toLocaleDateString().replaceAll("/", "-");
        case "amount_credit":
          return value ? formatDataBytes(value) : "-";
        case "chain_id":
          const chainInfo = getChainInfo(value);
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
        default:
          return value ?? "-";
      }
    },
    [getChainInfo],
  );

  return (
    <>
      <div className="h-px bg-[#2B4761]" />
      {!loading && !historyList?.length ? (
        <EmptyState
          message="Your Credit History Would Be Shown Here"
          cta={
            <>
              {!isSignedIn ? (
                <SignInButton mode="modal" component="div">
                  <Button className="w-[195px]">Sign In</Button>
                </SignInButton>
              ) : (
                <Button
                  className="w-[195px]"
                  onClick={() => {
                    setMainTabSelected(APP_TABS.OVERVIEW);
                  }}
                >
                  Buy Credits
                </Button>
              )}
            </>
          }
        />
      ) : null}
      {loading ? (
        <div className="flex flex-col gap-y-4 mt-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : historyList?.length ? (
        <DynamicTable
          headings={[
            { key: "created_at", label: "Purchasing Date" },
            { key: "request_type", label: "Type" },
            { key: "chain_id", label: "Token Used" },
            { key: "request_status", label: "Amount Paid" },
            { key: "amount_credit", label: "Credit Received" },
          ]}
          listdata={historyList}
          renderCell={(heading: string, value: any, last: boolean) => (
            <div className={cn("flex", last ? "w-[180px] justify-end" : "w-[150px]")}>
              <Text
                weight={"bold"}
                size={"base"}
                className={cn("py-3 px-4 break-words", !last && "text-right", 
                  heading === "amount_credit" && "whitespace-nowrap overflow-hidden text-ellipsis"
                )}
                variant={heading === "request_type" ? "green" : "white"}
                as={heading === "chain_id" ? "div" : "p"}
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
