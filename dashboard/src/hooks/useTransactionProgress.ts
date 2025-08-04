import { useEffect, useState } from "react";
import { TransactionStatus, useConfig } from "@/providers/ConfigProvider";
import { TransactionService } from "@/services/transaction";
import { useAppToast } from "@/components/toast";
import { useDialog } from "@/components/dialog/provider";

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
  const [isProcessing, setIsProcessing] = useState(false);

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
  };

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
