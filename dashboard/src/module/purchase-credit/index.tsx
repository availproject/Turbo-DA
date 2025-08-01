"use client";
import CreditsTransactionProgress from "@/components/credits-transaction-progress";
import Input from "@/components/input";
import { Text } from "@/components/text";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/useDebounce";
import useWallet from "@/hooks/useWallet";
import { supportedTokensAndChains } from "@/lib/types";
import { formatDataBytes } from "@/lib/utils";
import SelectTokenButton from "@/module/purchase-credit/select-token-button";
import { useConfig } from "@/providers/ConfigProvider";
import CreditService from "@/services/credit";
import { Wallet } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { useAccount, useBalance as useWagmiBalance } from "wagmi";
import BuySection from "./components/buy-section";

// Removed hardcoded DESIRED_CHAIN - now using dynamic chain from user selection

// Helper function to get token info from supportedTokensAndChains
const getTokenInfo = (chainName: string, tokenName: string) => {
  const chainKey = chainName.toLowerCase();
  const chain = supportedTokensAndChains[chainKey];
  return chain?.tokens.find((token) => token.name === tokenName);
};

const BuyCreditsCard = ({ token }: { token?: string }) => {
  const { getERC20AvailBalance, showBalance } = useWallet();
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenAmountError, setTokenAmountError] = useState("");
  const [estimateData, setEstimateData] = useState();
  const [estimateDataLoading, setEstimateDataLoading] = useState(false);
  const deferredTokenValue = useDeferredValue(tokenAmount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const account = useAccount();
  const { selectedChain, selectedToken, availNativeBalance } = useConfig();
  const balance = useWagmiBalance({
    address: account.address,
    chainId: selectedChain?.id !== 0 ? selectedChain?.id : undefined,
    token:
      selectedToken &&
      selectedChain &&
      getTokenInfo(selectedChain.name, selectedToken.name)?.address ===
        "0x0000000000000000000000000000000000000000"
        ? undefined // Native token (zero address)
        : selectedToken &&
          selectedChain &&
          (getTokenInfo(selectedChain.name, selectedToken.name)
            ?.address as `0x${string}`),
  });
  const debouncedValue = useDebounce(deferredTokenValue, 500);

  useEffect(() => {
    if (!account.address || !selectedChain || !selectedToken) return;

    // Only fetch ERC20 balance for non-Avail chains and non-native tokens
    if (selectedChain.name !== "Avail") {
      const tokenInfo = getTokenInfo(selectedChain.name, selectedToken.name);
      const isNativeToken =
        tokenInfo?.address === "0x0000000000000000000000000000000000000000";

      if (!isNativeToken && tokenInfo) {
        getERC20AvailBalance(
          account.address,
          tokenInfo.address as `0x${string}`,
          selectedChain.id
        );
      }

      showBalance({
        token: isNativeToken
          ? undefined
          : (tokenInfo?.address as `0x${string}`),
        chainId: selectedChain.id,
      })
        .then((response) => {
          console.log({
            response,
          });
        })
        .catch((error) => {
          console.log(error);
        });
    }
  }, [
    account.address,
    selectedChain,
    selectedToken,
    getERC20AvailBalance,
    showBalance,
  ]);

  useEffect(() => {
    if (debouncedValue && !tokenAmountError) {
      calculateEstimateCredits({ amount: +debouncedValue });
    }
  }, [debouncedValue, tokenAmountError, selectedChain, selectedToken]);

  const calculateEstimateCredits = async ({ amount }: { amount: number }) => {
    if (!selectedToken) {
      return;
    }
    let tokenAddress: string;
    if (selectedChain.name === "AVAIL") {
      tokenAddress = "0x0000000000000000000000000000000000000000";
    } else if (selectedToken && selectedChain) {
      tokenAddress =
        getTokenInfo(selectedChain.name, selectedToken.name)?.address ||
        "0x0000000000000000000000000000000000000000";
    } else {
      return;
    }
    setEstimateDataLoading(true);
    try {
      const response = await CreditService.calculateEstimateCreditsAgainstToken(
        {
          token: token!,
          amount: amount,
          tokenAddress: tokenAddress.toLowerCase(),
          chainId: selectedChain.id,
        }
      );

      setEstimateData(response?.data);
    } catch (error) {
      console.log(error);
    } finally {
      setEstimateDataLoading(false);
    }
  };

  const handleBuyStart = () => {
    setLoading(true);
    setError("");
  };

  const handleBuyComplete = () => {
    setLoading(false);
  };

  const handleBuyError = (errorMessage: string) => {
    setError(errorMessage);
    setLoading(false);
  };

  const handleTokenAmountClear = () => {
    setTokenAmount("");
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
                        const currentBalance =
                          selectedChain?.name === "Avail"
                            ? Number(availNativeBalance)
                            : Number(balance.data?.formatted);

                        if (currentBalance < +value) {
                          setTokenAmountError(`Insufficent Balance`);
                          setEstimateData(undefined);
                        } else {
                          setTokenAmountError("");
                        }
                      }}
                    />
                    {(typeof balance.data?.formatted !== "undefined" ||
                      selectedChain?.name === "Avail") && (
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
                            {selectedChain?.name === "Avail"
                              ? Number(availNativeBalance).toFixed(4)
                              : Number(balance.data?.formatted).toFixed(4)}
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
                  {estimateDataLoading ? (
                    <div className="h-10 mt-2">
                      <Skeleton className="h-10 w-32" />
                    </div>
                  ) : (
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
                      readOnly
                    />
                  )}
                </div>
              </div>

              <BuySection
                tokenAmount={tokenAmount}
                tokenAmountError={tokenAmountError}
                error={error}
                onBuyStart={handleBuyStart}
                onBuyComplete={handleBuyComplete}
                onBuyError={handleBuyError}
                onTokenAmountClear={handleTokenAmountClear}
                token={token}
              />
            </CardContent>
          </div>
        </Card>
      </div>
      <CreditsTransactionProgress />
    </div>
  );
};

export default BuyCreditsCard;
