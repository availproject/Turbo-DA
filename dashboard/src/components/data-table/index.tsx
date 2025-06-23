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
              className="relative w-full h-[50px] rounded-lg mb-4"
              key={index}
            >
              <div className="absolute w-full h-full rounded-lg bg-linear-[139.26deg] from-border-grey from-[-0.73%] to-border-secondary to-[100.78%] p-px">
                <div className="flex justify-between rounded-lg bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] shadow-primary overflow-hidden z-1 relative">
                  <div className="bg-[url('/table-row-noise.png')] bg-no-repeat absolute h-[50px] opacity-80 w-full z-0" />
                  {headings.map((heading, index, array) => (
                    <div
                      key={heading.key}
                      className={cn(
                        "flex min-w-[150px] relative",
                        array.length - 1 === index
                          ? "justify-end"
                          : "justify-start"
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
              </div>
            </div>
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
