"use client";
import Button from "@/components/button";
import { useDialog } from "@/components/dialog/provider";
import { useAppToast } from "@/components/toast";
import { config } from "@/config/walletConfig";
import { supportedTokensAndChains } from "@/lib/types";
import { numberToBytes32 } from "@/lib/utils";
import { TransactionStatus, useConfig } from "@/providers/ConfigProvider";
import { useSwitchChain } from "wagmi";

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
import CreditService from "@/services/credit";
import { ErrorHandlingUtils } from "@/utils/errorHandling";

// Remove hardcoded chain - now using dynamic chain from user selection

// Helper function to get token info from supportedTokensAndChains
const getTokenInfo = (chainName: string, tokenName: string) => {
  const chainKey = chainName.toLowerCase();
  const chain = supportedTokensAndChains[chainKey];
  return chain?.tokens.find((token) => token.name === tokenName);
};

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
  const { switchChainAsync } = useSwitchChain();

  const handleBuyCredits = async ({ isAvail }: { isAvail: boolean }) => {
    if (!tokenAmount) return;

    try {
      setLoading(true);
      onBuyStart?.();

      if (!isAvail && selectedChain.id !== 0) {
        try {
          if (account.chainId !== selectedChain.id) {
            await switchChainAsync({ chainId: selectedChain.id });
          }
        } catch (error) {
          const errorMessage = ErrorHandlingUtils.getErrorMessage(error);
          errorToast?.({
            label:
              errorMessage ||
              `Please switch to ${selectedChain.name} network manually in your wallet`,
          });
          setLoading(false);
          onBuyError?.(errorMessage || "Chain switch failed");
          return;
        }
      }

      const tokenInfo =
        selectedToken && selectedChain
          ? getTokenInfo(selectedChain.name, selectedToken.name)
          : undefined;
      const tokenAddress = tokenInfo?.address;

      const orderResponse = await postOrder({
        token: token!,
        chainId: selectedChain.id,
      });

      if (!orderResponse?.data) {
        setLoading(false);
        const errorMessage = orderResponse.message || "Order creation failed";
        onBuyError?.(errorMessage);
        return;
      }

      if (isAvail) {
        let currentTransaction: TransactionStatus | undefined;

        const txn = await batchTransferAndRemark(
          api!,
          selected!,
          parseUnits(tokenAmount, 18).toString(),
          numberToBytes32(+orderResponse.data.id),
          // InBlock callback
          (txHash: string) => {
            console.log("Transaction in block detected:", txHash);
            // Update transaction status to inblock
            if (currentTransaction) {
              setTransactionStatusList((prev) =>
                prev.map((t) =>
                  t.id === currentTransaction!.id
                    ? {
                        ...t,
                        status: "inblock",
                        txnHash: txHash as `0x${string}`,
                      }
                    : t
                )
              );
              setShowTransaction({
                ...currentTransaction,
                status: "inblock",
                txnHash: txHash as `0x${string}`,
              });
            }
          },
          // Finalized callback
          (txHash: string) => {
            console.log("Transaction finalized detected:", txHash);
            if (currentTransaction) {
              setTransactionStatusList((prev) =>
                prev.map((t) =>
                  t.id === currentTransaction!.id
                    ? {
                        ...t,
                        status: "finality",
                        txnHash: txHash as `0x${string}`,
                      }
                    : t
                )
              );
              setShowTransaction({
                ...currentTransaction,
                status: "finality",
                txnHash: txHash as `0x${string}`,
              });
            }
          },
          // Broadcast callback
          (txHash: string) => {
            console.log("Transaction broadcast detected:", txHash);
            // Create transaction and show dialog as soon as transaction is broadcast
            currentTransaction = {
              id: uuidv4(),
              status: "broadcast",
              orderId: orderResponse.data.id as number,
              tokenAddress: tokenAddress! as `0x${string}`,
              tokenAmount: +tokenAmount,
              txnHash: txHash as `0x${string}`,
              chainType: "avail",
            };
            setTransactionStatusList((prev) => [
              ...(prev ?? []),
              currentTransaction!,
            ]);
            setShowTransaction(currentTransaction);
            setOpen("credit-transaction");
          }
        );

        if (txn.isOk()) {
          onTokenAmountClear?.();
          setLoading(false);
          onBuyComplete?.();
          return;
        } else {
          // Handle error
          const errorMessage = ErrorHandlingUtils.getErrorMessage(txn.error);
          errorToast?.({ label: errorMessage });
          setLoading(false);
          onBuyError?.(errorMessage);
          return;
        }
      }

      if (tokenAddress === "0x0000000000000000000000000000000000000000") {
        await writeContract(config, {
          address: process.env.NEXT_PUBLIC_ADDRESS as `0x${string}`,
          abi: depositAbi,
          functionName: "deposit",
          args: [numberToBytes32(+orderResponse?.data?.id)],
          chainId: selectedChain.id,
          value: parseUnits(tokenAmount, 18),
        })
          .then(async (txnHash: `0x${string}`) => {
            // Create transaction and show dialog only when transaction is sent
            const transaction: TransactionStatus = {
              id: uuidv4(),
              status: "inblock",
              orderId: orderResponse.data.id as number,
              tokenAddress: tokenAddress! as `0x${string}`,
              tokenAmount: +tokenAmount,
              txnHash,
              chainType: selectedChain.name.toLowerCase() as "ethereum" | "base",
            };
            setTransactionStatusList((prev) => [...(prev ?? []), transaction]);
            setShowTransaction(transaction);
            setOpen("credit-transaction");

            // Update to finality status when transaction is confirmed
            setTransactionStatusList((prev) =>
              prev.map((t) =>
                t.id === transaction.id
                  ? { ...t, status: "finality", txnHash }
                  : t
              )
            );
            setShowTransaction({ ...transaction, status: "finality", txnHash });

            onTokenAmountClear?.();
            setLoading(false);
            onBuyComplete?.();
          })
          .catch((err) => {
            const errorMessage = ErrorHandlingUtils.getErrorMessage(err);
            errorToast?.({ label: errorMessage });
            setLoading(false);
            onBuyError?.(errorMessage);
          });
      } else {
        await writeContract(config, {
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [
            process.env.NEXT_PUBLIC_ADDRESS as `0x${string}`,
            parseUnits(tokenAmount, 18),
          ],
          chainId: selectedChain.id,
        })
          .then(async () => {
            await writeContract(config, {
              address: process.env.NEXT_PUBLIC_ADDRESS as `0x${string}`,
              abi: depositAbi,
              functionName: "depositERC20",
              args: [
                numberToBytes32(+orderResponse?.data?.id),
                parseUnits(tokenAmount, 18),
                tokenAddress?.toLowerCase(),
              ],
              chainId: selectedChain.id,
            })
              .then(async (txnHash: `0x${string}`) => {
                // Create transaction and show dialog only when transaction is sent
                const transaction: TransactionStatus = {
                  id: uuidv4(),
                  status: "inblock",
                  orderId: orderResponse.data.id as number,
                  tokenAddress: tokenAddress! as `0x${string}`,
                  tokenAmount: +tokenAmount,
                  txnHash,
                  chainType: selectedChain.name.toLowerCase() as "ethereum" | "base",
                };
                setTransactionStatusList((prev) => [
                  ...(prev ?? []),
                  transaction,
                ]);
                setShowTransaction(transaction);
                setOpen("credit-transaction");

                // Update to finality status when transaction is confirmed
                setTransactionStatusList((prev) =>
                  prev.map((t) =>
                    t.id === transaction.id
                      ? { ...t, status: "finality", txnHash }
                      : t
                  )
                );
                setShowTransaction({
                  ...transaction,
                  status: "finality",
                  txnHash,
                });

                onTokenAmountClear?.();
                setLoading(false);
                onBuyComplete?.();
              })
              .catch((err) => {
                const errorMessage = ErrorHandlingUtils.getErrorMessage(err);
                errorToast?.({ label: errorMessage });
                setLoading(false);
                onBuyError?.(errorMessage);
              });
          })
          .catch((err) => {
            const errorMessage = ErrorHandlingUtils.getErrorMessage(err);
            errorToast?.({ label: errorMessage });
            setLoading(false);
            onBuyError?.(errorMessage);
          });
      }
    } catch (error) {
      console.log(error);
      const errorMessage = ErrorHandlingUtils.getErrorMessage(error);
      errorToast?.({ label: errorMessage });
      setLoading(false);
      onBuyError?.(errorMessage);
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

  if (
    (selectedChain?.name === "Ethereum" || selectedChain?.name === "Base") &&
    selectedToken
  ) {
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
        <Button>Connect Avail Wallet</Button>
      </AvailWalletConnect>
    );
  }

  return null;
};

export default BuyButton;
