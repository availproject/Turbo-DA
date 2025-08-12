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
import { useAuthState } from "@/providers/AuthProvider";
import CreditService from "@/services/credit";
import { Wallet } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useAccount, useBalance as useWagmiBalance } from "wagmi";
import BuySection from "./components/buy-section";
import { useTransactionProgress } from "@/hooks/useTransactionProgress";

// Removed hardcoded DESIRED_CHAIN - now using dynamic chain from user selection

// Helper function to get token info from supportedTokensAndChains
const getTokenInfo = (chainName: string, tokenName: string) => {
  const chainKey = chainName.toLowerCase();
  const chain = supportedTokensAndChains[chainKey];
  return chain?.tokens.find((token) => token.name === tokenName);
};

const BuyCreditsCard = () => {
  // Initialize global transaction processing
  useTransactionProgress();
  
  const { getERC20AvailBalance, showBalance } = useWallet();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isLoggedOut,
    token,
  } = useAuthState();
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenAmountError, setTokenAmountError] = useState("");
  const [estimateData, setEstimateData] = useState();
  const [estimateDataLoading, setEstimateDataLoading] = useState(false);
  const requestIdRef = useRef(0);
  const deferredTokenValue = useDeferredValue(tokenAmount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showBalanceError, setShowBalanceError] = useState(false);
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
      }).catch(() => {
        // Silent fail for balance display
      });
    }
  }, [
    account.address,
    selectedChain,
    selectedToken,
    getERC20AvailBalance,
    showBalance,
  ]);

  // Fetch Avail balance when selected account changes
  useEffect(() => {
    if (api && selected?.address && selectedChain?.name === "Avail") {
      fetchAvailBalance();
    }
  }, [api, selected?.address, selectedChain?.name]);

  // Fetch AVAIL ERC20 balance on Ethereum
  useEffect(() => {
    if (account.address && account.isConnected) {
      fetchAvailERC20Balance();
    }
  }, [account.address, account.isConnected]);

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
    if (debouncedValue && +debouncedValue > 0) {
      calculateEstimateCredits({ amount: +debouncedValue });
    }
  }, [debouncedValue, selectedChain, selectedToken]);

  // Reset balance error when chain or token changes
  useEffect(() => {
    setShowBalanceError(false);
    setTokenAmountError("");
  }, [selectedChain, selectedToken]);

  useEffect(() => {
    if (tokenAmount && +tokenAmount > 0) {
      const currentBalance =
        selectedChain?.name === "Avail"
          ? Number(availNativeBalance)
          : Number(balance.data?.formatted);

      if (currentBalance < +tokenAmount) {
        setTokenAmountError(`Insufficent Balance`);
        setShowBalanceError(true);
      } else {
        setTokenAmountError("");
        setShowBalanceError(false);
      }
    } else if (!tokenAmount) {
      // Clear errors when input is empty
      setTokenAmountError("");
      setShowBalanceError(false);
    }
  }, [
    selectedChain,
    selectedToken,
    balance.data?.formatted,
    availNativeBalance,
    tokenAmount,
  ]);

  const calculateEstimateCredits = async ({ amount }: { amount: number }) => {
    if (!selectedToken || !token) {
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
    const currentRequestId = ++requestIdRef.current;
    setEstimateDataLoading(true);
    setEstimateData(undefined);
    try {
      const response = await CreditService.calculateEstimateCreditsAgainstToken(
        {
          token,
          amount: amount,
          tokenAddress: tokenAddress.toLowerCase(),
          chainId: selectedChain.id,
        }
      );

      if (currentRequestId === requestIdRef.current) {
        setEstimateData(response?.data);
      }
    } catch (error) {
      // Silent fail for estimate calculation
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setEstimateDataLoading(false);
      }
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

  // Show loading state while authentication is loading
  if (authLoading) {
    return (
      <div className="relative min-lg:w-[466px] h-[455px]">
        <div className="absolute w-full h-full rounded-2xl bg-linear-[139.26deg] from-border-grey from-[-0.73%] to-border-secondary to-[100.78%] p-px">
          <Card className="w-full border-none shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl pt-0 pb-0 relative h-full">
            <div className="bg-[url('/purchase-credits-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
            <CardContent className="p-6 z-1 relative">
              <div className="space-y-6">
                <div className="flex items-center gap-x-2">
                  <Skeleton className="w-8 h-8 rounded-lg" sheen={false} />
                  <Skeleton className="w-32 h-6 rounded" />
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Skeleton className="w-24 h-4 rounded mb-2" />
                    <Skeleton className="w-full h-12 rounded-lg" />
                  </div>
                  
                  <div>
                    <Skeleton className="w-32 h-4 rounded mb-2" />
                    <Skeleton className="w-full h-12 rounded-lg" />
                  </div>
                  
                  <div>
                    <Skeleton className="w-40 h-4 rounded mb-2" />
                    <Skeleton className="w-full h-12 rounded-lg" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Skeleton className="w-32 h-4 rounded" />
                  <Skeleton className="w-full h-12 rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
                          setShowBalanceError(false);
                          return;
                        }
                        const validValue = /^\d+(\.\d*)?$/.test(value);

                        if (validValue) {
                          setTokenAmount(value);
                          if (+value === 0) {
                            setTokenAmountError(
                              "Please enter a valid amount greater than 0"
                            );
                            setShowBalanceError(false);
                            return;
                          }
                        } else {
                          setTokenAmountError("Enter valid amount");
                          return;
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
                      value={
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
                token={token || undefined}
                showBalanceError={showBalanceError}
                isAuthenticated={isAuthenticated}
                isLoggedOut={isLoggedOut}
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
