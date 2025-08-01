import { TRANSACTION_CONSTANTS } from "@/constants/transaction";
import { TransactionStatus } from "@/providers/ConfigProvider";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  status: TransactionStatus["status"];
  className?: string;
}

const stepOrder: TransactionStatus["status"][] = [
  "initialised",
  ...TRANSACTION_CONSTANTS.STATUS_FLOW,
];

/** Returns true if the transaction status is >= the given step */
const isStepCompleted = (
  status: TransactionStatus["status"] | undefined,
  stepIndex: number
) => {
  if (!status) return false;
  return stepOrder.indexOf(status) >= stepIndex;
};

/** Returns bar background color */
const getBarBackground = (
  status: TransactionStatus["status"] | undefined,
  stepIndex: number
) => (isStepCompleted(status, stepIndex) ? "bg-white" : "bg-[#999]");

/** Returns inner fill width */
const getBarFill = (
  status: TransactionStatus["status"] | undefined,
  stepIndex: number
) => (isStepCompleted(status, stepIndex) ? "w-full" : "w-0");

export const ProgressBar = ({ status, className }: ProgressBarProps) => {
  return (
    <div className={cn("flex gap-x-2", className)}>
      {Array.from({ length: TRANSACTION_CONSTANTS.PROGRESS_STEPS }, (_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full overflow-hidden",
            `w-[${TRANSACTION_CONSTANTS.PROGRESS_BAR_WIDTH}px] h-[${TRANSACTION_CONSTANTS.PROGRESS_BAR_HEIGHT}px]`,
            getBarBackground(status, i)
          )}
        >
          <div
            className={cn(
              "h-full bg-green rounded-full transition-all duration-1000 ease-out",
              getBarFill(status, i)
            )}
          />
        </div>
      ))}
    </div>
  );
};
