import { useEffect, useState, useRef, useCallback } from "react";
import { TransactionStatus, useConfig } from "@/providers/ConfigProvider";
import { useAppToast } from "@/components/toast";
import { useDialog } from "@/components/dialog/provider";
import { useOverview } from "@/providers/OverviewProvider";
import useBalance from "./useBalance";
import { toast } from "react-toastify";

export interface UseTransactionProgressOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const useTransactionProgress = (
  options?: UseTransactionProgressOptions
) => {
  const {
    token,
    setTransactionStatusList,
    showTransaction,
    setShowTransaction,
    transactionStatusList,
  } = useConfig();
  const { error: errorToast, transactionProgress } = useAppToast();
  const { setOpen } = useDialog();
  const { creditBalance, setIsAwaitingCreditUpdate } = useOverview();
  const { updateCreditBalance } = useBalance();
  const [isProcessing, setIsProcessing] = useState(false);
  const pollingRef = useRef<{
    intervalId?: NodeJS.Timeout;
    initialBalance?: number;
  }>({});

  const startCreditBalancePolling = useCallback(() => {
    const initialBalance = creditBalance;
    pollingRef.current.initialBalance = initialBalance;
    setIsAwaitingCreditUpdate(true);
    let pollCount = 0;
    const maxPolls = 24; // Poll for 2 minutes (every 5 seconds)
    
    const checkBalanceUpdate = async () => {
      pollCount++;
      
      try {
        await updateCreditBalance();
        
        if (pollCount >= maxPolls) {
          setIsAwaitingCreditUpdate(false);
          if (pollingRef.current.intervalId) {
            clearInterval(pollingRef.current.intervalId);
            pollingRef.current.intervalId = undefined;
          }
        }
      } catch (error) {
        // Silent fail for balance polling
      }
    };
    
    pollingRef.current.intervalId = setInterval(checkBalanceUpdate, 5000);

    // Initial check after 2 seconds
    setTimeout(checkBalanceUpdate, 2000);
  }, [creditBalance, setIsAwaitingCreditUpdate, updateCreditBalance]);

  const completeTransaction = useCallback((transaction?: TransactionStatus) => {
    const txnToComplete = transaction || showTransaction;
    
    if (!txnToComplete) {
      return;
    }


    setTransactionStatusList((prev) => {
      const updated = prev.map((t: TransactionStatus) =>
        t.id === txnToComplete.id
          ? { ...t, status: "completed" as const }
          : t
      );
      return updated;
    });
    
    if (showTransaction?.id === txnToComplete.id) {
      setShowTransaction({ ...txnToComplete, status: "completed" as const });
    }

    // Start polling for credit balance updates
    startCreditBalancePolling();
  }, [showTransaction, setTransactionStatusList, setShowTransaction, startCreditBalancePolling]);

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

  const handleError = (errorMessage: string) => {
    errorToast?.({ label: errorMessage });
    setOpen("");
    options?.onError?.(errorMessage);
  };

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
