import { cn } from "@/lib/utils";
import HistoryService from "@/services/history";
import DynamicTable from "../data-table";
import { Text } from "../text";
import EmptyState from "./empty-state";

const CreditHistory = async ({ token }: { token?: string }) => {
  const response = await HistoryService.getCreditHistory({
    token: token!,
  })
    .then((response) => response.data)
    .catch((error) => []);

  return (
    <>
      <div className="h-px bg-[#575757]" />
      {!response?.length ? (
        <EmptyState
          message="Your Credit History Would Be Shown Here"
          cta={{
            link: "/",
            label: "Buy Credits",
          }}
        />
      ) : null}
      {response.length ? (
        <DynamicTable
          headings={[
            { key: "created_at", label: "Purchasing Date" },
            { key: "request_type", label: "Type" },
            { key: "chain_id", label: "Token Used" },
            { key: "request_status", label: "Amount Paid" },
            { key: "amount_credit", label: "Credit Received" },
          ]}
          listdata={response}
          renderCell={(heading: string, value: any, last: boolean) => (
            <div className={cn("flex min-w-[150px]", last && "justify-end")}>
              <Text
                weight={"bold"}
                size={"base"}
                className={cn("py-3 px-4", !last && "text-right")}
                variant={heading === "type" ? "green" : "white"}
              >
                {value}
              </Text>
            </div>
          )}
        />
      ) : null}
    </>
  );
};

export default CreditHistory;
