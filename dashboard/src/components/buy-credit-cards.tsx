"use client";
import { config } from "@/config/walletConfig";
import useWallet from "@/hooks/useWallet";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { writeContract } from "@wagmi/core";
import { ConnectKitButton } from "connectkit";
import { LoaderCircle } from "lucide-react";
import { MouseEvent, useEffect, useMemo, useState } from "react";
import { Abi, parseUnits } from "viem";
import { useAccount } from "wagmi";
import Button from "./button";
import PrimaryInput from "./input/primary";
import SecondarySelect from "./select/secondary-select";
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

const BuyCreditsCard = ({ token }: { token?: string }) => {
  const { activeNetworkId, showBalance } = useWallet();
  const [tokenAmount, setTokenAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectToken, setSelectedToken] = useState("");
  const [error, setError] = useState("");
  const account = useAccount();

  const creditAmount = useMemo(() => {
    return "";
  }, []);

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

  const handleBuyCredits = async () => {
    if (!tokenAmount) return;
    setLoading(true);
    await writeContract(config, {
      address: "0x99a907545815c289fb6de86d55fe61d996063a94",
      abi,
      functionName: "approve",
      args: [account.address as `0x${string}`, parseUnits(tokenAmount, 18)],
      chainId: activeNetworkId,
    })
      .then((response) => {
        console.log(response);
      })
      .catch((error) => {
        const message = error.message.split(".")[0];
        setError(message);
        console.log(error.message.split(".")[0]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleClick = (e: MouseEvent, callback?: VoidFunction) => {
    e.preventDefault();
    e.stopPropagation();
    callback && callback();
  };

  return (
    <Card className="w-full min-lg:w-[466px] bg-[#192a3d] border-none shadow-[0px_4.37px_96.13px_-17.48px_#13151d] rounded-2xl pt-0 pb-0">
      <CardContent className="p-4 h-full">
        <Tabs defaultValue="buy" className="w-full gap-y-4 h-full">
          <TabsList className="w-full p-1 bg-transparent border border-solid border-[#565656] rounded-3xl h-12">
            <TabsTrigger
              value="buy"
              className="flex-1 h-10 data-[state=active]:bg-[#414e5d] data-[state=active]:text-white data-[state=active]:shadow-none data-[state=active]:border-[#bbbbbb] data-[state=active]:[text-shadow:0px_0px_10.68px_#ffffff] rounded-3xl cursor-pointer"
            >
              <Text size={"base"} weight={"medium"}>
                Buy Credits
              </Text>
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
              <TooltipContent className="bg-[#0F1F30]">
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
                  <Text size={"sm"} weight={"medium"} as="label">
                    Buy Using
                  </Text>
                  <SecondarySelect
                    onChange={(value) => setSelectedToken(value)}
                    options={["Avail", "Ethereum"]}
                    value={selectToken}
                    className="h-12 w-full"
                    placeholder="Select"
                  />
                </div>
                <PrimaryInput
                  label="You Pay (USDT)"
                  rightElement={
                    <Text
                      className="opacity-40 w-fit"
                      weight={"bold"}
                      size={"base"}
                      as="span"
                    >
                      MAX
                    </Text>
                  }
                  description={`Available: 1500 USDT`}
                  placeholder="eg. 1000"
                  className={"flex-1"}
                  onChange={(value) => {
                    if (value === "") {
                      setTokenAmount("");
                      return;
                    }
                    if (isNaN(+value)) {
                      return;
                    }

                    const parsedValue = parseInt(value);
                    setTokenAmount(parsedValue.toString());
                  }}
                  value={tokenAmount}
                />
              </div>
              <PrimaryInput
                label="Amount of Credits (KBs)"
                value={creditAmount}
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
                        >
                          Connect Wallet
                        </Button>
                      );
                    }

                    return (
                      <Button
                        onClick={handleBuyCredits}
                        variant={
                          !selectToken || !tokenAmount ? "disabled" : "primary"
                        }
                        disabled={loading || !selectToken || !tokenAmount}
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
                <Button variant={"primary"}>Sign In</Button>
              </SignedOut>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default BuyCreditsCard;
