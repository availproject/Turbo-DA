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
import { TOKEN_MAP } from "@/lib/types";
import { formatDataBytes, numberToBytes32 } from "@/lib/utils";
import SelectTokenButton from "@/module/purchase-credit/select-token-button";
import { TransactionStatus, useConfig } from "@/providers/ConfigProvider";
import CreditService from "@/services/credit";
import { LegacySignerOptions } from "@/utils/web3-services";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { ISubmittableResult } from "@polkadot/types/types";
import { getWalletBySource, WalletAccount } from "@talismn/connect-wallets";
import { readContract, writeContract } from "@wagmi/core";
import { ApiPromise } from "avail-js-sdk";
import BigNumber from "bignumber.js";
import { ConnectKitButton } from "connectkit";
import { LoaderCircle, Wallet } from "lucide-react";
import { err, ok } from "neverthrow";
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
import { AvailWalletConnect, useApi, useAvailAccount } from "wallet-sdk-v2";

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
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenAmountError, setTokenAmountError] = useState("");
  const [estimateData, setEstimateData] = useState();
  const [estimateDataLoading, setEstimateDataLoading] = useState(false);
  const deferredTokenValue = useDeferredValue(tokenAmount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const account = useAccount();
  const { selected } = useAvailAccount();
  const { setOpen } = useDialog();
  const { error: errorToast } = useAppToast();
  const {
    selectedChain,
    selectedToken,
    setTransactionStatusList,
    setShowTransaction,
  } = useConfig();
  const { api } = useApi();
  const balance = useWagmiBalance({
    address: account.address,
  });
  const debouncedValue = useDebounce(deferredTokenValue, 500);
  const { chainChangerAsync } = useDesiredChain(DESIRED_CHAIN);
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

  useEffect(() => {
    if (debouncedValue && !tokenAmountError) {
      calculateEstimateCredits({ amount: +debouncedValue });
    }
  }, [debouncedValue, tokenAmountError]);

  const calculateEstimateCredits = async ({ amount }: { amount: number }) => {
    if (!selectedToken) {
      return;
    }
    const tokenAddress =
      selectedToken &&
      TOKEN_MAP[selectedToken?.name.toLowerCase()]?.token_address;
    setEstimateDataLoading(true);
    try {
      const response = await CreditService.calculateEstimateCreditsAgainstToken(
        {
          token: token!,
          amount: amount,
          tokenAddress: tokenAddress.toLowerCase(),
        }
      );

      setEstimateData(response?.data);
    } catch (error) {
      console.log(error);
    } finally {
      setEstimateDataLoading(false);
    }
  };

  const postOrder = async () => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/register_credit_request`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chain: account.chainId,
        }),
      }
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
    if (!tokenAmount) return;
    try {
      setLoading(true);
      setError("");
      const orderResponse = await postOrder();

      if (!orderResponse?.data) {
        setLoading(false);
        setError(orderResponse.message);
        return;
      }

      const tokenAddress =
        selectedToken &&
        TOKEN_MAP[selectedToken?.name?.toLowerCase()].token_address;

      await writeContract(config, {
        address: tokenAddress as `0x${string}`,
        abi,
        functionName: "approve",
        args: [
          process.env.NEXT_PUBLIC_ADDRESS as `0x${string}`,
          parseUnits(tokenAmount, 18),
        ],
        chainId: activeNetworkId,
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
            chainId: activeNetworkId,
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
              setTokenAmount("");
              setLoading(false);
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

  async function batchTransferAndRemark(
    api: ApiPromise,
    account: WalletAccount,
    atomicAmount: string,
    remarkMessage: string
  ) {
    try {
      const injector = getWalletBySource(account.source);
      const options: Partial<LegacySignerOptions> = {
        signer: injector?.signer,
        app_id: 0,
      };

      const transfer = api.tx.balances.transferKeepAlive(
        selected?.address as `0x${string}`,
        atomicAmount
      );
      const remark = api.tx.system.remark(remarkMessage);

      //using batchall, so in case of the transfer not being successful, remark will not be executed.
      const batchCall = api.tx.utility.batchAll([transfer, remark]);
      const txResult = await new Promise<ISubmittableResult>((resolve) => {
        batchCall.signAndSend(
          selected?.address as `0x${string}`,
          // @ts-expect-error
          options,
          (result: ISubmittableResult) => {
            console.log(`Tx status: ${result.status}`);
            if (result.isInBlock || result.isError) {
              resolve(result);
            }
          }
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
          : new Error("Failed to batch transfer and remark")
      );
    }
  }

  const handleClick = (e: MouseEvent, callback?: VoidFunction) => {
    e.preventDefault();
    e.stopPropagation();
    callback?.();
  };

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
                        if (value === "") {
                          setTokenAmount("");
                          setEstimateData(undefined);
                          setTokenAmountError("");
                          return;
                        }
                        const validValue = /^\d+(\.\d*)?$/.test(value);

                        if (validValue) {
                          setTokenAmount(value);
                        } else {
                          setTokenAmountError("Enter valid amount");
                          return;
                        }
                        if (Number(balance.data?.formatted) < +value) {
                          setTokenAmountError(`Insufficent Balance`);
                          setEstimateData(undefined);
                        } else {
                          setTokenAmountError("");
                        }
                      }}
                    />
                    {typeof balance.data?.formatted !== "undefined" && (
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
                            {Number(balance.data?.formatted).toFixed(4)}
                          </Text>
                        </Text>
                      </div>
                    )}
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
                  <Input
                    className="border-none font-semibold text-white placeholder:font-semibold md:text-[32px] placeholder:text-[32px] placeholder:text-[#999] h-10 px-0 pointer-events-none"
                    placeholder="00"
                    id="creditsAmount"
                    name="creditsAmount"
                    defaultValue={
                      estimateData && !estimateDataLoading
                        ? formatDataBytes(+estimateData)
                        : ""
                    }
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-y-3 items-center p-4 justify-end">
                <SignedIn>
                  {!!error && (
                    <Text variant={"error"} size={"sm"} weight={"medium"}>
                      {error}
                    </Text>
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
                              tokenAmount === "0" ||
                              tokenAmountError !== ""
                                ? "disabled"
                                : "primary"
                            }
                            disabled={
                              loading ||
                              !selectedToken ||
                              !selectedChain ||
                              !tokenAmount ||
                              tokenAmount === "0" ||
                              tokenAmountError !== ""
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
                          onClick={() =>
                            batchTransferAndRemark(
                              api!,
                              selected!,
                              parseUnits(tokenAmount, 18).toString(),
                              "Buy Credits"
                            )
                          }
                          variant={
                            !selectedToken ||
                            !selectedChain ||
                            !tokenAmount ||
                            tokenAmount === "0" ||
                            tokenAmountError !== ""
                              ? "disabled"
                              : "primary"
                          }
                          disabled={
                            loading ||
                            !selectedToken ||
                            !selectedChain ||
                            !tokenAmount ||
                            tokenAmount === "0" ||
                            tokenAmountError !== ""
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
