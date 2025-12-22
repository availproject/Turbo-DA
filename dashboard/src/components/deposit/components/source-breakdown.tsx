import {
  CHAIN_METADATA,
  type SUPPORTED_CHAINS_IDS,
  type UserAsset,
  type ReadableIntent,
  type SUPPORTED_TOKENS,
} from "@avail-project/nexus-core";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../ui/accordion";
import { Skeleton } from "../../ui/skeleton";
import { useMemo } from "react";
import { useNexus } from "../../nexus/NexusProvider";

interface SourceBreakdownProps {
  intent?: ReadableIntent;
  tokenSymbol: SUPPORTED_TOKENS;
  isLoading?: boolean;
  chain: SUPPORTED_CHAINS_IDS;
  bridgableBalance?: UserAsset;
  requiredAmount?: string;
}

type ReadableIntentSource = {
  amount: string;
  chainID: number;
  chainLogo: string | undefined;
  chainName: string;
  contractAddress: `0x${string}`;
};

const SourceBreakdown = ({
  intent,
  tokenSymbol,
  isLoading = false,
  chain,
  bridgableBalance,
  requiredAmount,
}: SourceBreakdownProps) => {
  const { nexusSDK } = useNexus();
  const fundsOnDestination = useMemo(() => {
    return Number.parseFloat(
      bridgableBalance?.breakdown?.find((b) => b.chain?.id === chain)
        ?.balance ?? "0"
    );
  }, [bridgableBalance, chain]);

  const amountSpend = useMemo(() => {
    const amountToFormat = intent
      ? Number.parseFloat(requiredAmount ?? "0") +
        Number.parseFloat(intent?.fees?.total ?? "0")
      : requiredAmount ?? "0";
    return nexusSDK?.utils?.formatTokenBalance(amountToFormat, {
      symbol: tokenSymbol,
      decimals: intent?.token?.decimals,
    });
  }, [requiredAmount, intent, tokenSymbol]);

  const displaySources = useMemo(() => {
    if (!intent)
      return [
        {
          chainID: chain,
          chainLogo: CHAIN_METADATA[chain]?.logo,
          chainName: CHAIN_METADATA[chain]?.name ?? "Destination",
          amount: requiredAmount ?? "0",
          contractAddress: "",
        },
      ];
    const baseSources: ReadableIntentSource[] = intent?.sources ?? [];
    const requiredAmountNumber = Number(requiredAmount ?? "0");
    const destUsed = Math.max(
      Math.min(requiredAmountNumber, fundsOnDestination),
      0
    );
    if (destUsed <= 0) {
      return baseSources;
    }
    const allSources = intent?.allSources ?? [];
    const destDetails = allSources?.find?.(
      (s: ReadableIntentSource) => s?.chainID === chain
    );
    const hasDest = baseSources?.some?.(
      (s: ReadableIntentSource) => s?.chainID === chain
    );
    const destSource = {
      chainID: chain,
      chainLogo: destDetails?.chainLogo,
      chainName: destDetails?.chainName ?? "Destination",
      amount: destUsed.toString(),
      contractAddress: destDetails?.contractAddress ?? "",
    };
    if (hasDest) {
      return baseSources.map((s: ReadableIntentSource) =>
        s?.chainID === chain ? { ...s, amount: destSource.amount } : s
      );
    }
    return [...baseSources, destSource];
  }, [intent, requiredAmount, fundsOnDestination, chain]);

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="sources">
        <div className="flex items-start justify-between gap-x-4 w-full">
          {isLoading ? (
            <>
              <div className="flex flex-col items-start gap-y-1 min-w-fit">
                <p className="text-base font-semibold">You Spend</p>
                <Skeleton className="h-4 w-44" />
              </div>
              <div className="flex flex-col items-end gap-y-1 min-w-fit">
                <Skeleton className="h-5 w-24" />
                <div className="w-fit">
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-start gap-y-1 min-w-fit">
                <p className="text-base font-semibold">You Spend</p>
                <p className="text-sm font-medium">
                  {displaySources?.length < 2
                    ? "1 Asset on 1 Chain"
                    : `1 Asset on ${displaySources?.length} Chains`}
                </p>
              </div>

              <div className="flex flex-col items-end gap-y-1 min-w-fit">
                <p className="text-base font-semibold">{amountSpend}</p>
                <AccordionTrigger
                  containerClassName="w-fit"
                  className="py-0 items-center gap-x-1"
                  hideChevron={false}
                >
                  <p className="text-sm font-medium">View Sources</p>
                </AccordionTrigger>
              </div>
            </>
          )}
        </div>
        {!isLoading && displaySources?.length > 0 && (
          <AccordionContent className="my-4 bg-muted pb-0 px-4 py-2 rounded-lg w-full">
            <div className="flex flex-col items-center gap-y-3">
              {displaySources?.map((source) => (
                <div
                  key={source.chainID}
                  className="flex items-center justify-between w-full gap-x-2"
                >
                  <div className="flex items-center gap-x-2">
                    <img
                      src={source?.chainLogo}
                      alt={source?.chainName}
                      width={20}
                      height={20}
                      className="rounded-full"
                    />
                    <p className="text-sm font-semibold sm:block hidden">
                      {source.chainName}
                    </p>
                  </div>

                  <p className="text-sm font-semibold">
                    {source.amount} {tokenSymbol}
                  </p>
                </div>
              ))}
            </div>
          </AccordionContent>
        )}
      </AccordionItem>
    </Accordion>
  );
};

export default SourceBreakdown;
