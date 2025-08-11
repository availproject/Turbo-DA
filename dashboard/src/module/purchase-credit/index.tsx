"use client";
import Button from "@/components/button";
import CreditsTransactionProgress from "@/components/credits-transaction-progress";
import { useDialog } from "@/components/dialog/provider";
import Input from "@/components/input";
import { Text } from "@/components/text";
import { useAppToast } from "@/components/toast";
import { Card, CardContent } from "@/components/ui/card";
import { config } from "@/config/walletConfig";
import { useDebounce } from "@/hooks/useDebounce";
import { useDesiredChain } from "@/hooks/useDesiredChain";
import useWallet from "@/hooks/useWallet";
import useBalance, {
  dispatchTransactionCompleted,
  dispatchCreditBalanceUpdated,
} from "@/hooks/useBalance";
import { TOKEN_MAP } from "@/lib/types";
import { formatDataBytes, numberToBytes32 } from "@/lib/utils";
import SelectTokenButton from "@/module/purchase-credit/select-token-button";
import { TransactionStatus, useConfig } from "@/providers/ConfigProvider";
import CreditService from "@/services/credit";
import { LegacySignerOptions } from "@/utils/web3-services";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import {
  getWalletBySource,
  getWallets,
  WalletAccount,
} from "@talismn/connect-wallets";
import { readContract, writeContract } from "@wagmi/core";
import { ApiPromise, SubmittableResult } from "avail-js-sdk";
import {
  AvailWalletConnect,
  useAvailAccount,
  useAvailWallet,
} from "avail-wallet-sdk";
import BigNumber from "bignumber.js";
import { ConnectKitButton } from "connectkit";
import { LoaderCircle, Wallet } from "lucide-react";
import { Result, err, ok } from "neverthrow";
import {
  MouseEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { Abi, parseUnits } from "viem";
import { useAccount, useBalance as useWagmiBalance } from "wagmi";
import Image from "next/image";

// Circle loader component
const CircleLoader = () => (
  <div className="inline-flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export const abi: Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
    ],
    outputs: [],
  },
];

