import { useEffect, useState, useRef } from "react";
import { useConfig } from "@/providers/ConfigProvider";
import { useAppToast } from "@/components/toast";
import { useDialog } from "@/components/dialog/provider";
import { useOverview } from "@/providers/OverviewProvider";
import { toast } from "react-toastify";

export interface UseTransactionProgressOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const useTransactionProgress = (
  options?: UseTransactionProgressOptions
) => {
  const {
    showTransaction,
    setShowTransaction,
  } = useConfig();
  const { transactionProgress } = useAppToast();
  const { setOpen } = useDialog();
  const { creditBalance, setIsAwaitingCreditUpdate } = useOverview();
  const [isProcessing] = useState(false);
  const pollingRef = useRef<{
    intervalId?: NodeJS.Timeout;
    initialBalance?: number;
  }>({});

  // Auto-complete transactions after delay - DISABLED
  // Completion is now handled directly in buy-button.tsx for each chain type

  // Monitor credit balance changes to stop polling
  useEffect(() => {
    if (!pollingRef.current.intervalId || !pollingRef.current.initialBalance) {
      return;
    }

    if (creditBalance !== pollingRef.current.initialBalance) {
      setIsAwaitingCreditUpdate(false);
      clearInterval(pollingRef.current.intervalId);
      pollingRef.current.intervalId = undefined;
      pollingRef.current.initialBalance = undefined;
      options?.onSuccess?.();
    }
  }, [creditBalance, options]);

  const minimizeTransaction = () => {
    if (!showTransaction) return;
    
    setOpen("");
    
    // Show transaction progress toast when dialog is minimized and transaction is still active
    if (showTransaction.status !== "completed") {
      // Dismiss any existing toasts first to prevent duplicates
      toast.dismiss();
      transactionProgress({ transaction: showTransaction });
    } else {
      setShowTransaction(undefined);
    }
  };

  return {
    showTransaction,
    isProcessing,
    minimizeTransaction,
  };
};
