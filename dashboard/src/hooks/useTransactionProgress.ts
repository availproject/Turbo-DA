import { useEffect, useState, useRef } from "react";
import { TransactionStatus, useConfig } from "@/providers/ConfigProvider";
import { TransactionService } from "@/services/transaction";
import { useAppToast } from "@/components/toast";
import { useDialog } from "@/components/dialog/provider";
import { useOverview } from "@/providers/OverviewProvider";
import useBalance from "./useBalance";

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
  } = useConfig();
  const { error: errorToast } = useAppToast();
  const { setOpen } = useDialog();
  const { creditBalance, setIsAwaitingCreditUpdate } = useOverview();
  const { updateCreditBalance } = useBalance();
  const [isProcessing, setIsProcessing] = useState(false);
  const pollingRef = useRef<{
    intervalId?: NodeJS.Timeout;
    initialBalance?: number;
  }>({});

  // Handle finality transaction processing
  useEffect(() => {
    if (
      showTransaction?.id &&
      showTransaction.status === "finality" &&
      showTransaction.txnHash &&
      !isProcessing
    ) {
      handleFinalityTransaction();
    }
  }, [
    showTransaction?.id,
    showTransaction?.status,
    showTransaction?.txnHash,
    isProcessing,
  ]);

  // Auto-complete transaction after delay
  useEffect(() => {
    if (showTransaction?.status === "finality" && !isProcessing) {
      const timer = setTimeout(() => {
        completeTransaction();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showTransaction?.status, showTransaction?.id, isProcessing]);

  const handleFinalityTransaction = async () => {
    if (!showTransaction?.txnHash || !showTransaction?.orderId || !token)
      return;

    setIsProcessing(true);

    try {
      const result = await TransactionService.handleTransactionFinality({
        txnHash: showTransaction.txnHash,
        orderId: showTransaction.orderId,
        token,
        chainType: showTransaction.chainType,
      });

      if (result.success) {
        completeTransaction();
        options?.onSuccess?.();
      } else {
        handleError(result.error || "Transaction failed");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Transaction failed";
      handleError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const completeTransaction = () => {
    if (!showTransaction) return;

    setTransactionStatusList((prev) =>
      prev.map((transaction: TransactionStatus) =>
        transaction.id === showTransaction.id
          ? { ...transaction, status: "completed" }
          : transaction
      )
    );
    setShowTransaction({ ...showTransaction, status: "completed" });

    // Start polling for credit balance updates
    startCreditBalancePolling();
  };

  const startCreditBalancePolling = () => {
    const initialBalance = creditBalance;
    pollingRef.current.initialBalance = initialBalance;
    setIsAwaitingCreditUpdate(true);
    console.log("Starting credit balance polling after transaction completion", { initialBalance });
    
    let pollCount = 0;
    const maxPolls = 24; // Poll for 2 minutes (every 5 seconds)
    
    const checkBalanceUpdate = async () => {
      pollCount++;
      console.log(`Credit balance poll attempt ${pollCount}/${maxPolls}`);
      
      try {
        await updateCreditBalance();
        
        if (pollCount >= maxPolls) {
          console.log("Credit balance polling timeout after 2 minutes");
          setIsAwaitingCreditUpdate(false);
          if (pollingRef.current.intervalId) {
            clearInterval(pollingRef.current.intervalId);
            pollingRef.current.intervalId = undefined;
          }
        }
      } catch (error) {
        console.log("Error during balance check:", error);
      }
    };
    
    pollingRef.current.intervalId = setInterval(checkBalanceUpdate, 5000);

    // Initial check after 2 seconds
    setTimeout(checkBalanceUpdate, 2000);
  };

  // Monitor credit balance changes to stop polling
  useEffect(() => {
    if (!pollingRef.current.intervalId || !pollingRef.current.initialBalance) {
      return;
    }

    if (creditBalance !== pollingRef.current.initialBalance) {
      console.log("Credit balance updated successfully", {
        previousBalance: pollingRef.current.initialBalance,
        newBalance: creditBalance
      });
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
    setOpen("");
    if (!showTransaction) return;
    // You can add additional logic here if needed
    setShowTransaction(undefined);
  };

  return {
    showTransaction,
    isProcessing,
    minimizeTransaction,
  };
};
