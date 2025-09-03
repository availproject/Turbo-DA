"use client";
import Button from "@/components/button";
import { useDialog } from "@/components/dialog/provider";
import { useAppToast } from "@/components/toast";
import { config } from "@/config/walletConfig";
import { supportedTokensAndChains } from "@/lib/types";
import { numberToBytes32 } from "@/lib/utils";
import { TransactionStatus, useConfig } from "@/providers/ConfigProvider";
import { useSwitchChain } from "wagmi";
import { useOverview } from "@/providers/OverviewProvider";
import useBalance from "@/hooks/useBalance";

import { writeContract } from "@wagmi/core";
import {
  AvailWalletConnect,
  useAvailAccount,
  useAvailWallet,
} from "avail-wallet-sdk";
import { ConnectKitButton } from "connectkit";
import { LoaderCircle } from "lucide-react";
import { MouseEvent, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { erc20Abi, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { batchTransferAndRemark, postOrder } from "../utils";
import { depositAbi } from "../utils/constant";
import { ClickHandler } from "../utils/types";
import { ErrorHandlingUtils } from "@/utils/errorHandling";
import { TransactionService } from "@/services/transaction";

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
  const { creditBalance, setIsAwaitingCreditUpdate } = useOverview();
  const { updateCreditBalance } = useBalance();

  const latestBalanceRef = useRef<number>(creditBalance);
  const initialBalanceRef = useRef<number | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log("BALANCE POLLING: effect observed creditBalance", {
      creditBalance,
      latestRef: latestBalanceRef.current,
      initialRef: initialBalanceRef.current,
    });
    latestBalanceRef.current = creditBalance;
    if (
      initialBalanceRef.current !== null &&
      latestBalanceRef.current > initialBalanceRef.current
    ) {
      console.log(
        "BALANCE POLLING: Detected increase via effect, stopping polling"
      );
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      setIsAwaitingCreditUpdate(false);
      initialBalanceRef.current = null;
    }
  }, [creditBalance, setIsAwaitingCreditUpdate]);

  const startCreditBalancePolling = (initialBalance: number) => {
    console.log("BALANCE POLLING: Starting credit balance polling");
    console.log("BALANCE POLLING: Initial balance is", initialBalance);
    setIsAwaitingCreditUpdate(true);

    initialBalanceRef.current = Number(initialBalance);
    let pollCount = 0;
    const maxPolls = 24; // Poll for 2 minutes (every 5 seconds)

    const checkBalanceUpdate = async () => {
      pollCount++;
      console.log(`BALANCE POLLING: Poll attempt ${pollCount}/${maxPolls}`);

      try {
        await updateCreditBalance();

        // Immediate check after state turn with a short delay to allow context propagation
        setTimeout(() => {
          const latest = Number(latestBalanceRef.current ?? 0);
          const initial = Number(initialBalanceRef.current ?? 0);
          console.log("BALANCE POLLING: post-refetch values", {
            latest,
            initial,
          });
          if (initialBalanceRef.current !== null && latest > initial) {
            console.log(
              "BALANCE POLLING: Balance increased (inline check). Stopping."
            );
            if (intervalIdRef.current) {
              clearInterval(intervalIdRef.current);
              intervalIdRef.current = null;
            }
            setIsAwaitingCreditUpdate(false);
            initialBalanceRef.current = null;
            return;
          }

          if (pollCount >= maxPolls) {
            console.log("BALANCE POLLING: Max polls reached, stopping polling");
            if (intervalIdRef.current) {
              clearInterval(intervalIdRef.current);
              intervalIdRef.current = null;
            }
            setIsAwaitingCreditUpdate(false);
            initialBalanceRef.current = null;
          }
        }, 150);
      } catch (error) {
        console.log("BALANCE POLLING: Balance update failed", error);
      }
    };

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    intervalIdRef.current = setInterval(checkBalanceUpdate, 5000);

    // Initial check after 2 seconds
    setTimeout(() => {
      console.log("BALANCE POLLING: Running initial balance check");
      checkBalanceUpdate();
    }, 2000);

    // Safety stop after 2 minutes
    setTimeout(() => {
      console.log("BALANCE POLLING: Timeout reached, clearing interval");
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      setIsAwaitingCreditUpdate(false);
      initialBalanceRef.current = null;
    }, 120000);
  };

  const handleBuyCredits = async ({ isAvail }: { isAvail: boolean }) => {
    console.log("BUY_FLOW: Starting handleBuyCredits", {
      isAvail,
      tokenAmount,
    });

    if (!tokenAmount) {
      console.log("BUY_FLOW: No token amount provided, returning early");
      return;
    }

    try {
      console.log("BUY_FLOW: Setting loading state and calling onBuyStart");
      setLoading(true);
      onBuyStart?.();

      // Capture initial balance at transaction start
      const initialTransactionBalance = creditBalance;
      console.log(
        "BUY_FLOW: Initial balance captured:",
        initialTransactionBalance
      );

      // Chain switching logic for non-Avail chains
      if (!isAvail && selectedChain.id !== 0) {
        console.log(
          "BUY_FLOW: Non-Avail chain detected, checking chain switch",
          {
            currentChainId: account.chainId,
            targetChainId: selectedChain.id,
            selectedChainName: selectedChain.name,
          }
        );

        try {
          if (account.chainId !== selectedChain.id) {
            console.log("BUY_FLOW: Chain switch required, initiating switch");
            await switchChainAsync({ chainId: selectedChain.id });
            console.log("BUY_FLOW: Chain switch successful");
          } else {
            console.log("BUY_FLOW: Already on correct chain");
          }
        } catch (error) {
          console.error("BUY_FLOW: Chain switch failed", error);
          const errorMessage = ErrorHandlingUtils.getErrorMessage(error);
          console.error("BUY_FLOW: Chain switch error message:", errorMessage);
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

      // Get token information
      const tokenInfo =
        selectedToken && selectedChain
          ? getTokenInfo(selectedChain.name, selectedToken.name)
          : undefined;
      const tokenAddress = tokenInfo?.address;

      console.log("BUY_FLOW: Token info retrieved", {
        tokenInfo,
        tokenAddress,
        selectedChain: selectedChain.name,
        selectedToken: selectedToken?.name,
      });

      // Create order
      console.log("BUY_FLOW: Creating order", {
        token: token,
        chainId: selectedChain.id,
      });

      const orderResponse = await postOrder({
        token: token!,
        chainId: selectedChain.id,
      });

      console.log("BUY_FLOW: Order response received", orderResponse);

      if (!orderResponse?.data) {
        console.error(
          "BUY_FLOW: Order creation failed - no data in response",
          orderResponse
        );
        setLoading(false);
        const errorMessage = orderResponse.message || "Order creation failed";
        console.error("BUY_FLOW: Order error message:", errorMessage);
        onBuyError?.(errorMessage);
        return;
      }

      console.log("BUY_FLOW: Order created successfully", {
        orderId: orderResponse.data.id,
        orderData: orderResponse.data,
      });

      // Avail transaction flow
      if (isAvail) {
        console.log("BUY_FLOW: Starting Avail transaction flow");
        let currentTransaction: TransactionStatus | undefined;

        console.log("BUY_FLOW: Calling batchTransferAndRemark with params", {
          tokenAmount,
          orderId: orderResponse.data.id,
          parsedAmount: parseUnits(tokenAmount, 18).toString(),
        });

        const txn = await batchTransferAndRemark(
          api!,
          selected!,
          parseUnits(tokenAmount, 18).toString(),
          numberToBytes32(+orderResponse.data.id),
          // InBlock callback
          (txHash: string, blockHash: string) => {
            console.log("BUY_FLOW: Avail InBlock callback triggered", {
              txHash,
              blockHash,
              currentTransactionId: currentTransaction?.id,
            });

            // Update transaction status to inblock
            if (currentTransaction) {
              console.log("BUY_FLOW: Updating transaction to inblock status");
              setTransactionStatusList((prev) =>
                prev.map((t) =>
                  t.id === currentTransaction!.id
                    ? {
                        ...t,
                        status: "inblock",
                        txnHash: txHash as `0x${string}`,
                        blockhash: blockHash as `0x${string}`,
                      }
                    : t
                )
              );
              setShowTransaction({
                ...currentTransaction,
                status: "inblock",
                txnHash: txHash as `0x${string}`,
                blockhash: blockHash as `0x${string}`,
              });
            } else {
              console.warn(
                "BUY_FLOW: No currentTransaction found in InBlock callback"
              );
            }
          },
          // Finalized callback
          (txHash: string) => {
            console.log("BUY_FLOW: Avail Finalized callback triggered", {
              txHash,
              currentTransactionId: currentTransaction?.id,
            });

            if (currentTransaction) {
              console.log("BUY_FLOW: Updating transaction to finality status");
              setTransactionStatusList((prev) => {
                const updated = prev.map((t) =>
                  t.id === currentTransaction!.id
                    ? {
                        ...t,
                        status: "finality" as const,
                        txnHash: txHash as `0x${string}`,
                      }
                    : t
                );
                console.log(
                  "BUY_FLOW: Transaction list updated to finality",
                  updated
                );
                return updated;
              });

              const finalizedTransaction = {
                ...currentTransaction,
                status: "finality" as const,
                txnHash: txHash as `0x${string}`,
              };

              setShowTransaction(finalizedTransaction);
              console.log(
                "BUY_FLOW: Show transaction updated to finality",
                finalizedTransaction
              );

              console.log("BUY_FLOW: Setting completion timeout (2000ms)");
              const completionTimeoutId = setTimeout(() => {
                console.log(
                  "BUY_FLOW: Completion timeout triggered, updating to completed status"
                );
                const completedTransaction = {
                  ...currentTransaction!,
                  status: "completed" as const,
                };

                setTransactionStatusList((prev) => {
                  const updated = prev.map((t) =>
                    t.id === currentTransaction!.id ? completedTransaction : t
                  );
                  console.log(
                    "BUY_FLOW: Transaction list updated to completed",
                    updated
                  );
                  return updated;
                });

                setShowTransaction(completedTransaction);
                console.log(
                  "BUY_FLOW: Show transaction updated to completed",
                  completedTransaction
                );

                // Start credit balance polling to show the warning message
                console.log("BUY_FLOW: Starting credit balance polling", {
                  initialTransactionBalance,
                });
                startCreditBalancePolling(initialTransactionBalance);

                console.log("BUY_FLOW: Setting cleanup timeout (4000ms)");
                const cleanupTimeoutId = setTimeout(() => {
                  console.log(
                    "BUY_FLOW: Cleanup timeout triggered, removing transaction from list"
                  );
                  setTransactionStatusList((prev) =>
                    prev.filter((t) => t.id !== currentTransaction!.id)
                  );
                  setShowTransaction(undefined);
                  setOpen("");
                  console.log("BUY_FLOW: Transaction cleanup completed");
                }, 4000);

                return () => {
                  console.log("BUY_FLOW: Cleaning up cleanup timeout");
                  clearTimeout(cleanupTimeoutId);
                };
              }, 2000);

              return () => {
                console.log("BUY_FLOW: Cleaning up completion timeout");
                clearTimeout(completionTimeoutId);
              };
            } else {
              console.warn(
                "BUY_FLOW: No currentTransaction found in Finalized callback"
              );
            }
          },
          // Broadcast callback
          (txHash: string) => {
            console.log("BUY_FLOW: Avail Broadcast callback triggered", {
              txHash,
            });

            currentTransaction = {
              id: uuidv4(),
              status: "broadcast",
              orderId: orderResponse.data.id as number,
              tokenAddress: tokenAddress! as `0x${string}`,
              tokenAmount: +tokenAmount,
              txnHash: txHash as `0x${string}`,
              chainType: "avail",
            };

            console.log(
              "BUY_FLOW: Created new transaction object",
              currentTransaction
            );

            setTransactionStatusList((prev) => [
              ...(prev ?? []),
              currentTransaction!,
            ]);
            setShowTransaction(currentTransaction);
            setOpen("credit-transaction");

            console.log("BUY_FLOW: Transaction added to list and UI updated");
          }
        );

        console.log("BUY_FLOW: batchTransferAndRemark completed", {
          isOk: txn.isOk(),
          error: txn.isOk() ? null : txn.error,
        });

        if (txn.isOk()) {
          console.log("BUY_FLOW: Avail transaction successful, cleaning up");
          onTokenAmountClear?.();
          setLoading(false);
          onBuyComplete?.();
          return;
        } else {
          // Handle error
          console.error("BUY_FLOW: Avail transaction failed", txn.error);
          const errorMessage = ErrorHandlingUtils.getErrorMessage(txn.error);
          console.error(
            "BUY_FLOW: Avail transaction error message:",
            errorMessage
          );
          errorToast?.({ label: errorMessage });
          setLoading(false);
          onBuyError?.(errorMessage);
          return;
        }
      }

      // EVM transaction flow
      console.log("BUY_FLOW: Starting EVM transaction flow", {
        tokenAddress,
        isNativeToken:
          tokenAddress === "0x0000000000000000000000000000000000000000",
      });

      // Native token (ETH) deposit
      if (tokenAddress === "0x0000000000000000000000000000000000000000") {
        console.log("BUY_FLOW: Processing native token deposit");

        try {
          console.log("BUY_FLOW: Calling native deposit contract", {
            address: process.env.NEXT_PUBLIC_ADDRESS,
            orderId: orderResponse?.data?.id,
            value: parseUnits(tokenAmount, 18),
            chainId: selectedChain.id,
          });

          const txnHash = await writeContract(config, {
            address: process.env.NEXT_PUBLIC_ADDRESS as `0x${string}`,
            abi: depositAbi,
            functionName: "deposit",
            args: [numberToBytes32(+orderResponse?.data?.id)],
            chainId: selectedChain.id,
            value: parseUnits(tokenAmount, 18),
          });

          console.log("BUY_FLOW: Native deposit transaction hash received", {
            txnHash,
          });

          const transaction: TransactionStatus = {
            id: uuidv4(),
            status: "broadcast",
            orderId: orderResponse.data.id as number,
            tokenAddress: tokenAddress! as `0x${string}`,
            tokenAmount: +tokenAmount,
            txnHash,
            chainType: selectedChain.name.toLowerCase() as "ethereum" | "base",
          };

          console.log(
            "BUY_FLOW: Created native deposit transaction object",
            transaction
          );

          setTransactionStatusList((prev) => [...(prev ?? []), transaction]);
          setShowTransaction(transaction);
          setOpen("credit-transaction");

          console.log("BUY_FLOW: Native deposit transaction added to UI");

          // Progress to inblock after a short delay
          console.log(
            "BUY_FLOW: Setting inblock timeout (1000ms) for native deposit"
          );
          setTimeout(() => {
            console.log(
              "BUY_FLOW: Updating native deposit transaction to inblock"
            );
            setTransactionStatusList((prev) => {
              const updated = prev.map((t) =>
                t.id === transaction.id
                  ? { ...t, status: "inblock" as const }
                  : t
              );
              console.log(
                "BUY_FLOW: Native deposit transaction list updated to inblock",
                updated
              );
              return updated;
            });

            setShowTransaction((prevShow) => {
              if (prevShow && prevShow.id === transaction.id) {
                const updated = { ...prevShow, status: "inblock" as const };
                console.log(
                  "BUY_FLOW: Native deposit show transaction updated to inblock",
                  updated
                );
                return updated;
              }
              return prevShow;
            });
          }, 1000);

          // Call inclusion API for EVM transaction
          console.log(
            "BUY_FLOW: Calling TransactionService.handleTransactionFinality for native deposit",
            {
              txnHash,
              orderId: orderResponse.data.id,
              token: token,
              chainType: selectedChain.name.toLowerCase(),
            }
          );

          TransactionService.handleTransactionFinality({
            txnHash,
            orderId: orderResponse.data.id as number,
            token: token!,
            chainType: selectedChain.name.toLowerCase() as "ethereum" | "base",
            onSuccess: () => {
              console.log(
                "BUY_FLOW: Native deposit finality service success callback triggered"
              );

              // Update transaction to finality status to trigger 2-second UI timer
              setTimeout(() => {
                console.log(
                  "BUY_FLOW: Updating native deposit transaction to finality (2000ms delay)"
                );
                setTransactionStatusList((prev) => {
                  const updated = prev.map((t) =>
                    t.id === transaction.id
                      ? { ...t, status: "finality" as const }
                      : t
                  );
                  console.log(
                    "BUY_FLOW: Native deposit transaction list updated to finality",
                    updated
                  );
                  return updated;
                });

                setShowTransaction((prevShow) => {
                  if (prevShow && prevShow.id === transaction.id) {
                    const updated = {
                      ...prevShow,
                      status: "finality" as const,
                    };
                    console.log(
                      "BUY_FLOW: Native deposit show transaction updated to finality",
                      updated
                    );
                    return updated;
                  }
                  return prevShow;
                });

                setTimeout(() => {
                  console.log(
                    "BUY_FLOW: Updating native deposit transaction to completed (2000ms delay)"
                  );
                  setTransactionStatusList((prev) => {
                    const updated = prev.map((t) =>
                      t.id === transaction.id
                        ? { ...t, status: "completed" as const }
                        : t
                    );
                    console.log(
                      "BUY_FLOW: Native deposit transaction list updated to completed",
                      updated
                    );
                    return updated;
                  });

                  setShowTransaction((prevShow) => {
                    if (prevShow && prevShow.id === transaction.id) {
                      const completedTx = {
                        ...prevShow,
                        status: "completed" as const,
                      };
                      console.log(
                        "BUY_FLOW: Native deposit show transaction updated to completed",
                        completedTx
                      );
                      return completedTx;
                    }
                    return prevShow;
                  });

                  // Start credit balance polling to show the warning message
                  console.log(
                    "BUY_FLOW: Starting credit balance polling for native deposit",
                    {
                      initialTransactionBalance,
                    }
                  );
                  startCreditBalancePolling(initialTransactionBalance);

                  setTimeout(() => {
                    console.log(
                      "BUY_FLOW: Cleaning up native deposit transaction (4000ms delay)"
                    );
                    setTransactionStatusList((prev) =>
                      prev.filter((t) => t.id !== transaction.id)
                    );
                    setShowTransaction(undefined);
                    setOpen("");
                    console.log(
                      "BUY_FLOW: Native deposit transaction cleanup completed"
                    );
                  }, 4000);
                }, 2000);
              }, 2000);
            },
          });

          console.log("BUY_FLOW: Native deposit flow completed successfully");
          onTokenAmountClear?.();
          setLoading(false);
          onBuyComplete?.();
        } catch (err) {
          console.error("BUY_FLOW: Native deposit transaction failed", err);
          const errorMessage = ErrorHandlingUtils.getErrorMessage(err);
          console.error(
            "BUY_FLOW: Native deposit error message:",
            errorMessage
          );
          errorToast?.({ label: errorMessage });
          setLoading(false);
          onBuyError?.(errorMessage);
        }
      } else {
        // ERC20 token deposit
        console.log("BUY_FLOW: Processing ERC20 token deposit");

        try {
          // First approve the token
          console.log("BUY_FLOW: Calling ERC20 approve", {
            tokenAddress,
            spender: process.env.NEXT_PUBLIC_ADDRESS,
            amount: parseUnits(tokenAmount, 18),
            chainId: selectedChain.id,
          });

          await writeContract(config, {
            address: tokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: "approve",
            args: [
              process.env.NEXT_PUBLIC_ADDRESS as `0x${string}`,
              parseUnits(tokenAmount, 18),
            ],
            chainId: selectedChain.id,
          });

          console.log("BUY_FLOW: ERC20 approve successful");

          // Then deposit the ERC20 token
          console.log("BUY_FLOW: Calling ERC20 depositERC20", {
            address: process.env.NEXT_PUBLIC_ADDRESS,
            orderId: orderResponse?.data?.id,
            amount: parseUnits(tokenAmount, 18),
            tokenAddress: tokenAddress?.toLowerCase(),
            chainId: selectedChain.id,
          });

          const txnHash = await writeContract(config, {
            address: process.env.NEXT_PUBLIC_ADDRESS as `0x${string}`,
            abi: depositAbi,
            functionName: "depositERC20",
            args: [
              numberToBytes32(+orderResponse?.data?.id),
              parseUnits(tokenAmount, 18),
              tokenAddress?.toLowerCase(),
            ],
            chainId: selectedChain.id,
          });

          console.log("BUY_FLOW: ERC20 deposit transaction hash received", {
            txnHash,
          });

          const transaction: TransactionStatus = {
            id: uuidv4(),
            status: "broadcast",
            orderId: orderResponse.data.id as number,
            tokenAddress: tokenAddress! as `0x${string}`,
            tokenAmount: +tokenAmount,
            txnHash,
            chainType: selectedChain.name.toLowerCase() as "ethereum" | "base",
          };

          console.log(
            "BUY_FLOW: Created ERC20 deposit transaction object",
            transaction
          );

          setTransactionStatusList((prev) => [...(prev ?? []), transaction]);
          setShowTransaction(transaction);
          setOpen("credit-transaction");

          console.log("BUY_FLOW: ERC20 deposit transaction added to UI");

          // Progress to inblock after a short delay
          console.log(
            "BUY_FLOW: Setting inblock timeout (1000ms) for ERC20 deposit"
          );
          setTimeout(() => {
            console.log(
              "BUY_FLOW: Updating ERC20 deposit transaction to inblock"
            );
            setTransactionStatusList((prev) => {
              const updated = prev.map((t) =>
                t.id === transaction.id
                  ? { ...t, status: "inblock" as const }
                  : t
              );
              console.log(
                "BUY_FLOW: ERC20 deposit transaction list updated to inblock",
                updated
              );
              return updated;
            });

            setShowTransaction((prevShow) => {
              if (prevShow && prevShow.id === transaction.id) {
                const updated = { ...prevShow, status: "inblock" as const };
                console.log(
                  "BUY_FLOW: ERC20 deposit show transaction updated to inblock",
                  updated
                );
                return updated;
              }
              return prevShow;
            });
          }, 1000);

          // Call inclusion API for EVM ERC20 transaction
          console.log(
            "BUY_FLOW: Calling TransactionService.handleTransactionFinality for ERC20 deposit",
            {
              txnHash,
              orderId: orderResponse.data.id,
              token: token,
              chainType: selectedChain.name.toLowerCase(),
            }
          );

          TransactionService.handleTransactionFinality({
            txnHash,
            orderId: orderResponse.data.id as number,
            token: token!,
            chainType: selectedChain.name.toLowerCase() as "ethereum" | "base",
            onSuccess: () => {
              console.log(
                "BUY_FLOW: ERC20 deposit finality service success callback triggered"
              );

              // Update transaction to finality status to trigger 2-second UI timer
              setTimeout(() => {
                console.log(
                  "BUY_FLOW: Updating ERC20 deposit transaction to finality (2000ms delay)"
                );
                setTransactionStatusList((prev) => {
                  const updated = prev.map((t) =>
                    t.id === transaction.id
                      ? { ...t, status: "finality" as const }
                      : t
                  );
                  console.log(
                    "BUY_FLOW: ERC20 deposit transaction list updated to finality",
                    updated
                  );
                  return updated;
                });

                setShowTransaction((prevShow) => {
                  if (prevShow && prevShow.id === transaction.id) {
                    const updated = {
                      ...prevShow,
                      status: "finality" as const,
                    };
                    console.log(
                      "BUY_FLOW: ERC20 deposit show transaction updated to finality",
                      updated
                    );
                    return updated;
                  }
                  return prevShow;
                });

                setTimeout(() => {
                  console.log(
                    "BUY_FLOW: Updating ERC20 deposit transaction to completed (2000ms delay)"
                  );
                  setTransactionStatusList((prev) => {
                    const updated = prev.map((t) =>
                      t.id === transaction.id
                        ? { ...t, status: "completed" as const }
                        : t
                    );
                    console.log(
                      "BUY_FLOW: ERC20 deposit transaction list updated to completed",
                      updated
                    );
                    return updated;
                  });

                  setShowTransaction((prevShow) => {
                    if (prevShow && prevShow.id === transaction.id) {
                      const completedTx = {
                        ...prevShow,
                        status: "completed" as const,
                      };
                      console.log(
                        "BUY_FLOW: ERC20 deposit show transaction updated to completed",
                        completedTx
                      );
                      return completedTx;
                    }
                    return prevShow;
                  });

                  // Start credit balance polling to show the warning message
                  console.log(
                    "BUY_FLOW: Starting credit balance polling for ERC20 deposit",
                    {
                      initialTransactionBalance,
                    }
                  );
                  startCreditBalancePolling(initialTransactionBalance);

                  setTimeout(() => {
                    console.log(
                      "BUY_FLOW: Cleaning up ERC20 deposit transaction (4000ms delay)"
                    );
                    setTransactionStatusList((prev) =>
                      prev.filter((t) => t.id !== transaction.id)
                    );
                    setShowTransaction(undefined);
                    setOpen("");
                    console.log(
                      "BUY_FLOW: ERC20 deposit transaction cleanup completed"
                    );
                  }, 4000);
                }, 2000);
              }, 2000);
            },
          });

          console.log("BUY_FLOW: ERC20 deposit flow completed successfully");
          onTokenAmountClear?.();
          setLoading(false);
          onBuyComplete?.();
        } catch (err: any) {
          if (err.message?.includes("approve")) {
            console.error("BUY_FLOW: ERC20 approve failed", err);
          } else {
            console.error("BUY_FLOW: ERC20 deposit failed", err);
          }
          const errorMessage = ErrorHandlingUtils.getErrorMessage(err);
          console.error(
            "BUY_FLOW: ERC20 transaction error message:",
            errorMessage
          );
          errorToast?.({ label: errorMessage });
          setLoading(false);
          onBuyError?.(errorMessage);
        }
      }
    } catch (error) {
      console.error("BUY_FLOW: Top-level error in handleBuyCredits", error);
      const errorMessage = ErrorHandlingUtils.getErrorMessage(error);
      console.error("BUY_FLOW: Top-level error message:", errorMessage);
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
