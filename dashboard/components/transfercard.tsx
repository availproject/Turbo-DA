"use client";

import { Button, Input, Tag } from "degen";
import { Button as ShadcnButton } from "./ui/button";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import useWallet from "@/hooks/useWallet";;
import { toast } from "./ui/use-toast";
import { Copy, RotateCcw } from "lucide-react";
import { TokenSelector } from "./tokenselector";
import useTransfers from "@/hooks/useTransfers";
import { showFailedMessage, showSuccessMessage } from "@/utils/toasts";
import { useCommonStore } from "@/store/common";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function TransferCard() {
  /** UI STATE HOOKS */
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [balanceLoading, setBalanceLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  /** LOGIC HOOKS */
  const { showBalance } = useWallet();
  const { isConnected } = useAccount();
  const { initTransfer } = useTransfers();
  const { balance, setBalance, selectedToken, user, sessionToken } =
    useCommonStore();

  /** USE EFFECT HOOKS */
  useEffect(() => {
    if (!isConnected) return setBalance("...");
    const fetchBalance = async () => {
      setBalanceLoading(true);
      const balance = await showBalance({
        token: selectedToken.address as `0x${string}`,
      });
      balance && setBalance(balance.slice(0, 7));
      setBalanceLoading(false);
    };

    fetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, selectedToken.address, showBalance]);

  /** HELPER FUNCTIONS */
  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      toast({
        title: "Copied!",
        description: "Token address copied to clipboard",
      });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <>
      <div className="bg-[#1D1D1D] rounded-2xl p-6 mx-auto text-white lg:w-[70vw]  w-[90vw] md:[80vw] space-y-4 flex flex-col items-center justify-center">
        <h1 className="font-mono text-5xl font-bold flex flex-col space-y-1 ">
          <span>
            {user.assigned_wallet.substring(0, 4)}...
            {user.assigned_wallet.slice(-2)}
          </span>
        </h1>
        <h1 className="text-center font-mono italic text-lg font-extralight text-white text-opacity-60 mx-auto py-2">
          Your generated address for deposits
          <span className="text-white"></span>
          <ShadcnButton
            variant="ghost"
            size="icon"
            onClick={() => copyToClipboard(user.assigned_wallet, 1)}
            className="h-8 w-8 p-0"
          >
            <Copy
              className={`h-4 w-4 ${copiedId === 1 ? "text-green-500" : ""}`}
            />
            <span className="sr-only">Copy address</span>
          </ShadcnButton>
          <span className="text-white text-bold "> </span>
        </h1>
      </div>
      <div className="bg-[#1D1D1D]  rounded-2xl p-6 mx-auto text-white lg:w-[70vw] w-[90vw] md:[80vw]">
        {isConnected ? (
          <div className=" space-y-4 space-x-3 flex md:flex-row flex-col items-end justify-end">
            <div className="w-full flex">
              <Input
                label="Amount"
                min={0}
                value={amount}
                disabled={
                  !isConnected &&
                  !selectedToken.address &&
                  Number(amount) > Number(balance) &&
                  Number(amount) <= 0
                }
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10.34"
                error={
                  Number(amount) > Number(balance)
                    ? "Amount exceeds balance"
                    : ""
                }
                type="number"
                max={Number.isNaN(Number(balance)) ? 0 : Number(balance)}
                labelSecondary={
                  <Tag>
                    Balance: {balance}
                    {selectedToken.symbol}{" "}
                    <RotateCcw
                      className="w-4 h-4 cursor-pointer"
                      onClick={async () => {
                        if (!isConnected) return setBalance("...");
                        setBalance(
                          (await showBalance({
                            token: selectedToken.address as `0x${string}`,
                          }))!
                        );
                        showSuccessMessage({
                          title: "Balance Refreshed",
                          description: `Your balance for ${selectedToken.symbol} has been refreshed to ${balance}`,
                        });
                      }}
                    />
                  </Tag>
                }
                units={selectedToken.symbol}
              />
            </div>
            <div className="flex flex-row space-x-2 items-center justify-center">
              <br className="!h-[123rem]" />
              <Button
                size="small"
                loading={loading}
                variant="secondary"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const hash = await initTransfer({
                      tokenAddress: selectedToken.address,
                      amount: amount,
                    });
                    console.log(hash, "hash generated");
                    if (hash?.success) {
                      showSuccessMessage({ hash: hash?.hash });
                    }
                  } catch (error: any) {
                    console.error(error);
                    showFailedMessage({
                      title: "Transaction Failed",
                      description: error.message,
                    });
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Deposit
              </Button>
              <TokenSelector />
            </div>
          </div>
        ) : (
          <div className="flex md:flex-row flex-col items-center justify-between space-y-4 md:space-y-0">
            {" "}
            <h1 className="font-mono md:text-md text-sm font-thin ">
              Connect Your Wallet to Transfer More
            </h1>
            <ConnectButton />
          </div>
        )}
      </div>
    </>
  );
}
