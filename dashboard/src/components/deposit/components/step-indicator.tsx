"use client";

import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState, useMemo } from "react";

interface StepIndicatorProps {
  /** Number from 0 to 1 representing progress */
  progress: number;
  /** Whether the transaction is fully complete */
  isComplete: boolean;
  /** Whether the transaction has failed */
  isError?: boolean;
}

const MILESTONES = [
  { id: 1, label: "Intent verified" },
  { id: 2, label: "Collected" },
  { id: 3, label: "Filled" },
  { id: 4, label: "Depositing" },
];

export const StepIndicator = ({
  progress,
  isComplete,
  isError = false,
}: StepIndicatorProps) => {
  const [isMerged, setIsMerged] = useState(false);

  // Calculate which step is active based on progress
  const currentStep = useMemo(() => {
    if (isComplete) return MILESTONES.length;
    // Map progress (0-1) to steps (1-4)
    return Math.min(
      MILESTONES.length,
      Math.floor(progress * MILESTONES.length) + 1
    );
  }, [progress, isComplete]);

  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => setIsMerged(true), 500);
      return () => clearTimeout(timer);
    } else {
      setIsMerged(false);
    }
  }, [isComplete]);

  // Don't show merged state on error
  const showMerged = isMerged && !isError;

  return (
    <div className="relative flex h-14 items-center justify-center w-full">
      {/* Merged success state */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-700 ease-in-out",
          showMerged
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-50 translate-y-4 pointer-events-none"
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success text-success-foreground shadow-[0_0_15px_rgba(34,197,94,0.4)] ring-2 ring-success/20">
          <Check
            className="h-5 w-5 animate-in zoom-in duration-300"
            strokeWidth={3}
          />
        </div>
      </div>

      {/* Steps */}
      <div
        className={cn(
          "flex items-center gap-1.5 transition-all duration-500 ease-in-out",
          showMerged
            ? "opacity-0 scale-90 blur-sm"
            : "opacity-100 scale-100 blur-0"
        )}
      >
        {MILESTONES.map((step, index) => {
          const isStepComplete = step.id < currentStep || isComplete;
          // Stop showing active spinner on error
          const isStepActive =
            step.id === currentStep && !isComplete && !isError;
          // Show error state on current step when error occurs
          const isStepError = step.id === currentStep && isError;

          return (
            <div
              key={step.id}
              className="flex items-center gap-1 text-xs font-medium"
            >
              <div
                className={cn(
                  "relative flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-300",
                  isStepComplete &&
                    "border-primary bg-success text-success-foreground",
                  isStepActive &&
                    "border-primary border-2 text-primary ring-2 ring-primary/20 opacity-100",
                  isStepError &&
                    "border-2 border-destructive text-destructive-foreground",
                  !isStepComplete &&
                    !isStepActive &&
                    !isStepError &&
                    "border-border text-muted-foreground opacity-30"
                )}
              >
                <span className="absolute inset-0 flex items-center justify-center">
                  {isStepComplete && (
                    <Check className="h-3 w-3 animate-in zoom-in duration-300" />
                  )}
                  {isStepActive && <Loader2 className="h-3 w-3 animate-spin" />}
                  {isStepError && (
                    <span className="text-[10px] font-bold text-destructive">
                      !
                    </span>
                  )}
                  {!isStepComplete && !isStepActive && !isStepError && (
                    <span className="text-[10px] text-foreground">
                      {step.id}
                    </span>
                  )}
                </span>
              </div>

              {index < MILESTONES.length - 1 && (
                <div className="h-px w-4 bg-border overflow-hidden rounded-full">
                  <div
                    className={cn(
                      "h-full bg-success transition-transform duration-500 ease-in-out origin-left",
                      isStepComplete ? "scale-x-100" : "scale-x-0"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
