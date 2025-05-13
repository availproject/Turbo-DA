"use client";
import { cn } from "@/lib/utils";
import HistoryService from "@/services/history";
import { useCallback, useEffect, useState } from "react";
import DynamicTable from "../data-table";
import { Text } from "../text";
import EmptyState from "./empty-state";

const DataPostingHistory = ({ token }: { token?: string }) => {
  const [historyList, setHistoryList] = useState<any[]>();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await HistoryService.getDataPostingHistory({
        token: token!,
      });

      setHistoryList(response?.data?.results ?? []);
    } catch (error) {
      setHistoryList([]);
    }
  };

  const displayValues = useCallback((heading: string, value: any) => {
    switch (heading) {
      case "created_at":
        return new Date(value).toLocaleDateString();
      default:
        return value ?? "-";
    }
  }, []);

  return (
    <>
      <div className="h-px bg-[#2B4761]" />
      {!historyList?.length ? (
        <EmptyState message="Your Data Posting History Would Be Shown Here" />
      ) : null}
      {historyList?.length ? (
        <>
          <Text
            variant={"light-grey"}
            size={"xs"}
            weight={"medium"}
            className="mt-4 ml-1"
          >
            *This table shows the last 10 entries only
          </Text>
          <DynamicTable
            headings={[
              { key: "created_at", label: "Date Posted" },
              { key: "amount_data", label: "Data Posted" },
              { key: "converted_fees", label: "Discount Received" },
            ]}
            listdata={historyList}
            renderCell={(heading: string, value: any, last: boolean) => {
              return (
                <div
                  className={cn("flex min-w-[150px]", last && "justify-end")}
                >
                  <Text
                    weight={"bold"}
                    size={"base"}
                    className={cn("py-3 px-4", !last && "text-right")}
                    variant={heading === "converted_fees" ? "green" : "white"}
                  >
                    {displayValues(heading, value)}
                  </Text>
                </div>
              );
            }}
          />
        </>
      ) : null}
    </>
  );
};

export default DataPostingHistory;
