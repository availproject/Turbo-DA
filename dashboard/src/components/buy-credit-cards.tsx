"use client";
import { config } from "@/config/walletConfig";
import { useDebounce } from "@/hooks/useDebounce";
import useWallet from "@/hooks/useWallet";
import { TOKEN_MAP } from "@/lib/types";
import { formatDataBytes, numberToBytes32 } from "@/lib/utils";
import CreditService from "@/services/credit";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { writeContract } from "@wagmi/core";
import { ConnectKitButton } from "connectkit";
import { LoaderCircle } from "lucide-react";
import Image from "next/image";
import { MouseEvent, useDeferredValue, useEffect, useState } from "react";
import { Abi, parseUnits } from "viem";
import { useAccount, useBalance as useWagmiBalance } from "wagmi";
import Button from "./button";
import CreditsAdded from "./credits-added";
import { useDialog } from "./dialog/provider";
import PrimaryInput from "./input/primary";
import IconSelectContainer from "./select/icon-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Text } from "./text";
import { Card, CardContent } from "./ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

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

const BuyCreditsCard = ({ token }: { token?: string }) => {
  const { activeNetworkId, showBalance } = useWallet();
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenAmountError, setTokenAmountError] = useState("");
  const [estimateData, setEstimateData] = useState();
  const deferredTokenValue = useDeferredValue(tokenAmount);
  const [loading, setLoading] = useState(false);
  const [selectToken, setSelectedToken] = useState("");
  const [error, setError] = useState("");
  const account = useAccount();
  const { setOpen } = useDialog();
  const balance = useWagmiBalance({
    address: account.address,
  });
  const debouncedValue = useDebounce(deferredTokenValue, 500);

  useEffect(() => {
    if (!account.address) return;
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
      calculateDataCredits();
    }
  }, [debouncedValue, tokenAmountError]);

  const calculateDataCredits = async () => {
    try {
      const response = await CreditService.creditEstimates({
        token: token!,
        data: +debouncedValue,
      });

      setEstimateData(response.data);
    } catch (error) {
      console.log(error);
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
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  };

  const handleBuyCredits = async () => {
    if (!tokenAmount) return;
    try {
      setLoading(true);
      setError("");
      const orderResponse = await postOrder();
      console.log({
        selectToken,
        orderResponse,
      });

      if (!orderResponse?.data) {
        setLoading(false);
        setError(orderResponse.message);
        return;
      }

      const tokenAddress = TOKEN_MAP[selectToken.toLowerCase()].token_address;
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
        .then(async (res) => {
          await writeContract(config, {
            address: process.env.NEXT_PUBLIC_ADDRESS as `0x${string}`,
            abi: depositAbi,
            functionName: "depositERC20",
            args: [
              numberToBytes32(orderResponse.data.id),
              parseUnits(tokenAmount, 18),
              tokenAddress,
            ],
            chainId: activeNetworkId,
          })
            .then(() => setOpen("credit-added"))
            .catch((error) => {
              const message = error.message.split(".")[0];
              setError(message);
            })
            .finally(() => {
              setLoading(false);
            });
        })
        .catch((err) => {
          const message = err.message.split(".")[0];
          setError(message);
          setLoading(false);
        });
    } catch (error) {
      // setError(error.message);
    }
  };

  const handleClick = (e: MouseEvent, callback?: VoidFunction) => {
    e.preventDefault();
    e.stopPropagation();
    callback && callback();
  };

  return (
    <Card className="w-full min-lg:w-[466px] shadow-primary border-border-grey bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl pt-0 pb-0">
      <CardContent className="p-4 h-full">
        <Tabs defaultValue="buy" className="w-full gap-y-4 h-full">
          <TabsList className="w-full p-1 border border-solid border-border-blue rounded-3xl h-12">
            <TabsTrigger value="buy" variant="outline">
              Buy Credits
            </TabsTrigger>
            <Tooltip>
              <TooltipTrigger
                asChild
                className="flex-1 h-10 flex justify-center items-center"
              >
                <Text
                  size={"base"}
                  weight={"medium"}
                  className="text-[#88919a]"
                >
                  Convert Credits
                </Text>
              </TooltipTrigger>
              <TooltipContent className="bg-black border-border-grey py-3 px-4 shadow-primary">
                <Text size={"sm"} weight={"medium"}>
                  Coming Soon
                </Text>
              </TooltipContent>
            </Tooltip>
          </TabsList>

          <TabsContent
            value="buy"
            className="mt-0 space-y-6 h-full justify-between flex flex-col"
          >
            <div className="flex flex-col gap-y-8">
              <div className="flex gap-2 w-full">
                <div className="flex flex-col gap-2 flex-1">
                  <Text
                    size={"sm"}
                    as="label"
                    weight={"medium"}
                    color="secondary-grey"
                  >
                    Buy Using
                  </Text>
                  <IconSelectContainer
                    onChange={(value) => setSelectedToken(value)}
                    options={[
                      {
                        label: "Ethereum",
                        icon: (
                          <Image
                            src={"/currency/eth.png"}
                            alt="ethereum"
                            width={18}
                            height={18}
                          />
                        ),
                        value: "ethereum",
                      },
                    ]}
                    value={selectToken}
                    className="h-12 w-full"
                    placeholder="Select"
                  />
                </div>
                <PrimaryInput
                  label={`You Pay ${
                    balance.data?.symbol && selectToken
                      ? `(${balance.data?.symbol})`
                      : ""
                  }`}
                  rightElement={
                    <Text
                      className="w-fit"
                      weight={"bold"}
                      size={"base"}
                      as="span"
                    >
                      MAX
                    </Text>
                  }
                  description={
                    balance.data?.symbol && selectToken
                      ? `Available: ${`${Number(
                          balance.data?.formatted
                        ).toFixed(5)}`}`
                      : undefined
                  }
                  placeholder="eg. 1000"
                  className={"flex-1"}
                  onChange={(value) => {
                    if (value === "" || !selectToken) {
                      setTokenAmount("");
                      setEstimateData(undefined);
                      setTokenAmountError("");
                      return;
                    }

                    if (value.match(/\b\d+(\.\d+)?\b/)) {
                      setTokenAmount(value);
                    }
                    if (Number(balance.data?.formatted) < +value) {
                      setTokenAmountError(`Insufficent Balance`);
                      setEstimateData(undefined);
                    } else {
                      setTokenAmountError("");
                    }
                  }}
                  value={tokenAmount}
                  error={tokenAmountError}
                />
              </div>
              <PrimaryInput
                label="Amount of Credits"
                value={estimateData ? formatDataBytes(+estimateData) : ""}
                className="pointer-events-none"
              />
            </div>

            <div className="flex-1 flex flex-col gap-y-3 items-center pt-28">
              <SignedIn>
                {!!error && (
                  <Text variant={"error"} size={"sm"}>
                    {error}
                  </Text>
                )}
                <ConnectKitButton.Custom>
                  {(props) => {
                    if (!props.isConnected) {
                      return (
                        <Button
                          onClick={(e) => handleClick(e, props.show)}
                          variant={"primary"}
                          className="h-12"
                        >
                          Connect Wallet
                        </Button>
                      );
                    }

                    return (
                      <Button
                        onClick={handleBuyCredits}
                        variant={
                          !selectToken || !tokenAmount || tokenAmount === "0"
                            ? "disabled"
                            : "secondary"
                        }
                        disabled={
                          loading ||
                          !selectToken ||
                          !tokenAmount ||
                          tokenAmount === "0"
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
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal" component="div">
                  <Button variant={"secondary"}>Sign In</Button>
                </SignInButton>
              </SignedOut>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CreditsAdded />
    </Card>
  );
};

export default BuyCreditsCard;
