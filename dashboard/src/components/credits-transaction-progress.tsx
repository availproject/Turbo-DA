"use client";
import { APP_TABS } from "@/lib/utils";
import { useOverview } from "@/providers/OverviewProvider";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Close } from "@radix-ui/react-dialog";
import { LoaderCircle, Minus, SquareArrowOutUpRight, X } from "lucide-react";
import Link from "next/link";
import { useAccount } from "wagmi";
import Button from "./button";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { Text } from "./text";
import { Card, CardContent } from "./ui/card";
import { useTransactionProgress } from "@/hooks/useTransactionProgress";
import {
  TransactionStatusDisplay,
  TransactionDescription,
} from "./transaction-progress/transaction-status-display";
import { ProgressBar } from "./transaction-progress/progress-bar";
import {
  TRANSACTION_CONSTANTS,
  TRANSACTION_ACTIONS,
} from "@/constants/transaction";
import { useDialog } from "./dialog/provider";
import { getExplorerUrl } from "@/utils/explorer";

const CreditsTransactionProgress = () => {
  const { setMainTabSelected } = useOverview();
  const account = useAccount();
  const { open, setOpen } = useDialog();
  const { showTransaction, minimizeTransaction } = useTransactionProgress();

  const status = showTransaction?.status;

  return (
    <Dialog
      open={open === "credit-transaction"}
      onOpenChange={(value) => {
        if (!value) {
          minimizeTransaction();
        }
      }}
    >
      <DialogContent className="min-w-[600px] h-[400px] p-0 border-none rounded-3xl">
        <div className="shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden flex flex-col focus-within:outline-0 h-full w-full relative">
          <div className="bg-[url('/credits-added-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
          <Card className="relative w-full h-full bg-[#192a3d] rounded-2xl overflow-hidden border border-transparent">
            {status !== "completed" ? (
              <Close
                className="p-0 bg-transparent w-fit cursor-pointer ml-auto px-6"
                onClick={minimizeTransaction}
              >
                <Minus color="#FFF" size={32} strokeWidth={1} />
              </Close>
            ) : (
              <Close className="p-0 bg-transparent w-fit cursor-pointer absolute top-4 right-4 z-2">
                <X color="#FFF" size={24} strokeWidth={1} />
              </Close>
            )}

            <CardContent className="flex flex-col items-center justify-center h-full pt-0 w-[444px] mx-auto gap-y-4">
              <DialogTitle>
                {status === "completed" ? (
                  <DotLottieReact
                    src={"credit-added.lottie"}
                    autoplay
                    width={50}
                    height={50}
                    className="mx-auto"
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
                  <TransactionStatusDisplay
                    status={status || "broadcast"}
                    tokenAmount={showTransaction.tokenAmount}
                    className="relative self-stretch text-center"
                  />

                  {status !== "completed" && (
                    <ProgressBar status={status || "broadcast"} />
                  )}
                </>
              ) : (
                <TransactionStatusDisplay
                  status={status || "broadcast"}
                  className="relative self-stretch text-center"
                />
              )}

              <TransactionDescription status={status || "broadcast"} />

              {status !== "broadcast" && (
                <div className="flex gap-x-4 w-full justify-center">
                  <Link
                    href={getExplorerUrl(
                      showTransaction,
                      account.chain?.blockExplorers?.default.url
                    )}
                    target="_blank"
                    className="w-full"
                  >
                    <Button
                      variant="secondary"
                      className="flex gap-x-1.5 items-center justify-center"
                    >
                      <Text weight="semibold">
                        {TRANSACTION_ACTIONS.VIEW_EXPLORER}
                      </Text>
                      <SquareArrowOutUpRight
                        color="#B3B3B3"
                        size={24}
                        strokeWidth={2}
                      />
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    onClick={() => setMainTabSelected(APP_TABS.HISTORY)}
                  >
                    <Text weight="semibold">
                      {TRANSACTION_ACTIONS.VIEW_HISTORY}
                    </Text>
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
