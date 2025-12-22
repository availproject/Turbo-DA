import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../ui/accordion";
import { Skeleton } from "../../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { MessageCircleQuestion } from "lucide-react";

interface DepositFeeBreakdownProps {
  total: string;
  bridge: string;
  execute: string;
  isLoading?: boolean;
}

const DepositFeeBreakdown = ({
  total,
  bridge,
  execute,
  isLoading = false,
}: DepositFeeBreakdownProps) => {
  const feeRows = [
    {
      key: "transaction",
      label: "Transaction Fee",
      value: bridge,
      description:
        "Cost required to bridge assets through Nexus, covering the cross-chain operation.",
    },
    {
      key: "deposit",
      label: "Deposit Fee",
      value: execute,
      description:
        "Gas fee required to execute the deposit contract call on chain.",
    },
  ];

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="deposit-fee-breakdown">
        <div className="w-full flex items-start justify-between">
          <p className="font-semibold text-base">Total Fees</p>

          <div className="flex flex-col items-end justify-end-safe gap-y-1">
            {isLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <p className="font-semibold text-base min-w-max text-center">
                {total}
              </p>
            )}
            <AccordionTrigger
              containerClassName="w-fit"
              className="p-0 items-center gap-x-1"
              hideChevron={false}
            >
              <p className="text-sm font-medium">View Breakdown</p>
            </AccordionTrigger>
          </div>
        </div>
        <AccordionContent>
          <div className="w-full flex flex-col items-center justify-between gap-y-3 bg-muted px-4 py-2 rounded-lg mt-2">
            {feeRows.map(({ key, label, value, description }) => {
              if (!value) return null;
              return (
                <Tooltip key={key}>
                  <div className="flex items-center w-full justify-between">
                    <div className="flex items-center gap-x-2">
                      <p className="text-sm font-semibold">{label}</p>
                      <TooltipTrigger asChild>
                        <MessageCircleQuestion className="size-4" />
                      </TooltipTrigger>
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-4 w-20" />
                    ) : (
                      <p className="text-sm font-semibold">{value}</p>
                    )}
                  </div>
                  <TooltipContent className="max-w-sm text-balance">
                    <p className="text-sm font-semibold">{description}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default DepositFeeBreakdown;