export const depositAbi: Abi = [
  {
    type: "function",
    name: "deposit",
    inputs: [{ name: "orderId", type: "bytes32", internalType: "bytes32" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "depositERC20",
    inputs: [
      { name: "orderId", type: "bytes32", internalType: "bytes32" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "tokenAddress", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "depositERC20WithPermit",
    inputs: [
      { name: "orderId", type: "bytes32", internalType: "bytes32" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "deadline", type: "uint256", internalType: "uint256" },
      {
        name: "tokenAddress",
        type: "address",
        internalType: "address",
      },
      { name: "v", type: "uint8", internalType: "uint8" },
      { name: "r", type: "bytes32", internalType: "bytes32" },
      { name: "s", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

const DESIRED_CHAIN = 11155111;

const BuyCreditsCard = ({ token }: { token?: string }) => {
  const { activeNetworkId, showBalance } = useWallet();
  const { updateAllBalances, refreshCounter, pollCreditBalanceUpdate } =
    useBalance();

  // Helper function to check if value is effectively zero
  const isZeroValue = (value: string): boolean => {
    if (!value || value.trim() === "") return true;
    const numValue = parseFloat(value);
    return numValue === 0 || isNaN(numValue);
  };
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenAmountError, setTokenAmountError] = useState("");
  const [estimateData, setEstimateData] = useState();
  const [estimateDataLoading, setEstimateDataLoading] = useState(false);
  const deferredTokenValue = useDeferredValue(tokenAmount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [availBalance, setAvailBalance] = useState<string>("0");
  const [availERC20Balance, setAvailERC20Balance] = useState<string>("0");
  const [balanceChecking, setBalanceChecking] = useState(false);
  const account = useAccount();
  const { selected, selectedWallet } = useAvailAccount();
  const { api } = useAvailWallet();
  const { setOpen } = useDialog();
  const { error: errorToast } = useAppToast();
  const {
    selectedChain,
    selectedToken,
    setTransactionStatusList,
    setShowTransaction,
  } = useConfig();
  const balance = useWagmiBalance({
    address: account.address,
    chainId: account.chainId,
  });
  const debouncedValue = useDebounce(deferredTokenValue, 800); // Increased from 500ms to 800ms
  const { chainChangerAsync } = useDesiredChain(DESIRED_CHAIN);

  // Force balance refresh when refreshCounter changes
  useEffect(() => {
    if (refreshCounter > 0) {
      console.log("Refresh counter changed, updating balances...");
      // This will trigger the balance hooks to refresh
      fetchAvailERC20Balance();
      if (api && selected?.address && selectedChain?.name === "Avail") {
        fetchAvailBalance();
      }
    }
  }, [refreshCounter]);

  // Enhanced balance update function
  const updateAllBalancesComprehensive = useCallback(async () => {
    console.log("Comprehensive balance update triggered...");

    // Update credit balance
    await updateAllBalances();

    // Force refresh of local balance states
    if (account.address && account.isConnected) {
      fetchAvailERC20Balance();
    }
    if (api && selected?.address && selectedChain?.name === "Avail") {
      fetchAvailBalance();
    }
  }, [
    updateAllBalances,
    account.address,
    account.isConnected,
    api,
    selected?.address,
    selectedChain?.name,
  ]);
  console.log({
    api,
  });

  useEffect(() => {
    if (!account.address) return;
    // setApi(api);
    // transactionProgress({
    //   transaction: {
    //     id,
    //   },
    // });
    getERC20AvailBalance();
    showBalance({ token: account.address })
      .then((response) => {
        console.log({
          response,
        });
      })
      .catch((error) => {
        console.log(error);
      });
  }, [account]);

  // Fetch Avail balance when selected account changes
  useEffect(() => {
    if (api && selected?.address && selectedChain?.name === "Avail") {
      fetchAvailBalance();
    }
  }, [api, selected?.address, selectedChain?.name, refreshCounter]);

  // Fetch AVAIL ERC20 balance on Ethereum
  useEffect(() => {
    if (account.address && account.isConnected) {
      fetchAvailERC20Balance();
    }
  }, [account.address, account.isConnected, refreshCounter]);

  const fetchAvailERC20Balance = async () => {
    if (!account.address) return;

    try {
      const availTokenAddress = TOKEN_MAP.avail?.token_address;
      if (!availTokenAddress) return;

      const erc20Abi = [
        {
          type: "function",
          name: "balanceOf",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
        },
      ] as const;

      const balance = await readContract(config, {
        address: availTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
        chainId: account.chainId,
      });

      // Convert from wei to AVAIL (18 decimals)
      const balanceBN = new BigNumber(balance.toString());
      const divisor = new BigNumber(10).pow(18);
      const balanceInAvail = balanceBN.div(divisor).toFixed(4);

      setAvailERC20Balance(balanceInAvail);
    } catch (error) {
      console.error("Error fetching AVAIL ERC20 balance:", error);
      setAvailERC20Balance("0");
    }
  };

  const fetchAvailBalance = async () => {
    if (!api || !selected?.address) return;

    try {
      const balance = await api.query.system.account(selected.address);
      // @ts-ignore - Balance type compatibility between different Polkadot versions
      const freeBalance = balance.data.free.toString();

      // Avail uses 18 decimals
      const decimals = 18;
      const divisor = BigInt(10 ** decimals);
      const freeBalanceBigInt = BigInt(freeBalance);
      const wholePart = freeBalanceBigInt / divisor;
      const remainder = freeBalanceBigInt % divisor;

      // Convert remainder to decimal with proper precision
      const fractionalPart = remainder.toString().padStart(decimals, "0");
      const balanceStr = `${wholePart.toString()}.${fractionalPart}`;
      const balanceNumber = parseFloat(balanceStr);

      setAvailBalance(balanceNumber.toFixed(4));
    } catch (error) {
      console.error("Error fetching Avail balance:", error);
      setAvailBalance("0");
    }
  };

  useEffect(() => {
    console.log("useEffect triggered with:", {
      debouncedValue,
      tokenAmountError,
      selectedToken: selectedToken?.name,
      accountChainId: account.chainId,
      deferredTokenValue,
      tokenAmount,
    });

    // Use fallback chainId if account.chainId is undefined (Arc browser issue)
    const effectiveChainId = account.chainId ?? DESIRED_CHAIN;

    if (debouncedValue && selectedToken && effectiveChainId) {
      console.log(
        "Calling calculateEstimateCredits with effectiveChainId:",
        effectiveChainId,
      );
      calculateEstimateCredits({ amount: +debouncedValue });
    } else {
      console.log("Not calling calculateEstimateCredits because:", {
        noDebouncedValue: !debouncedValue,
        noSelectedToken: !selectedToken,
        noEffectiveChainId: !effectiveChainId,
        originalChainId: account.chainId,
        fallbackChainId: DESIRED_CHAIN,
      });
    }
  }, [debouncedValue, selectedToken, account.chainId]);

  // Alternative approach for Arc browser - direct API call on tokenAmount change
  useEffect(() => {
    // Use fallback chainId if account.chainId is undefined (Arc browser issue)
    const effectiveChainId = account.chainId ?? DESIRED_CHAIN;

    if (tokenAmount && selectedToken && effectiveChainId && !tokenAmountError) {
      console.log(
        "Direct API call triggered for Arc browser compatibility with effectiveChainId:",
        effectiveChainId,
      );
      const timeoutId = setTimeout(() => {
        calculateEstimateCredits({ amount: +tokenAmount });
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [tokenAmount, selectedToken, account.chainId, tokenAmountError]);

  const calculateEstimateCredits = async ({ amount }: { amount: number }) => {
    console.log("calculateEstimateCredits called with:", {
      amount,
      selectedToken,
      accountChainId: account.chainId,
      effectiveChainId: account.chainId ?? DESIRED_CHAIN,
    });

    if (!selectedToken) {
      console.log("No selectedToken, returning early");
      return;
    }
    const tokenKey = selectedToken?.name?.toLowerCase();
    const tokenAddress = tokenKey
      ? TOKEN_MAP[tokenKey]?.token_address
      : undefined;

    if (!tokenAddress) {
      console.error(`Token address not found for ${selectedToken?.name}`);
      return;
    }

    // Use fallback chainId if account.chainId is undefined (Arc browser issue)
    const effectiveChainId = account.chainId ?? DESIRED_CHAIN;

    setEstimateDataLoading(true);
    try {
      console.log("Making API call with:", {
        token,
        amount,
        tokenAddress: tokenAddress.toLowerCase(),
        chain_id: effectiveChainId,
        originalChainId: account.chainId,
        fallbackChainId: DESIRED_CHAIN,
      });

      const response = await CreditService.calculateEstimateCreditsAgainstToken(
        {
          token: token!,
          amount: amount,
          tokenAddress: tokenAddress.toLowerCase(),
          chain_id: effectiveChainId,
        },
      );

      console.log("API response:", response);
      setEstimateData(response?.data);
    } catch (error) {
      console.log("API error:", error);
    } finally {
      setEstimateDataLoading(false);
    }
  };

  const postOrder = async (chain_id_override?: number) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/register_credit_request`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chain: chain_id_override ?? account.chainId,
        }),
      },
    );

    if (!response.ok) {
      setLoading(false);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  };

  const getERC20AvailBalance = useCallback(async () => {
    await readContract(config, {
      address: "0x8B42845d23C68B845e262dC3e5cAA1c9ce9eDB44" as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
      chainId: activeNetworkId,
    })
      .then((balance) => {
        if (!balance) return new BigNumber(0);
        return new BigNumber(balance as bigint);
      })
      .catch((error) => {
        console.log(error);
      });
  }, [account, activeNetworkId]);

  const handleBuyCredits = async () => {
    if (!tokenAmount || isZeroValue(tokenAmount)) return;
    try {
      setLoading(true);
      setError("");
      const orderResponse = await postOrder();

      if (!orderResponse?.data) {
        setLoading(false);
        setError(orderResponse.message);
        return;
      }

      const tokenKey = selectedToken?.name?.toLowerCase();
      const tokenAddress = tokenKey
        ? TOKEN_MAP[tokenKey]?.token_address
        : undefined;

      if (!tokenAddress) {
        setError(`Token address not found for ${selectedToken?.name}`);
        setLoading(false);
        return;
      }

      const contractAddress = process.env.NEXT_PUBLIC_ADDRESS;
      if (!contractAddress) {
        setError("Contract address not configured");
        setLoading(false);
        return;
      }

      await writeContract(config, {
        address: tokenAddress.toLowerCase() as `0x${string}`,
        abi,
        functionName: "approve",
        args: [contractAddress as `0x${string}`, parseUnits(tokenAmount, 18)],
        chainId: activeNetworkId,
      })
        .then(async () => {
          await writeContract(config, {
            address: contractAddress as `0x${string}`,
            abi: depositAbi,
            functionName: "depositERC20",
            args: [
              numberToBytes32(+orderResponse?.data?.id),
              parseUnits(tokenAmount, 18),
              tokenAddress,
            ],
            chainId: activeNetworkId,
          })
            .then(async (txnHash: `0x${string}`) => {
              const transaction: TransactionStatus = {
                id: uuidv4(),
                status: "initialised", // Start with initialised status
                orderId: orderResponse.data.id as number,
                tokenAddress: tokenAddress! as `0x${string}`,
                tokenAmount: +tokenAmount,
                txnHash,
                creditAmount: estimateData ? +estimateData : undefined,
              };
              setTransactionStatusList((prev) => [
                ...(prev ?? []),
                transaction,
              ]);
              setShowTransaction(transaction);
              setOpen("credit-transaction");

              // After 2 seconds, move to finality status
              setTimeout(() => {
                const updatedTransaction = {
                  ...transaction,
                  status: "finality" as const,
                };
                setTransactionStatusList((prev) =>
                  prev.map((t) =>
                    t.id === transaction.id ? updatedTransaction : t,
                  ),
                );
                setShowTransaction(updatedTransaction);
              }, 2000);
              setTokenAmount("");
              setLoading(false);

              // Dispatch transaction completed event to update all balances
              dispatchTransactionCompleted();

              // Refresh token balances immediately
              updateAllBalancesComprehensive();

              // Start polling for credit balance update
              if (estimateData) {
                console.log(
                  `Starting credit balance polling for ${estimateData} credits...`,
                );
                pollCreditBalanceUpdate(estimateData).then((success) => {
                  if (success) {
                    console.log(
                      "Credit balance polling completed successfully",
                    );
                    // Dispatch events after successful polling
                    dispatchTransactionCompleted();
                    dispatchCreditBalanceUpdated();
                  } else {
                    console.log("Credit balance polling timed out or failed");
                  }
                });
              }
            })
            .catch((err) => {
              const message = err.message.split(".")[0];
              if (message === "User rejected the request") {
                errorToast?.({ label: "You rejected the request" });
              } else {
                errorToast?.({ label: "Transaction failed" });
              }
              setLoading(false);
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
        });
    } catch (error) {
      console.log(error);
      setLoading(false);
    }
  };

  // Function to validate balance asynchronously
  const validateBalance = useCallback(
    async (value: string) => {
      if (!value || value.trim() === "") {
        setTokenAmountError("");
        return;
      }

      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue <= 0) {
        setTokenAmountError("Enter valid amount");
        return;
      }

      setBalanceChecking(true);

      try {
        // Wait a bit for balance updates to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        const getCurrentBalance = () => {
          if (selectedChain?.name === "Avail") {
            return Number(availBalance);
          } else if (selectedChain?.name === "Ethereum") {
            if (selectedToken?.name === "ETH") {
              return Number(balance.data?.formatted || 0);
            } else if (selectedToken?.name === "AVAIL") {
              return Number(availERC20Balance);
            }
          }
          return 0;
        };

        const currentBalance = getCurrentBalance();

        if (currentBalance < numValue) {
          setTokenAmountError(
            "Insufficient balance. Please enter a smaller amount",
          );
        } else {
          setTokenAmountError("");
        }
      } catch (error) {
        console.error("Error validating balance:", error);
        setTokenAmountError("");
      } finally {
        setBalanceChecking(false);
      }
    },
    [
      selectedChain?.name,
      selectedToken?.name,
      availBalance,
      balance.data?.formatted,
      availERC20Balance,
    ],
  );

  async function batchTransferAndRemark(
    api: ApiPromise,
    account: WalletAccount,
    atomicAmount: string,
    remarkMessage: string,
    onTransactionReady?: (txHash: string) => void,
  ): Promise<Result<any, Error>> {
    try {
      const wallets = getWallets();
      const matchedWallet = wallets.find((wallet) => {
        return wallet.title === wallet?.title;
      });

      await matchedWallet!.enable("turbo-da");
      const injector = getWalletBySource(account.source);

      const options: Partial<LegacySignerOptions> = {
        signer: injector?.signer as {},
        app_id: 0,
      };

      const transfer = api.tx.balances.transferKeepAlive(
        process.env.NEXT_PUBLIC_AVAIL_ADDRESS as string,
        atomicAmount,
      );
      const remark = api.tx.system.remark(remarkMessage);

      //using batchall, so in case of the transfer not being successful, remark will not be executed.
      const batchCall = api.tx.utility.batchAll([transfer, remark]);

      const txResult = await new Promise<SubmittableResult>((resolve) => {
        batchCall.signAndSend(
          account.address,
          options,
          (result: SubmittableResult) => {
            console.log(`Tx status: ${result.status}`);
            if (result.status.toString() === "Ready" && onTransactionReady) {
              onTransactionReady(result.txHash?.toString() || "");
            }
            if (result.isInBlock || result.isError) {
              resolve(result);
            }
          },
        );
      });

      const error = txResult.dispatchError;

      if (txResult.isError) {
        return err(new Error(`Transaction failed with error: ${error}`));
      } else if (error !== undefined) {
        if (error.isModule) {
          const decoded = api.registry.findMetaError(error.asModule);
          const { docs, name, section } = decoded;
          return err(new Error(`${section}.${name}: ${docs.join(" ")}`));
        } else {
          return err(new Error(error.toString()));
        }
      }

      return ok({
        status: "success",
        blockhash: txResult.status.asInBlock?.toString() || "",
        txHash: txResult.txHash.toString(),
        txIndex: txResult.txIndex,
      });
    } catch (error) {
      console.error("Error during batch transfer and remark:", error);
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to batch transfer and remark"),
      );
    }
  }

  const handleClick = (e: MouseEvent, callback?: VoidFunction) => {
    e.preventDefault();
    e.stopPropagation();
    callback?.();
  };

  // Re-validate balance when balance values change (e.g., when switching networks)
  useEffect(() => {
    if (tokenAmount && !balanceChecking) {
      validateBalance(tokenAmount);
    }
  }, [
    availBalance,
    availERC20Balance,
    balance.data?.formatted,
    selectedChain?.name,
    selectedToken?.name,
    validateBalance,
  ]);

  return (
    <div className="relative min-lg:w-[466px] h-[455px]">
      <div className="absolute w-full h-full rounded-2xl bg-linear-[139.26deg] from-border-grey from-[-0.73%] to-border-secondary to-[100.78%] p-px">
        <Card className="w-full border-none shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl pt-0 pb-0 relative h-full">
          <div className="bg-[url('/buy-credits-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
          <div className="h-full z-1 relative">
            <CardContent className="h-full px-0 flex flex-col">
              <div className="mb-2 pt-6">
                <Text size={"2xl"} weight={"semibold"} className="px-4 pb-6">
                  Buy Credits
                </Text>
                <div className="bg-border-blue w-full h-px" />
              </div>
              <div className="flex flex-col gap-y-4 p-4">
                <div className="flex gap-x-4 w-full items-center">
                  <div className="flex flex-col gap-2 flex-1">
                    <Text
                      size={"sm"}
                      as="label"
                      weight={"medium"}
                      variant="secondary-grey"
                    >
                      You Pay{" "}
                      {selectedToken?.name ? `(${selectedToken.name})` : ""}
                    </Text>
                    <Input
                      className="border-none font-semibold text-white placeholder:font-semibold md:text-[32px] placeholder:text-[32px] placeholder:text-[#999] h-10 px-0"
                      placeholder="00"
                      id="tokenAmount"
                      name="tokenAmount"
                      value={tokenAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        console.log("Input onChange triggered:", {
                          value,
                          browser: navigator.userAgent,
                          timestamp: new Date().toISOString(),
                        });

                        if (value === "") {
                          setTokenAmount("");
                          setEstimateData(undefined);
                          setTokenAmountError("");
                          return;
                        }
                        const validValue = /^\d+(\.\d*)?$/.test(value);

                        if (validValue) {
                          setTokenAmount(value);
                          // Use async balance validation
                          validateBalance(value);
                        } else {
                          setTokenAmountError("Enter valid amount");
                        }
                      }}
                    />
                    {(() => {
                      const getDisplayBalance = () => {
                        if (selectedChain?.name === "Avail") {
                          return availBalance;
                        } else if (selectedChain?.name === "Ethereum") {
                          if (selectedToken?.name === "ETH") {
                            return balance.data?.formatted
                              ? Number(balance.data.formatted).toFixed(4)
                              : "0.0000";
                          } else if (selectedToken?.name === "AVAIL") {
                            return availERC20Balance;
                          }
                        }
                        return "0.0000";
                      };

                      const displayBalance = getDisplayBalance();

                      return (
                        displayBalance !== "0.0000" && (
                          <div className="flex items-center gap-x-2">
                            <Wallet size={24} color="#B3B3B3" strokeWidth={2} />
                            <Text
                              size={"sm"}
                              weight={"medium"}
                              variant="secondary-grey"
                              as="div"
                            >
                              Balance:{" "}
                              <Text as="span" size={"sm"} weight={"semibold"}>
                                {displayBalance}
                              </Text>
                            </Text>
                          </div>
                        )
                      );
                    })()}
                  </div>
                  <SelectTokenButton />
                </div>
                <div className="bg-border-blue w-full h-px" />
                <div>
                  <Text
                    size={"sm"}
                    as="label"
                    weight={"medium"}
                    variant="secondary-grey"
                  >
                    You Receive (Credits)
                  </Text>
                  <div className="relative">
                    <Input
                      className="border-none font-semibold text-white placeholder:font-semibold md:text-[32px] placeholder:text-[32px] placeholder:text-[#999] h-10 px-0 pointer-events-none"
                      placeholder={estimateDataLoading ? "" : "00"}
                      id="creditsAmount"
                      name="creditsAmount"
                      tabIndex={-1}
                      readOnly
                      value={
                        estimateDataLoading
                          ? ""
                          : estimateData
                            ? formatDataBytes(+estimateData)
                            : ""
                      }
                    />
                    {estimateDataLoading && (
                      <div className="absolute inset-0 flex items-center justify-start pl-0 pt-3 pointer-events-none w-1/2">
                        <CircleLoader />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-y-3 items-center p-4 justify-end">
                <SignedIn>
                  {!!error && (
                    <Text variant={"error"} size={"sm"} weight={"medium"}>
                      {error}
                    </Text>
                  )}
                  {/* Warning message for insufficient balance or zero amount */}
                  {tokenAmount && (
                    <div className="w-full">
                      {isZeroValue(tokenAmount) && (
                        <Text variant={"error"} size={"sm"} weight={"medium"}>
                          Please enter a valid amount greater than 0
                        </Text>
                      )}
                      {!isZeroValue(tokenAmount) && balanceChecking && (
                        <Text
                          variant={"secondary-grey"}
                          size={"sm"}
                          weight={"medium"}
                        >
                          Checking balance...
                        </Text>
                      )}
                      {!isZeroValue(tokenAmount) &&
                        !balanceChecking &&
                        tokenAmountError ===
                          "Insufficient balance. Please enter a smaller amount" && (
                          <Text variant={"error"} size={"sm"} weight={"medium"}>
                            Insufficient balance. Please enter a smaller amount
                          </Text>
                        )}
                    </div>
                  )}
                  {(!selectedChain || !selectedToken) && (
                    <Button
                      onClick={() => {
                        setOpen("select-token");
                      }}
                    >
                      Connect Wallet
                    </Button>
                  )}
                  {selectedChain?.name === "Ethereum" && selectedToken && (
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
                            <Button onClick={() => chainChangerAsync()}>
                              Wrong Network
                            </Button>
                          );
                        }

                        return (
                          <Button
                            onClick={handleBuyCredits}
                            variant={
                              !selectedToken ||
                              !selectedChain ||
                              !tokenAmount ||
                              isZeroValue(tokenAmount) ||
                              tokenAmountError !== "" ||
                              balanceChecking
                                ? "disabled"
                                : "primary"
                            }
                            disabled={
                              loading ||
                              !selectedToken ||
                              !selectedChain ||
                              !tokenAmount ||
                              isZeroValue(tokenAmount) ||
                              tokenAmountError !== "" ||
                              balanceChecking
                            }
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
                            ) : balanceChecking ? (
                              <div className="flex gap-x-1 justify-center">
                                <LoaderCircle
                                  className="animate-spin"
                                  color="#fff"
                                  size={24}
                                />
                                Checking balance...
                              </div>
                            ) : (
                              "Buy Now"
                            )}
                          </Button>
                        );
                      }}
                    </ConnectKitButton.Custom>
                  )}
                  {selectedChain?.name === "Avail" && selectedToken && (
                    <AvailWalletConnect
                      connectedChildren={
                        <Button
                          onClick={async () => {
                            console.log("Buy Now button clicked - Avail chain");
                            console.log("Initial validation:", {
                              hasApi: !!api,
                              hasSelected: !!selected,
                              hasSelectedWallet: !!selectedWallet,
                              tokenAmount,
                              selectedToken: selectedToken?.name,
                              selectedChain: selectedChain?.name,
                            });

                            if (!api || !selected) {
                              console.error(
                                "API or selected account not available",
                                { api, selected },
                              );
                              errorToast?.({
                                label: "Wallet not connected properly",
                              });
                              return;
                            }

                            setLoading(true);
                            setError("");

                            console.log({
                              api,
                              selected,
                              selectedWallet,
                              tokenAmount,
                              selectedToken,
                              selectedChain,
                            });

                            try {
                              const orderResponse = await postOrder(0);

                              if (!orderResponse?.data) {
                                setLoading(false);
                                setError(orderResponse.message);
                                return;
                              }

                              // Create transaction ID for tracking
                              const transactionId = uuidv4();
                              let transaction: TransactionStatus | undefined;

                              // Start the transaction processing with callback for when it's ready
                              const result = await batchTransferAndRemark(
                                api,
                                selected,
                                parseUnits(tokenAmount, 18).toString(),
                                numberToBytes32(+orderResponse?.data?.id),
                                (txHash: string) => {
                                  // This callback triggers when "Tx status: Ready" appears
                                  console.log(
                                    "Transaction is ready, showing dialog...",
                                  );

                                  const newTransaction: TransactionStatus = {
                                    id: transactionId,
                                    status: "initialised",
                                    orderId: orderResponse.data.id as number,
                                    tokenAddress: TOKEN_MAP.avail
                                      .token_address as `0x${string}`,
                                    tokenAmount: +tokenAmount,
                                    txnHash: txHash as `0x${string}`,
                                    creditAmount: estimateData
                                      ? +estimateData
                                      : undefined,
                                  };

                                  transaction = newTransaction;

                                  // Show dialog and let CreditsTransactionProgress handle natural progression
                                  setTransactionStatusList((prev) => [
                                    ...(prev ?? []),
                                    newTransaction,
                                  ]);
                                  setShowTransaction(newTransaction);
                                  setOpen("credit-transaction");

                                  // Add the missing transition: initialised → finality (like Ethereum flow)
                                  setTimeout(() => {
                                    const finalityTransaction: TransactionStatus =
                                      {
                                        ...newTransaction,
                                        status: "finality" as const,
                                      };
                                    setTransactionStatusList((prev) =>
                                      prev.map((t) =>
                                        t.id === transactionId
                                          ? finalityTransaction
                                          : t,
                                      ),
                                    );
                                    setShowTransaction(finalityTransaction);
                                    // Now CreditsTransactionProgress will handle finality → almost_done
                                  }, 2000); // Same timing as Ethereum flow
                                },
                              );

                              if (result.isErr()) {
                                throw new Error(result.error.message);
                              }

                              console.log(
                                "Transaction successful:",
                                result.value,
                              );

                              if (transaction) {
                                setTimeout(async () => {
                                  try {
                                    const response = await fetch(
                                      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/add_inclusion_details`,
                                      {
                                        method: "POST",
                                        headers: {
                                          Authorization: `Bearer ${token}`,
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          order_id: +orderResponse?.data?.id,
                                          tx_hash: result.value.txHash,
                                        }),
                                      },
                                    );

                                    if (!response.ok) {
                                      throw new Error(
                                        `HTTP error! Status: ${response.status}`,
                                      );
                                    }

                                    await response.json();

                                    // Now mark as completed after 3 steps are done
                                    const completedTransaction: TransactionStatus =
                                      {
                                        id: transaction!.id,
                                        orderId: transaction!.orderId,
                                        tokenAmount: transaction!.tokenAmount,
                                        tokenAddress: transaction!.tokenAddress,
                                        creditAmount: transaction!.creditAmount,
                                        txnHash: result.value
                                          .txHash as `0x${string}`,
                                        status: "completed" as const,
                                      };
                                    setTransactionStatusList((prev) =>
                                      prev.map((t) =>
                                        t.id === transactionId
                                          ? completedTransaction
                                          : t,
                                      ),
                                    );
                                    setShowTransaction(completedTransaction);
                                  } catch (error) {
                                    console.error(
                                      "Failed to post inclusion details:",
                                      error,
                                    );
                                    // Still mark as completed since blockchain transaction succeeded
                                    const completedTransaction: TransactionStatus =
                                      {
                                        id: transaction!.id,
                                        orderId: transaction!.orderId,
                                        tokenAmount: transaction!.tokenAmount,
                                        tokenAddress: transaction!.tokenAddress,
                                        creditAmount: transaction!.creditAmount,
                                        txnHash: result.value
                                          .txHash as `0x${string}`,
                                        status: "completed" as const,
                                      };
                                    setTransactionStatusList((prev) =>
                                      prev.map((t) =>
                                        t.id === transactionId
                                          ? completedTransaction
                                          : t,
                                      ),
                                    );
                                    setShowTransaction(completedTransaction);
                                  }
                                }, 5000); // Wait 5 seconds for 3 steps to complete naturally
                              }

                              setTokenAmount("");
                              setLoading(false);

                              // Dispatch transaction completed event to update all balances
                              dispatchTransactionCompleted();

                              // Refresh token balances immediately
                              updateAllBalancesComprehensive();

                              // Start polling for credit balance update
                              if (estimateData) {
                                console.log(
                                  `Starting credit balance polling for ${estimateData} credits...`,
                                );
                                pollCreditBalanceUpdate(estimateData).then(
                                  (success) => {
                                    if (success) {
                                      console.log(
                                        "Credit balance polling completed successfully",
                                      );
                                      // Dispatch events after successful polling
                                      dispatchTransactionCompleted();
                                      dispatchCreditBalanceUpdated();
                                    } else {
                                      console.log(
                                        "Credit balance polling timed out or failed",
                                      );
                                    }
                                  },
                                );
                              }
                            } catch (error) {
                              console.error("Transaction failed:", error);
                              const message =
                                error instanceof Error
                                  ? error.message
                                  : "Transaction failed";
                              errorToast?.({ label: message });
                              setError(message);
                            } finally {
                              setLoading(false);
                            }
                          }}
                          variant={
                            loading ||
                            !selectedToken ||
                            !selectedChain ||
                            !tokenAmount ||
                            isZeroValue(tokenAmount) ||
                            tokenAmountError !== "" ||
                            balanceChecking
                              ? "disabled"
                              : "primary"
                          }
                          disabled={
                            loading ||
                            !selectedToken ||
                            !selectedChain ||
                            !tokenAmount ||
                            isZeroValue(tokenAmount) ||
                            tokenAmountError !== "" ||
                            balanceChecking
                          }
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
                          ) : balanceChecking ? (
                            <div className="flex gap-x-1 justify-center">
                              <LoaderCircle
                                className="animate-spin"
                                color="#fff"
                                size={24}
                              />
                              Checking balance...
                            </div>
                          ) : (
                            "Buy Now"
                          )}
                        </Button>
                      }
                    >
                      <Button>Connect Wallet</Button>
                    </AvailWalletConnect>
                  )}
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal" component="div">
                    <Button>Sign In</Button>
                  </SignInButton>
                </SignedOut>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>
      <CreditsTransactionProgress />
    </div>
  );
};

export default BuyCreditsCard;
