"use client";
import { cn, formatDataBytes } from "@/lib/utils";
import HistoryService from "@/services/history";
import { CreditRequest } from "@/services/history/response";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import DynamicTable from "../data-table";
import { Text } from "../text";
import { Skeleton } from "../ui/skeleton";
import EmptyState from "./empty-state";

const CreditHistory = ({ token }: { token?: string }) => {
  const [historyList, setHistoryList] = useState<CreditRequest[]>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await HistoryService.getCreditHistory({
        token: token!,
      });
      const processedHistory = response?.data?.filter(
        (credit: any) => credit?.request_status === "Processed"
      );
      setHistoryList(processedHistory);
    } catch (error) {
      setHistoryList([]);
    } finally {
      setLoading(false);
    }
  };

  const chainList: Record<string, { logo: string; name: string }> = useMemo(
    () => ({
      "11155111": {
        logo: "/currency/eth.png",
        name: "Ethereum",
      },
      "1": {
        logo: "/currency/eth.png",
        name: "Ethereum",
      },
    }),
    []
  );

  const displayValues = useCallback(
    (heading: string, value: any) => {
      switch (heading) {
        case "created_at":
          return new Date(value).toLocaleDateString().replaceAll("/", "-");
        case "amount_credit":
          return formatDataBytes(value, 2);
        case "chain_id":
          return (
            <div className="flex items-center gap-x-2">
              <Image
                src={chainList[value].logo}
                alt={chainList[value].name}
                width={20}
                height={20}
              />
              <Text variant={"light-grey"} weight={"semibold"} size={"sm"}>
                {chainList[value].name}
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
          cta={{
            action: () => {
              window.location.reload();
            },
            label: "Buy Credits",
          }}
        />
      ) : null}
      {loading ? (
        <div className="flex flex-col gap-y-4 mt-4">
          <Skeleton className="h-14 w-full bg-black/40 rounded-xs" />
          <Skeleton className="h-14 w-full bg-black/40 rounded-xs" />
          <Skeleton className="h-14 w-full bg-black/40 rounded-xs" />
          <Skeleton className="h-14 w-full bg-black/40 rounded-xs" />
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
            <div className={cn("flex w-[150px]", last && "justify-end")}>
              <Text
                weight={"bold"}
                size={"base"}
                className={cn("py-3 px-4", !last && "text-right")}
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
