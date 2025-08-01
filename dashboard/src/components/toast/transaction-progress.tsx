import { config } from "@/config/walletConfig";
import { APP_TABS, cn } from "@/lib/utils";
import { TransactionStatus, useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import { waitForTransactionReceipt } from "@wagmi/core";
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
      finalityTransaction({ txnHash: displayTransaction.txnHash! });
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    displayTransaction?.id,
    displayTransaction?.status,
    displayTransaction?.txnHash,
  ]);

  const postInclusionDetails = async ({
    orderId,
    txnHash,
  }: {
    orderId: number;
    txnHash: string;
  }) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/add_inclusion_details`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: orderId,
          tx_hash: txnHash,
        }),
      }
    );

    if (!response.ok) {
      throw undefined;
    }

    return await response.json();
  };

  const finalityTransaction = async ({
    txnHash,
  }: {
    txnHash: `0x${string}`;
  }) => {
    if (!displayTransaction) return;
    try {
      setInProcess(true);

      const isAvailTransaction = txnHash.length !== 66;

      if (isAvailTransaction) {
        await postInclusionDetails({
          orderId: displayTransaction?.orderId,
          txnHash: txnHash,
        })
          .then(() => {
            setStatus("success");
            setInProcess(false);
            setTransactionStatusList((prev) =>
              prev.map((transaction: TransactionStatus) =>
                transaction.id === displayTransaction?.id
                  ? {
                      ...transaction,
                      status: "completed",
                    }
                  : transaction
              )
            );
            setDisplayTransaction({
              ...displayTransaction,
              status: "completed",
            });
          })
          .catch((error) => {
            console.log(error);
            setStatus("failed");
            setError("Transaction failed");
          });
      } else {
        const transactionReceipt = await waitForTransactionReceipt(config, {
          hash: txnHash,
        });

        if (transactionReceipt.status === "success") {
          await postInclusionDetails({
            orderId: displayTransaction?.orderId,
            txnHash: txnHash,
          })
            .then(() => {
              setStatus("success");
              setInProcess(false);
              setTransactionStatusList((prev) =>
                prev.map((transaction: TransactionStatus) =>
                  transaction.id === displayTransaction?.id
                    ? {
                        ...transaction,
                        status: "completed",
                      }
                    : transaction
                )
              );
              setDisplayTransaction({
                ...displayTransaction,
                status: "completed",
              });
            })
            .catch((error) => {
              console.log(error);
              setStatus("failed");
              setError("Transaction failed");
            });
        } else {
          setStatus("failed");
          setError("Transaction failed");
        }
      }
    } catch (err) {
      console.log(err);
      setStatus("failed");
      setError("Transaction failed");
    }
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
          {transaction.status === "initialised" && "Credit Buying Initiated"}
          {transaction.status === "finality" && "Finalization In Progress"}
          {transaction.status === "completed" && "Almost Done"}
        </Text>
        {error === "" ? (
          <div className="flex gap-x-2">
            <div
              className={cn(
                "bg-white rounded-full w-[84px] h-2 overflow-hidden"
              )}
            >
              <div
                className={cn(
                  "h-full bg-green rounded-full w-0",
                  transaction.status === "initialised" && "w-1/2",
                  (transaction.status === "finality" ||
                    transaction.status === "completed") &&
                    "w-full"
                )}
              ></div>
            </div>
            <div
              className={cn(
                "rounded-full w-[84px] h-2 overflow-hidden",
                transaction.status === "finality" ||
                  transaction.status === "completed"
                  ? "bg-white"
                  : "bg-[#999]"
              )}
            >
              <div
                className={cn(
                  "h-full bg-green rounded-full w-0",
                  transaction.status === "finality" && "w-1/2",
                  transaction.status === "completed" && "w-full"
                )}
              ></div>
            </div>
            <div
              className={cn(
                "rounded-full w-[84px] h-2 overflow-hidden",
                transaction.status === "completed" ? "bg-white" : "bg-[#999]"
              )}
            >
              <div
                className={cn(
                  "h-full bg-green rounded-full w-0",
                  transaction.status === "completed" && "w-11/12"
                )}
              ></div>
            </div>
          </div>
        ) : (
          <Text weight={"medium"} variant={"error"}>
            {error}
          </Text>
        )}
        <Text weight={"medium"} variant={"secondary-grey"}>
          Processing transaction on Avail Chain
        </Text>
        {transaction.status !== "initialised" && (
          <div className="flex gap-x-4 w-full">
            <Link
              href={
                account.chain?.blockExplorers?.default.url +
                "/tx/" +
                transaction?.txnHash
              }
              target="_blank"
              className="w-fit"
            >
              <Button
                variant={"link"}
                className="flex gap-x-1.5 items-center justify-center"
              >
                <Text weight={"semibold"} size={"sm"}>
                  View On Explorer
                </Text>
                <SquareArrowOutUpRight color="#B3B3B3" size={20} />
              </Button>
            </Link>
            <Button
              variant={"link"}
              onClick={() => setMainTabSelected(APP_TABS.HISTORY)}
            >
              <Text weight={"semibold"} size={"sm"}>
                View Credit History
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
