"use client";
import { cn, formatDataBytes } from "@/lib/utils";
import HistoryService from "@/services/history";
import { useCallback, useEffect, useState } from "react";
import DynamicTable from "../data-table";
import { Text } from "../text";
import EmptyState from "./empty-state";

const CreditHistory = ({ token }: { token?: string }) => {
  const [historyList, setHistoryList] = useState<any[]>();

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
    }
  };

  const displayValues = useCallback((heading: string, value: any) => {
    switch (heading) {
      case "created_at":
        return new Date(value).toDateString();
      case "amount_credit":
        return formatDataBytes(value);
      default:
        return value ?? "-";
    }
  }, []);

  return (
    <>
      <div className="h-px bg-[#2B4761]" />
      {!historyList?.length ? (
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
      {historyList?.length ? (
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
