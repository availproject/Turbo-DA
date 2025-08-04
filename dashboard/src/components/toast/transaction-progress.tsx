import { APP_TABS, cn } from "@/lib/utils";
import { TransactionStatus, useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import {
  Check,
  LoaderCircle,
  Scaling,
  SquareArrowOutUpRight,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAccount } from "wagmi";
import Button from "../button";
import { useDialog } from "../dialog/provider";
import { Text } from "../text";
import { TransactionService } from "@/services/transaction";
import { TRANSACTION_ACTIONS } from "@/constants/transaction";
import { getExplorerUrl } from "@/utils/explorer";

type TransactionProgressProps = {
  transaction: TransactionStatus;
  className?: string;
};

const TransactionProgress = ({
  transaction,
  className,
}: TransactionProgressProps) => {
  const account = useAccount();
  const { setMainTabSelected } = useOverview();
  const { setOpen } = useDialog();
  const [error, setError] = useState("");
  const { setShowTransaction, token, setTransactionStatusList } = useConfig();
  const [displayTransaction, setDisplayTransaction] = useState(transaction);
  const [inProcess, setInProcess] = useState(false);
  const [status, setStatus] = useState<"failed" | "success">();

  useEffect(() => {
    if (displayTransaction?.id && displayTransaction.status === "finality") {
      handleFinalityTransaction();
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    displayTransaction?.id,
    displayTransaction?.status,
    displayTransaction?.txnHash,
  ]);

  const handleFinalityTransaction = async () => {
    if (!displayTransaction?.txnHash || !displayTransaction?.orderId || !token)
      return;

    try {
      setInProcess(true);

      const result = await TransactionService.handleTransactionFinality({
        txnHash: displayTransaction.txnHash,
        orderId: displayTransaction.orderId,
        token,
        chainType: displayTransaction.chainType,
      });

      if (result.success) {
        setStatus("success");
        setInProcess(false);
        updateTransactionStatus("completed");
      } else {
        setStatus("failed");
        setError(result.error || "Transaction failed");
      }
    } catch (err) {
      console.log(err);
      setStatus("failed");
      setError("Transaction failed");
    } finally {
      setInProcess(false);
    }
  };

  const updateTransactionStatus = (newStatus: TransactionStatus["status"]) => {
    setTransactionStatusList((prev) =>
      prev.map((transaction: TransactionStatus) =>
        transaction.id === displayTransaction?.id
          ? {
              ...transaction,
              status: newStatus,
            }
          : transaction
      )
    );
    setDisplayTransaction({
      ...displayTransaction,
      status: newStatus,
    });
  };

  return (
    <div
      className={cn(
        "flex gap-x-4 items-center px-4 py-3 h-[130px] flex-1 w-[530px]",
        className
      )}
    >
      {!inProcess && status === "success" && (
        <div className="bg-white rounded-lg p-2">
          <Check
            color="#1FC16B"
            size={24}
            strokeWidth={3}
            className="border-2 border-[#1FC16B] rounded-full p-0.5"
          />
        </div>
      )}
      {!inProcess && status === "failed" && (
        <div className="bg-white rounded-lg p-2">
          <X
            color="#ff7360"
            size={24}
            strokeWidth={3}
            className="border-2 border-[#ff7360] rounded-full p-0.5"
          />
        </div>
      )}
      {inProcess && !status && (
        <LoaderCircle
          className="animate-spin"
          color="#FFFFFF"
          size={48}
          strokeWidth={2}
        />
      )}
      <div className="flex flex-col gap-y-2 flex-1">
        <Text weight={"semibold"}>
          {transaction.status === "inblock" && "Credit Buying Initiated"}
          {transaction.status === "finality" && "Almost Done"}
          {transaction.status === "completed" && "Credited Successfully"}
        </Text>
        {transaction.status === "inblock" && (
          <Text weight={"medium"} variant={"secondary-grey"}>
            Processing transaction on Avail Chain
          </Text>
        )}
        {transaction.status === "finality" && (
          <Text weight={"medium"} variant={"secondary-grey"}>
            Processing transaction on Avail Chain
          </Text>
        )}
        {transaction.status === "completed" && (
          <Text weight={"medium"} variant={"secondary-grey"}>
            Transaction completed successfully
          </Text>
        )}
        {error && (
          <Text weight={"medium"} variant={"error"}>
            {error}
          </Text>
        )}
        {transaction.status !== "inblock" && (
          <div className="flex gap-x-4 w-full">
            <Link
              href={getExplorerUrl(
                transaction,
                account.chain?.blockExplorers?.default.url
              )}
              target="_blank"
              className="w-fit"
            >
              <Button
                variant={"link"}
                className="flex gap-x-1.5 items-center justify-center"
              >
                <Text weight={"semibold"} size={"sm"}>
                  {TRANSACTION_ACTIONS.VIEW_EXPLORER}
                </Text>
                <SquareArrowOutUpRight color="#B3B3B3" size={20} />
              </Button>
            </Link>
            <Button
              variant={"link"}
              onClick={() => setMainTabSelected(APP_TABS.HISTORY)}
            >
              <Text weight={"semibold"} size={"sm"}>
                {TRANSACTION_ACTIONS.VIEW_HISTORY}
              </Text>
            </Button>
          </div>
        )}
      </div>
      <Scaling
        color="#B3B3B3"
        size={24}
        className="cursor-pointer self-start"
        onClick={() => {
          setMainTabSelected(APP_TABS.OVERVIEW);
          setOpen("credit-transaction");
          setShowTransaction(displayTransaction);
          toast.dismiss();
        }}
      />
    </div>
  );
};

export default TransactionProgress;
