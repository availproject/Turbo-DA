import { APP_TABS, cn } from "@/lib/utils";
import { TransactionStatus, useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import { Maximize2, SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAccount } from "wagmi";
import Button from "../button";
import { useDialog } from "../dialog/provider";
import { Text } from "../text";
import {
  TRANSACTION_ACTIONS,
  TRANSACTION_MESSAGES,
} from "@/constants/transaction";
import { getExplorerUrl } from "@/utils/explorer";
import { ProgressBar } from "../transaction-progress/progress-bar";

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
  const { setShowTransaction, transactionStatusList } = useConfig();
  const [displayTransaction, setDisplayTransaction] = useState(transaction);

  // Sync displayTransaction with global transaction state
  useEffect(() => {
    const updatedTransaction = transactionStatusList.find(
      (t) => t.id === transaction.id
    );

    if (updatedTransaction) {
      setDisplayTransaction(updatedTransaction);
    }
  }, [transactionStatusList, transaction.id, displayTransaction.status]);

  // Auto-close toast after 2 seconds when transaction is completed
  useEffect(() => {
    if (displayTransaction?.status === "completed") {
      const timer = setTimeout(() => {
        // Trigger refresh when toast is dismissed
        window.dispatchEvent(
          new CustomEvent("transaction-completed", {
            detail: { transactionId: displayTransaction.id },
          })
        );
        toast.dismiss();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [displayTransaction?.status]);

  const handleExpandClick = () => {
    setMainTabSelected(APP_TABS.OVERVIEW);
    setOpen("credit-transaction");
    setShowTransaction(displayTransaction);
    toast.dismiss();
  };

  const getStatusMessage = () => {
    switch (displayTransaction.status) {
      case "initialised":
      case "broadcast":
        return TRANSACTION_MESSAGES.STATUS.BROADCAST;
      case "inblock":
        return TRANSACTION_MESSAGES.STATUS.INBLOCK;
      case "finality":
        return TRANSACTION_MESSAGES.STATUS.FINALITY;
      case "completed":
        return TRANSACTION_MESSAGES.STATUS.COMPLETED;
      default:
        return "";
    }
  };

  const getDescriptionMessage = () => {
    switch (displayTransaction.status) {
      case "initialised":
      case "broadcast":
        return TRANSACTION_MESSAGES.DESCRIPTIONS.BROADCAST;
      case "inblock":
        return TRANSACTION_MESSAGES.DESCRIPTIONS.INBLOCK;
      case "finality":
        return TRANSACTION_MESSAGES.DESCRIPTIONS.FINALITY;
      case "completed":
        return TRANSACTION_MESSAGES.DESCRIPTIONS.COMPLETED;
      default:
        return "";
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-y-3 px-4 py-3 flex-1 w-[530px] min-h-[130px]",
        className
      )}
    >
      {/* Header with title and expand button */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <Text weight="semibold" size="lg">
            {getStatusMessage()}
          </Text>
        </div>
        <Maximize2
          color="#B3B3B3"
          size={20}
          className="cursor-pointer mt-1"
          onClick={handleExpandClick}
        />
      </div>

      {/* Progress Bar */}
      <ProgressBar status={displayTransaction.status} className="w-fit" />

      {/* Description */}
      <Text weight="medium" variant="secondary-grey" size="sm">
        {getDescriptionMessage()}
      </Text>

      {/* Action buttons */}
      {displayTransaction.status !== "broadcast" && (
        <div className="flex gap-x-4 w-full">
          <Link
            href={getExplorerUrl(
              displayTransaction,
              account.chain?.blockExplorers?.default.url
            )}
            target="_blank"
            className="w-fit"
          >
            <Button
              variant="link"
              className="flex gap-x-1.5 items-center justify-center p-0"
            >
              <Text weight="semibold" size="sm">
                {TRANSACTION_ACTIONS.VIEW_EXPLORER}
              </Text>
              <SquareArrowOutUpRight color="#B3B3B3" size={16} />
            </Button>
          </Link>
          <Button
            variant="link"
            className="p-0"
            onClick={() => setMainTabSelected(APP_TABS.HISTORY)}
          >
            <Text weight="semibold" size="sm">
              {TRANSACTION_ACTIONS.VIEW_HISTORY}
            </Text>
          </Button>
        </div>
      )}
    </div>
  );
};

export default TransactionProgress;
