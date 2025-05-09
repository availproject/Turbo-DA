// DynamicTable.tsx
import { cn } from "@/lib/utils";
import Image from "next/image";
import { FC, ReactNode } from "react";
import { Text } from "../text";

type DynamicTableProps = {
  headings: { key: string; label: string }[];
  listdata: { [key: string]: any }[];
  renderCell?: (heading: string, value: any, last: boolean) => ReactNode;
};

const DynamicTable: FC<DynamicTableProps> = ({
  headings,
  listdata,
  renderCell,
}) => {
  const defaultRenderCell = (
    heading: string,
    value: any,
    last: boolean
  ): ReactNode => {
    if (heading.toLowerCase() === "role") {
      return (
        <Text
          weight={"bold"}
          size={"base"}
          className="py-3 px-4 text-right text-[#88D67B]"
        >
          {value as string}
        </Text>
      );
    }
    return value ?? "-";
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1000px]">
        <div className="flex justify-between py-1.5">
          {headings.map(({ label, key }, index) => (
            <div className="flex flex-col min-w-[150px]" key={key}>
              <Text
                variant={"light-grey"}
                weight={"medium"}
                size={"xs"}
                className={cn(
                  "py-3 px-4",
                  index === headings.length - 1 ? "text-right" : "text-left"
                )}
              >
                {label}
              </Text>
            </div>
          ))}
        </div>

        {listdata.length > 0 ? (
          listdata.map((data, index) => (
            <div
              key={index}
              className="flex justify-between border border-[#444753] rounded-lg mb-4 bg-[#192A3D] py-1 shadow-b-lg"
            >
              {headings.map((heading, index, array) => (
                <div
                  key={heading.key}
                  className={cn(
                    "flex min-w-[150px]",
                    array.length - 1 === index ? "justify-end" : "justify-start"
                  )}
                >
                  {renderCell?.(
                    heading.key,
                    data[heading.key],
                    array.length - 1 === index
                  ) ??
                    defaultRenderCell(
                      heading.key,
                      data[heading.key],
                      array.length - 1 === index
                    )}
                </div>
              ))}
            </div>
            // <div
            //   key={index}
            //   className="flex justify-between border border-[#444753] rounded-lg mb-4 bg-[#192A3D] py-1 shadow-b-lg"
            // >
            //   <div className="flex min-w-[150px]">
            //     <Text
            //       weight={"bold"}
            //       size={"base"}
            //       className="py-3 px-4 text-left"
            //     >
            //       {purchase.date}
            //     </Text>
            //   </div>
            //   <div className="flex min-w-[150px]">
            //     <Text
            //       weight={"bold"}
            //       size={"base"}
            //       className="py-3 px-4 text-left text-[#88D67B]"
            //     >
            //       {purchase.type}
            //     </Text>
            //   </div>
            //   <div className="flex min-w-[150px]">
            //     <Text
            //       weight={"bold"}
            //       size={"base"}
            //       className="py-3 px-4 text-left"
            //     >
            //       {purchase.token}
            //     </Text>
            //   </div>
            //   <div className="flex min-w-[150px]">
            //     <Text
            //       weight={"bold"}
            //       size={"base"}
            //       className="py-3 px-4 text-left"
            //     >
            //       {purchase.amountPaid}
            //     </Text>
            //   </div>
            //   <div className="flex min-w-[150px] justify-end">
            //     <Text
            //       weight={"bold"}
            //       size={"base"}
            //       className="py-3 px-4 text-left"
            //     >
            //       {purchase.creditReceived.toLocaleString()} KB
            //     </Text>
            //   </div>
            // </div>
          ))
        ) : (
          <div className="flex justify-center items-center flex-col h-[334px]">
            <div className="flex flex-col gap-2 items-center justify-center">
              <Image
                src={"/empty.svg"}
                width={159}
                height={134}
                alt="empty-state"
              />
              <Text weight={"semibold"} size={"base"}>
                Your Data Posting History Would Be Shown Here
              </Text>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicTable;
