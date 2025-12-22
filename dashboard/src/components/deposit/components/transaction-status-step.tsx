"use client";

import { useState, useMemo } from "react";
import { StepIndicator } from "./step-indicator";
import { InfoRow, InfoCard } from "./info";
import { Button } from "../../ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../ui/collapsible";
import { ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { type DepositStatus } from "../hooks/useDeposit";
import { type BridgeStepType } from "@avail-project/nexus-core";

interface DepositTransactionStatusProps {
  status: DepositStatus;
  timer: number;
  steps: Array<{ id: number; completed: boolean; step: BridgeStepType }>;
  tokenSymbol: string;
  amount: string;
  destinationLabel: string;
  explorerUrls: {
    intentUrl: string | null;
    executeUrl: string | null;
  };
  feeBreakdown?: {
    totalGasFee: string | number;
    gasFormatted?: string;
    bridgeFormatted?: string;
  };
  onClose: () => void;
}

const DepositTransactionStatusStep = ({
  status,
  timer,
  steps,
  tokenSymbol,
  amount,
  destinationLabel,
  explorerUrls,
  feeBreakdown,
  onClose,
}: DepositTransactionStatusProps) => {
  const [open, setOpen] = useState(false);

  const isSuccess = status === "success";
  const isError = status === "error";
  const isExecuting = status === "executing";
  const totalSteps = Array.isArray(steps) ? steps.length : 0;
  const completedSteps = Array.isArray(steps)
    ? steps.reduce((acc, s) => acc + (s?.completed ? 1 : 0), 0)
    : 0;
  const stepPercent = totalSteps > 0 ? completedSteps / totalSteps : 0;
  const progress = isSuccess ? 1 : Math.min(stepPercent, 0.75);

  const title = useMemo(() => {
    if (isSuccess) return "Deposit successful";
    if (isError) return "Deposit failed";
    return "Processing your deposit";
  }, [isSuccess, isError]);

  const subtitle = useMemo(() => {
    if (isSuccess) return "Your funds were successfully deposited.";
    if (isError) return "Something went wrong with your deposit.";
    return "This may take a few seconds to complete.";
  }, [isSuccess, isError]);

  const totalTime = useMemo(() => {
    if (!isSuccess) return undefined;
    return `${Math.max(1, Math.floor(timer))}s`;
  }, [isSuccess, timer]);

  const statusValue = useMemo(() => {
    if (isSuccess) {
      return <span className="text-success font-semibold">Successful</span>;
    }
    if (isError) {
      return <span className="text-destructive font-semibold">Failed</span>;
    }
    return (
      <span className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Processing
      </span>
    );
  }, [isSuccess, isError]);

  // Format live timer display
  const liveTimer = useMemo(() => {
    const seconds = Math.floor(timer);
    const ms = String(Math.floor((timer % 1) * 1000)).padStart(3, "0");
    return `${seconds}.${ms}s`;
  }, [timer]);

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar px-4 py-4">
        <StepIndicator
          progress={progress}
          isComplete={isSuccess}
          isError={isError}
        />

        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
          {isExecuting && (
            <p className="text-2xl font-semibold text-foreground">
              {liveTimer}
            </p>
          )}
        </div>

        <InfoCard>
          <InfoRow label="Status" value={statusValue} />
          {isSuccess && totalTime && (
            <InfoRow label="Total time" value={totalTime} />
          )}
        </InfoCard>

        <InfoCard>
          <InfoRow
            label={isSuccess ? "You deposited" : "Depositing"}
            value={`${amount} ${tokenSymbol}`}
          />
          <InfoRow label="Destination" value={destinationLabel} />
        </InfoCard>

        {(explorerUrls.intentUrl || explorerUrls.executeUrl) && (
          <InfoCard>
            {explorerUrls.intentUrl && (
              <InfoRow
                label="Bridge Intent"
                value={
                  <a
                    href={explorerUrls.intentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    View
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                }
              />
            )}
            {explorerUrls.executeUrl && (
              <InfoRow
                label="Execute Transaction"
                value={
                  <a
                    href={explorerUrls.executeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    View
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                }
              />
            )}
          </InfoCard>
        )}

        {feeBreakdown && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between py-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <span>Fee breakdown</span>
              <ChevronRight
                className={`h-4 w-4 transition-transform ${
                  open ? "rotate-90" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <InfoCard className="space-y-0">
                {feeBreakdown.bridgeFormatted && (
                  <InfoRow
                    label="Bridge fee"
                    value={feeBreakdown.bridgeFormatted}
                  />
                )}
                {feeBreakdown.gasFormatted && (
                  <InfoRow label="Gas fee" value={feeBreakdown.gasFormatted} />
                )}
                <InfoRow
                  label="Total fees"
                  value={
                    typeof feeBreakdown.totalGasFee === "string"
                      ? feeBreakdown.totalGasFee
                      : `$${feeBreakdown.totalGasFee.toFixed(4)}`
                  }
                />
              </InfoCard>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <div className="flex gap-3 border-t border-border p-4">
        <Button
          variant="destructive"
          onClick={onClose}
          className="flex-1 rounded-xl text-base"
        >
          Close
        </Button>
        <Button
          onClick={onClose}
          className="flex-1 rounded-xl text-base"
          disabled={!isSuccess && !isError}
        >
          {isSuccess || isError ? (
            "New Deposit"
          ) : (
            <Loader2 className="size-5 animate-spin" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default DepositTransactionStatusStep;
