"use client";
import { config } from "@/config/walletConfig";
import { APP_TABS, cn, formatDataBytes } from "@/lib/utils";
import { TransactionStatus, useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import useBalance from "@/hooks/useBalance";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import Image from "next/image";
import { Close } from "@radix-ui/react-dialog";
import { waitForTransactionReceipt } from "@wagmi/core";
import { LoaderCircle, Minus, SquareArrowOutUpRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  const { updateCreditBalance } = useBalance();
  const {
    token,
    setTransactionStatusList,
    showTransaction,
    setShowTransaction,
  } = useConfig();
  const account = useAccount();

  // State to control initial animation
  const [shouldAnimate, setShouldAnimate] = useState(false);

  // Start animation after dialog opens
  useEffect(() => {
    if (showTransaction?.status === "initialised") {
      // Small delay to allow dialog to render, then start animation
      setTimeout(() => setShouldAnimate(true), 100);
    }
  }, [showTransaction?.status]);

  // Handle finality state - start blockchain monitoring
  useEffect(() => {
    if (showTransaction?.id && showTransaction.status === "finality") {
      finalityTransaction({ txnHash: showTransaction.txnHash! });
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
    if (!showTransaction) return;

    // After 3 seconds, update to "Almost Done" status
    setTimeout(() => {
      const almostDoneTransaction = {
        ...showTransaction,
        status: "almost_done" as const,
      };
      setTransactionStatusList((prev) =>
        prev.map((transaction: TransactionStatus) =>
          transaction.id === showTransaction?.id
            ? almostDoneTransaction
            : transaction
        )
      );
      setShowTransaction(almostDoneTransaction);
    }, 3000);

    try {
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
            
            // Refresh credit balance after successful transaction
            updateCreditBalance();
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
    } catch (err) {
      console.log(err);
      error?.({ label: "Transaction failed" });
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
                  <Image
                    src="/credit-success.svg"
                    alt="Credit Success"
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
                  {showTransaction?.status === "completed" ? (
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
                        {showTransaction?.creditAmount
                          ? formatDataBytes(showTransaction.creditAmount)
                          : ""}
                      </Text>
                      Credited Successfully
                    </Text>
                  ) : (
                    <>
                      <Text
                        weight={"semibold"}
                        size={"2xl"}
                        className="relative self-stretch text-center"
                      >
                        {showTransaction?.status === "initialised" &&
                          "Credit Buying Initiated"}
                        {showTransaction?.status === "finality" &&
                          "Finalization In Progress"}
                        {showTransaction?.status === "almost_done" &&
                          "Almost Done"}
                      </Text>
                      <div className="flex gap-x-2">
                        {/* First Progress Bar - Credit Buying Initiated */}
                        <div className="bg-white rounded-full w-[84px] h-2 overflow-hidden">
                          <div
                            className={cn(
                              "h-full bg-green rounded-full transition-all duration-2000 ease-in-out w-0",
                              showTransaction?.status === "initialised" &&
                                shouldAnimate &&
                                "w-full",
                              (showTransaction?.status === "finality" ||
                                showTransaction?.status === "almost_done") &&
                                "w-full"
                            )}
                          ></div>
                        </div>

                        {/* Second Progress Bar - Finalization In Progress */}
                        <div
                          className={cn(
                            "rounded-full w-[84px] h-2 overflow-hidden transition-colors duration-500",
                            showTransaction?.status === "finality" ||
                              showTransaction?.status === "almost_done"
                              ? "bg-white"
                              : "bg-[#999]"
                          )}
                        >
                          <div
                            className={cn(
                              "h-full bg-green rounded-full transition-all duration-2000 ease-in-out w-0",
                              (showTransaction?.status === "finality" ||
                                showTransaction?.status === "almost_done") &&
                                "w-full"
                            )}
                          ></div>
                        </div>

                        {/* Third Progress Bar - Almost Done */}
                        <div
                          className={cn(
                            "rounded-full w-[84px] h-2 overflow-hidden transition-colors duration-500",
                            showTransaction?.status === "almost_done"
                              ? "bg-white"
                              : "bg-[#999]"
                          )}
                        >
                          <div
                            className={cn(
                              "h-full bg-green rounded-full transition-all duration-2000 ease-in-out w-0",
                              showTransaction?.status === "almost_done" &&
                                "w-full"
                            )}
                          ></div>
                        </div>
                      </div>
                    </>
                  )}
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
                    {showTransaction?.creditAmount
                      ? formatDataBytes(showTransaction.creditAmount)
                      : "1000 KB"}{" "}
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
                  {(showTransaction?.status === "initialised" ||
                    showTransaction?.status === "finality" ||
                    showTransaction?.status === "almost_done") &&
                    "Processing transaction on Avail chain"}
                </Text>
              )}
              {showTransaction?.status !== "completed" && (
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
