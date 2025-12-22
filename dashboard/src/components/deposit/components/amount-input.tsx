"use client";

import {
  type SUPPORTED_CHAINS_IDS,
  type UserAsset,
} from "@avail-project/nexus-core";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Fragment } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../ui/accordion";
import { computeAmountFromFraction, SHORT_CHAIN_NAME } from "../../common";
import { useNexus } from "../../nexus/NexusProvider";
import { LoaderCircle } from "lucide-react";

const RANGE_OPTIONS = [
  {
    label: "25%",
    value: 0.25,
  },
  {
    label: "50%",
    value: 0.5,
  },
  {
    label: "75%",
    value: 0.75,
  },
  {
    label: "MAX",
    value: 1,
  },
];

const SAFETY_MARGIN = 0.05;

interface AmountInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "value"
  > {
  value?: string;
  onChange?: (value: string) => void;
  bridgableBalance?: UserAsset;
  destinationChain: SUPPORTED_CHAINS_IDS;
}

const AmountInput = ({
  value,
  onChange,
  bridgableBalance,
  disabled,
  destinationChain,
  ...props
}: AmountInputProps) => {
  const { nexusSDK, loading } = useNexus();

  const hasSelectedSources =
    bridgableBalance && bridgableBalance.breakdown.length > 0;
  const hasBalance =
    hasSelectedSources && Number.parseFloat(bridgableBalance.balance) > 0;

  return (
    <div className="flex flex-col items-start gap-y-1 w-full py-2">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="balance-breakdown">
          <div className="flex items-center justify-between gap-x-3 w-full">
            <Input
              {...props}
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="0.00"
              value={value ?? ""}
              onChange={(e) => onChange?.(e.target.value)}
              className="p-0 text-2xl! placeholder:text-2xl w-full border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none bg-transparent!"
              disabled={disabled || loading || !hasSelectedSources}
            />
            {bridgableBalance && hasSelectedSources && (
              <p className="text-base font-semibold min-w-max">
                {nexusSDK?.utils?.formatTokenBalance(
                  bridgableBalance?.balance,
                  {
                    symbol: bridgableBalance?.symbol,
                    decimals: bridgableBalance?.decimals,
                  }
                )}
              </p>
            )}
            {bridgableBalance && !hasSelectedSources && (
              <p className="text-sm text-muted-foreground min-w-max">
                No sources selected
              </p>
            )}
            {loading && !bridgableBalance && (
              <LoaderCircle className="size-4 animate-spin" />
            )}
          </div>
          <div className="flex w-full items-center justify-between">
            <div className="flex gap-x-3">
              {RANGE_OPTIONS.map((option) => (
                <Button
                  size={"icon"}
                  variant={"ghost"}
                  key={option.label}
                  className="text-xs py-0.5 px-0 size-max"
                  disabled={disabled || !hasBalance}
                  onClick={() => {
                    if (!bridgableBalance?.balance) return;

                    const amount = computeAmountFromFraction(
                      bridgableBalance.balance,
                      option.value,
                      bridgableBalance?.breakdown.find(
                        (chain) => chain?.chain?.id === destinationChain
                      )?.decimals ?? bridgableBalance?.decimals,
                      SAFETY_MARGIN
                    );
                    onChange?.(amount);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {hasSelectedSources && (
              <AccordionTrigger
                className="w-fit justify-end items-center py-0 gap-x-0.5 cursor-pointer"
                hideChevron={false}
              >
                <p className="text-xs font-semibold min-w-max">View Assets</p>
              </AccordionTrigger>
            )}
          </div>

          <AccordionContent className="pb-0">
            <div className="space-y-3 py-2 max-h-40 overflow-y-auto no-scrollbar">
              {bridgableBalance?.breakdown.map((chain) => {
                if (Number.parseFloat(chain.balance) === 0) return null;
                return (
                  <Fragment key={chain.chain.id}>
                    <div className="flex items-center justify-between px-2 py-1 rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="relative h-6 w-6">
                          <img
                            src={chain?.chain?.logo}
                            alt={chain.chain.name}
                            sizes="100%"
                            className="rounded-full"
                            loading="lazy"
                            decoding="async"
                            width="24"
                            height="24"
                          />
                        </div>
                        <span className="text-sm sm:block hidden">
                          {SHORT_CHAIN_NAME[chain.chain.id]}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {nexusSDK?.utils?.formatTokenBalance(chain.balance, {
                            symbol: bridgableBalance?.symbol,
                            decimals: bridgableBalance?.decimals,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ${chain.balanceInFiat.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default AmountInput;
