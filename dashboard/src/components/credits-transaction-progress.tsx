"use client";
import { config } from "@/config/walletConfig";
import { APP_TABS, cn } from "@/lib/utils";
import { TransactionStatus, useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Close } from "@radix-ui/react-dialog";
import { waitForTransactionReceipt } from "@wagmi/core";
import { LoaderCircle, Minus, SquareArrowOutUpRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import Button from "./button";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { useDialog } from "./dialog/provider";
import { Text } from "./text";
import { useAppToast } from "./toast";
import { Card, CardContent } from "./ui/card";

const CreditsTransactionProgress = () => {
  const { open, setOpen } = useDialog();
  const { transactionProgress, error } = useAppToast();
  const { setMainTabSelected } = useOverview();
  const {
    token,
    setTransactionStatusList,
    showTransaction,
    setShowTransaction,
  } = useConfig();
  const account = useAccount();

  useEffect(() => {
    if (
      showTransaction?.id &&
      showTransaction.status === "finality" &&
      showTransaction.txnHash
    ) {
      finalityTransaction({ txnHash: showTransaction.txnHash });
      return;
    }
  }, [showTransaction?.id, showTransaction?.status, showTransaction?.txnHash]);

  const postInclusionDetails = async ({
    orderId,
    txnHash,
  }: {
    orderId: number;
    txnHash: string;
  }) => {
    if (!token) {
      throw new Error("No authentication token available");
    }

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
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  };

  const finalityTransaction = async ({
    txnHash,
  }: {
    txnHash: `0x${string}`;
  }) => {
    if (!showTransaction || !txnHash) {
      return;
    }
    try {
      const isAvailTransaction = txnHash.length !== 66;

      if (isAvailTransaction) {
        await postInclusionDetails({
          orderId: showTransaction?.orderId,
          txnHash: txnHash,
        })
          .then(() => {
            setTransactionStatusList((prev) =>
              prev.map((transaction: TransactionStatus) =>
                transaction.id === showTransaction?.id
                  ? {
                      ...transaction,
                      status: "completed",
                    }
                  : transaction
              )
            );
            setShowTransaction({ ...showTransaction, status: "completed" });
          })
          .catch((error) => {
            console.log("AVAIL transaction error:", error);
            const errorMessage =
              error instanceof Error ? error.message : "Transaction failed";
            error?.({ label: errorMessage });
            setOpen("");
          });
      } else {
        const transactionReceipt = await waitForTransactionReceipt(config, {
          hash: txnHash,
        });

        if (transactionReceipt.status === "success") {
          await postInclusionDetails({
            orderId: showTransaction?.orderId,
            txnHash: txnHash,
          })
            .then(() => {
              setTransactionStatusList((prev) =>
                prev.map((transaction: TransactionStatus) =>
                  transaction.id === showTransaction?.id
                    ? {
                        ...transaction,
                        status: "completed",
                      }
                    : transaction
                )
              );
              setShowTransaction({ ...showTransaction, status: "completed" });
            })
            .catch((error) => {
              console.log(error);
              error?.({ label: "Transaction failed" });
              setOpen("");
            });
        } else {
          error?.({ label: "Transaction failed" });
          setOpen("");
        }
      }
    } catch (err) {
      console.log("Finality transaction error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Transaction failed";
      error?.({ label: errorMessage });
      setOpen("");
    }
  };

  const minimizeTransactions = () => {
    setOpen("");
    if (!showTransaction) return;
    transactionProgress({ transaction: showTransaction });
    setShowTransaction(undefined);
  };

  return (
    <Dialog
      open={"credit-transaction" === open}
      onOpenChange={(value) => {
        if (!value) {
          setOpen("");
        }
      }}
    >
      <DialogContent className="min-w-[600px] h-[400px] p-0 border-none rounded-3xl">
        <div className="shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden flex flex-col focus-within:outline-0 h-full w-full relative">
          <div className="bg-[url('/credits-added-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
          <Card className="relative w-full h-full bg-[#192a3d] rounded-2xl overflow-hidden border border-solid border-transparent">
            {showTransaction?.status !== "completed" ? (
              <Close
                className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer ml-auto px-6"
                onClick={minimizeTransactions}
              >
                <Minus color="#FFF" size={32} strokeWidth={1} />
              </Close>
            ) : (
              <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer absolute top-4 right-4 z-2">
                <X color="#FFF" size={24} strokeWidth={1} />
              </Close>
            )}

            <CardContent className="flex flex-col items-center justify-center h-full pt-0 w-[444px] mx-auto gap-y-4">
              <DialogTitle>
                {showTransaction?.status === "completed" ? (
                  <DotLottieReact
                    src={"credit-added.lottie"}
                    autoplay
                    width={50}
                    height={50}
                  />
                ) : (
                  <LoaderCircle
                    className="animate-spin mx-auto"
                    color="#fff"
                    size={48}
                  />
                )}
              </DialogTitle>
              {showTransaction?.tokenAmount ? (
                <>
                  <Text
                    weight={"semibold"}
                    size={"2xl"}
                    className="relative self-stretch text-center"
                  >
                    {showTransaction.status === "initialised" &&
                      "Credit Buying Initiated"}
                    {showTransaction.status === "finality" &&
                      "Finalization In Progress"}
                    {showTransaction.status === "completed" && "Almost Done"}
                  </Text>
                  <div className="flex gap-x-2">
                    <div
                      className={cn(
                        "bg-white rounded-full w-[84px] h-2 overflow-hidden"
                      )}
                    >
                      <div
                        className={cn(
                          "h-full bg-green rounded-full",
                          showTransaction.status === "initialised" && "w-1/2",
                          (showTransaction.status === "finality" ||
                            showTransaction.status === "completed") &&
                            "w-full"
                        )}
                      ></div>
                    </div>
                    <div
                      className={cn(
                        "rounded-full w-[84px] h-2 overflow-hidden",
                        showTransaction.status === "finality" ||
                          showTransaction.status === "completed"
                          ? "bg-white"
                          : "bg-[#999]"
                      )}
                    >
                      <div
                        className={cn(
                          "h-full bg-green w-0 rounded-full",
                          showTransaction.status === "finality" && "w-1/2",
                          showTransaction.status === "completed" && "w-full"
                        )}
                      ></div>
                    </div>
                    <div
                      className={cn(
                        "rounded-full w-[84px] h-2 overflow-hidden",
                        showTransaction.status === "completed"
                          ? "bg-white"
                          : "bg-[#999]"
                      )}
                    >
                      <div
                        className={cn(
                          "h-full bg-green w-0 rounded-full",
                          showTransaction.status === "completed" && "w-full"
                        )}
                      ></div>
                    </div>
                  </div>
                </>
              ) : (
                <Text
                  weight={"semibold"}
                  size={"2xl"}
                  as="div"
                  className="relative self-stretch text-center"
                >
                  <Text
                    as="span"
                    weight={"semibold"}
                    size={"2xl"}
                    variant={"green"}
                  >
                    1000 KB{" "}
                  </Text>
                  Credited Successfully
                </Text>
              )}

              {showTransaction?.status === "completed" ? (
                <Text
                  weight={"medium"}
                  size={"base"}
                  variant={"secondary-grey"}
                  className="relative self-stretch text-center"
                >
                  You can use these credits directly from the main balance or
                  assign it to individual apps.
                </Text>
              ) : (
                <Text
                  weight={"medium"}
                  size={"base"}
                  variant={"secondary-grey"}
                  className="relative self-stretch text-center"
                >
                  Processing transaction on Avail chain
                </Text>
              )}
              {showTransaction?.status !== "initialised" && (
                <div className="flex gap-x-4 w-full justify-center">
                  <Link
                    href={
                      account.chain?.blockExplorers?.default.url +
                      "/tx/" +
                      showTransaction?.txnHash
                    }
                    target="_blank"
                    className="w-full"
                  >
                    <Button
                      variant={"secondary"}
                      className="flex gap-x-1.5 items-center justify-center"
                    >
                      <Text weight={"semibold"}>View On Explorer</Text>
                      <SquareArrowOutUpRight
                        color="#B3B3B3"
                        size={24}
                        strokeWidth={2}
                      />
                    </Button>
                  </Link>
                  <Button
                    variant={"secondary"}
                    onClick={() => setMainTabSelected(APP_TABS.HISTORY)}
                  >
                    <Text weight={"semibold"}>View Credit History</Text>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreditsTransactionProgress;
