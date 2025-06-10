"use client";
import Button from "@/components/button";
import { useDialog } from "@/components/dialog/provider";
import { useAppToast } from "@/components/toast";
import { config } from "@/config/walletConfig";
import { useDesiredChain } from "@/hooks/useDesiredChain";
import { TOKEN_MAP } from "@/lib/types";
import { numberToBytes32 } from "@/lib/utils";
import { TransactionStatus, useConfig } from "@/providers/ConfigProvider";

import { writeContract } from "@wagmi/core";
import {
  AvailWalletConnect,
  useAvailAccount,
  useAvailWallet,
} from "avail-wallet-sdk";
import { ConnectKitButton } from "connectkit";
import { LoaderCircle } from "lucide-react";
import { MouseEvent, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { erc20Abi, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { batchTransferAndRemark, postOrder } from "../utils";
import { depositAbi } from "../utils/constant";
import { ClickHandler } from "../utils/types";

const DESIRED_CHAIN = 11155111;

interface BuyButtonProps {
  tokenAmount: string;
  tokenAmountError: string;
  onBuyStart?: ClickHandler;
  onBuyComplete?: ClickHandler;
  onBuyError?: (error: string) => void;
  onTokenAmountClear?: ClickHandler;
  token?: string;
}

const BuyButton = ({
  tokenAmount,
  tokenAmountError,
  onBuyStart,
  onBuyComplete,
  onBuyError,
  onTokenAmountClear,
  token,
}: BuyButtonProps) => {
  const [loading, setLoading] = useState(false);
  const account = useAccount();
  const { selected } = useAvailAccount();
  const { api } = useAvailWallet();
  const { setOpen } = useDialog();
  const { error: errorToast } = useAppToast();
  const {
    selectedChain,
    selectedToken,
    setTransactionStatusList,
    setShowTransaction,
  } = useConfig();
  const { chainChangerAsync } = useDesiredChain(DESIRED_CHAIN);

  const handleBuyCredits = async ({ isAvail }: { isAvail: boolean }) => {
    if (!tokenAmount) return;

    try {
      setLoading(true);
      onBuyStart?.();

      const tokenAddress =
        selectedToken &&
        TOKEN_MAP[selectedToken?.name?.toLowerCase()].token_address;

      const orderResponse = await postOrder({
        token: token!,
        chainId: account.chainId || DESIRED_CHAIN,
      });

      if (!orderResponse?.data) {
        setLoading(false);
        const errorMessage = orderResponse.message || "Order creation failed";
        onBuyError?.(errorMessage);
        return;
      }

      if (isAvail) {
        const txn = await batchTransferAndRemark(
          api!,
          selected!,
          parseUnits(tokenAmount, 18).toString(),
          "Buy Credits",
        );

        if (txn.isOk()) {
          const transaction: TransactionStatus = {
            id: uuidv4(),
            status: "finality",
            orderId: orderResponse.data.id as number,
            tokenAddress: tokenAddress! as `0x${string}`,
            tokenAmount: +tokenAmount,
            txnHash: txn.value.txhash,
          };
          setTransactionStatusList((prev) => [...(prev ?? []), transaction]);
          setShowTransaction(transaction);
          setOpen("credit-transaction");
          onTokenAmountClear?.();
          setLoading(false);
          onBuyComplete?.();
          return;
        }
      }

      await writeContract(config, {
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [
          process.env.NEXT_PUBLIC_ADDRESS as `0x${string}`,
          parseUnits(tokenAmount, 18),
        ],
        chainId: account.chainId || DESIRED_CHAIN,
      })
        .then(async () => {
          await writeContract(config, {
            address: process.env.NEXT_PUBLIC_ADDRESS as `0x${string}`,
            abi: depositAbi,
            functionName: "depositERC20",
            args: [
              numberToBytes32(+orderResponse?.data?.id),
              parseUnits(tokenAmount, 18),
              tokenAddress,
            ],
            chainId: account.chainId || DESIRED_CHAIN,
          })
            .then(async (txnHash: `0x${string}`) => {
              const transaction: TransactionStatus = {
                id: uuidv4(),
                status: "finality",
                orderId: orderResponse.data.id as number,
                tokenAddress: tokenAddress! as `0x${string}`,
                tokenAmount: +tokenAmount,
                txnHash,
              };
              setTransactionStatusList((prev) => [
                ...(prev ?? []),
                transaction,
              ]);
              setShowTransaction(transaction);
              setOpen("credit-transaction");
              onTokenAmountClear?.();
              setLoading(false);
              onBuyComplete?.();
            })
            .catch((err) => {
              const message = err.message.split(".")[0];
              if (message === "User rejected the request") {
                errorToast?.({ label: "You rejected the request" });
              } else {
                errorToast?.({ label: "Transaction failed" });
              }
              setLoading(false);
              onBuyError?.(message);
            });
        })
        .catch((err) => {
          const message = err.message.split(".")[0];
          if (message === "User rejected the request") {
            errorToast?.({ label: "You rejected the request" });
          } else {
            errorToast?.({ label: message });
          }
          setLoading(false);
          onBuyError?.(message);
        });
    } catch (error) {
      console.log(error);
      setLoading(false);
      onBuyError?.(error instanceof Error ? error.message : "Unknown error");
    }
  };

  const handleClick = (e: MouseEvent, callback?: VoidFunction) => {
    e.preventDefault();
    e.stopPropagation();
    callback?.();
  };

  const isDisabled = () => {
    return (
      loading ||
      !selectedToken ||
      !selectedChain ||
      !tokenAmount ||
      tokenAmount === "0" ||
      tokenAmountError !== ""
    );
  };

  const getButtonVariant = () => {
    return isDisabled() ? "disabled" : "primary";
  };

  if (!selectedChain || !selectedToken) {
    return (
      <Button
        onClick={() => {
          setOpen("select-token");
        }}
      >
        Connect Wallet
      </Button>
    );
  }

  if (selectedChain?.name === "Ethereum" && selectedToken) {
    return (
      <ConnectKitButton.Custom>
        {(props) => {
          if (!props.isConnected) {
            return (
              <Button onClick={(e) => handleClick(e, props.show)}>
                Connect EVM Wallet
              </Button>
            );
          }

          if (!props.chain || props.chain?.id !== DESIRED_CHAIN) {
            return (
              <Button onClick={() => chainChangerAsync()}>Wrong Network</Button>
            );
          }

          return (
            <Button
              onClick={() => {
                handleBuyCredits({
                  isAvail: false,
                });
              }}
              variant={getButtonVariant()}
              disabled={isDisabled()}
            >
              {loading ? (
                <div className="flex gap-x-1 justify-center">
                  <LoaderCircle
                    className="animate-spin"
                    color="#fff"
                    size={24}
                  />
                  Waiting for confirmation
                </div>
              ) : (
                "Buy Now"
              )}
            </Button>
          );
        }}
      </ConnectKitButton.Custom>
    );
  }

  if (selectedChain?.name === "Avail" && selectedToken) {
    return (
      <AvailWalletConnect
        connectedChildren={
          <Button
            onClick={() => {
              handleBuyCredits({
                isAvail: true,
              });
            }}
            variant={getButtonVariant()}
            disabled={isDisabled()}
          >
            {loading ? (
              <div className="flex gap-x-1 justify-center">
                <LoaderCircle className="animate-spin" color="#fff" size={24} />
                Waiting for confirmation
              </div>
            ) : (
              "Buy Now"
            )}
          </Button>
        }
      >
        <Button>Connect Wallet</Button>
      </AvailWalletConnect>
    );
  }

  return null;
};

export default BuyButton;
