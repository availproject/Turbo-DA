import { cn } from "@/lib/utils";
import HistoryService from "@/services/history";
import DynamicTable from "../data-table";
import { Text } from "../text";
import EmptyState from "./empty-state";

const DataPostingHistory = async ({ token }: { token?: string }) => {
  const response = await HistoryService.getDataPostingHistory({
    token: token!,
  })
    .then((response) => response.data.results)
    .catch((error) => []);

  return (
    <>
      <div className="h-px bg-[#575757]" />
      {!response?.length ? (
        <EmptyState message="Your Data Posting History Would Be Shown Here" />
      ) : null}
      {response?.length ? (
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
            listdata={response}
            renderCell={(heading: string, value: any, last: boolean) => {
              return (
                <div
                  className={cn("flex min-w-[150px]", last && "justify-end")}
                >
                  <Text
                    weight={"bold"}
                    size={"base"}
                    className={cn("py-3 px-4", !last && "text-right")}
                    variant={heading === "discount" ? "green" : "white"}
                  >
                    {value}
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
