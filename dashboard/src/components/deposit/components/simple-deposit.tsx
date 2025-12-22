"use client";

import { useCallback } from "react";
import { type BaseDepositProps } from "../deposit";
import AmountInput from "./amount-input";
import SourceSelect from "./source-select";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import AllowanceModal from "./allowance-modal";
import DepositTransactionStatusStep from "./transaction-status-step";
import DepositFeeBreakdown from "./fee-breakdown";
import SourceBreakdown from "./source-breakdown";
import { useNexus } from "../../nexus/NexusProvider";
import useDeposit from "../hooks/useDeposit";
import { LoaderPinwheel, X } from "lucide-react";
import { Skeleton } from "../../ui/skeleton";
import { type SUPPORTED_TOKENS } from "@avail-project/nexus-core";

interface SimpleDepositProps extends BaseDepositProps {
  destinationLabel?: string;
}

const SimpleDeposit = ({
  address,
  token,
  chain,
  chainOptions,
  destinationLabel = "on Hyperliquid Perps",
  depositExecute,
}: SimpleDepositProps) => {
  const {
    nexusSDK,
    intent,
    bridgableBalance,
    fetchBridgableBalance,
    allowance,
  } = useNexus();

  const {
    inputs,
    setInputs,
    status,
    explorerUrls,
    loading,
    isProcessing,
    isSuccess,
    isError,
    simulating,
    refreshing,
    txError,
    setTxError,
    timer,
    filteredBridgableBalance,
    unfilteredBridgableBalance,
    simulation,
    startTransaction,
    cancelSimulation,
    steps,
    feeBreakdown,
    reset,
  } = useDeposit({
    token: token ?? "USDC",
    chain,
    nexusSDK,
    intent,
    bridgableBalance,
    allowance,
    chainOptions,
    address,
    executeBuilder: depositExecute,
    fetchBridgableBalance,
  });

  const renderDepositButtonContent = useCallback(() => {
    if (refreshing)
      return (
        <div className="flex items-center gap-x-2">
          <LoaderPinwheel className="animate-spin size-4" />
          <p>Refreshing Quote</p>
        </div>
      );
    if (simulating)
      return (
        <div className="flex items-center gap-x-2">
          <LoaderPinwheel className="animate-spin size-4" />
          <p>Preparing Quote</p>
        </div>
      );
    return "Deposit";
  }, [refreshing, simulating]);

  if (isProcessing || isSuccess || isError) {
    return (
      <>
        {allowance.current && (
          <Dialog open={true} onOpenChange={() => {}}>
            <DialogContent>
              <DialogHeader className="sr-only">
                <DialogTitle>Set Token Allowances</DialogTitle>
              </DialogHeader>
              <AllowanceModal
                allowance={allowance}
                callback={startTransaction}
                onCloseCallback={reset}
              />
            </DialogContent>
          </Dialog>
        )}
        <DepositTransactionStatusStep
          status={status}
          timer={timer}
          steps={steps}
          tokenSymbol={token ?? "USDC"}
          amount={inputs?.amount ?? "0"}
          destinationLabel={destinationLabel}
          explorerUrls={explorerUrls}
          feeBreakdown={feeBreakdown}
          onClose={reset}
        />
      </>
    );
  }

  // Default: show form view (idle/previewing states)
  return (
    <div className="flex flex-col items-center w-full gap-y-3 rounded-lg">
      {/* Sources */}
      <SourceSelect
        token={token ?? "USDC"}
        balanceBreakdown={unfilteredBridgableBalance}
        selected={inputs?.selectedSources}
        onChange={(selected) =>
          setInputs({ ...inputs, selectedSources: selected })
        }
        disabled={Boolean(simulation && !simulation?.bridgeSimulation)}
      />
      <AmountInput
        value={inputs?.amount}
        onChange={(value) => {
          setInputs({ ...inputs, amount: value });
          if (!value) {
            cancelSimulation();
            setTxError(null);
          }
        }}
        destinationChain={inputs?.chain}
        bridgableBalance={filteredBridgableBalance}
        disabled={loading || simulating}
        maxLength={filteredBridgableBalance?.decimals}
      />
      {/* Shimmer while simulating */}
      {simulating && !simulation && (
        <>
          <SourceBreakdown
            isLoading
            tokenSymbol={filteredBridgableBalance?.symbol as SUPPORTED_TOKENS}
            chain={chain}
          />
          <div className="w-full flex items-start justify-between gap-x-4">
            <p className="text-base font-semibold">You Receive</p>
            <div className="flex flex-col gap-y-1 min-w-fit items-end">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <DepositFeeBreakdown
            isLoading
            total={"0"}
            bridge={"0"}
            execute={"0"}
          />
        </>
      )}
      {simulation && inputs?.amount && (
        <>
          <SourceBreakdown
            intent={simulation?.bridgeSimulation?.intent}
            tokenSymbol={filteredBridgableBalance?.symbol as SUPPORTED_TOKENS}
            isLoading={refreshing}
            chain={chain}
            bridgableBalance={filteredBridgableBalance}
            requiredAmount={inputs?.amount}
          />

          <div className="w-full flex items-start justify-between gap-x-4">
            <p className="text-base font-semibold">You Receive</p>
            <div className="flex flex-col gap-y-1 min-w-fit">
              {refreshing ? (
                <Skeleton className="h-5 w-28" />
              ) : (
                <p className="text-base font-semibold text-right">
                  {inputs?.amount} {filteredBridgableBalance?.symbol}
                </p>
              )}
              <p className="text-sm font-medium text-right">
                {destinationLabel}
              </p>
            </div>
          </div>

          <DepositFeeBreakdown
            total={`${feeBreakdown?.totalGasFee}`}
            bridge={feeBreakdown?.bridgeFormatted ?? ""}
            execute={feeBreakdown?.gasFormatted ?? ""}
            isLoading={refreshing}
          />
          {!simulation.bridgeSimulation && (
            <div className="w-full text-sm text-muted-foreground">
              Bridge skipped, executing directly on destination chain
            </div>
          )}
        </>
      )}
      {simulation ? (
        <div className="w-full flex items-center justify-center gap-x-2 px-1">
          <Button
            variant={"destructive"}
            onClick={() => {
              reset();
              setTxError(null);
            }}
            className="w-1/2"
          >
            Cancel
          </Button>
          <Button
            onClick={startTransaction}
            disabled={loading || simulating || refreshing}
            className="w-1/2"
          >
            {renderDepositButtonContent()}
          </Button>
        </div>
      ) : (
        <Button disabled={true} className="w-full px-2">
          {renderDepositButtonContent()}
        </Button>
      )}

      {txError && (
        <div className="rounded-md border border-destructive bg-destructive/80 px-3 py-2 text-sm text-destructive-foreground flex items-start justify-between gap-x-3 mt-3 w-full max-w-sm">
          <span className="flex-1 max-w-md truncate">{txError}</span>
          <Button
            type="button"
            size={"icon"}
            variant={"ghost"}
            onClick={() => {
              reset();
              setTxError(null);
            }}
            className="text-destructive-foreground/80 hover:text-destructive-foreground focus:outline-none"
            aria-label="Dismiss error"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default SimpleDeposit;
