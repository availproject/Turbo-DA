"use client";
import { template } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import { getTokenBalance } from "@/module/purchase-credit/utils";
import { Chain, ClickHandler } from "@/module/purchase-credit/utils/types";
import { useAvailAccount, useAvailWallet } from "avail-wallet-sdk";
import React, {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface ConfigContextType {
  token?: string;
  fetchToken: ClickHandler;
  selectedChain: ChainType;
  setSelectedChain: Dispatch<SetStateAction<ChainType>>;
  setSelectedToken: Dispatch<SetStateAction<Token | undefined>>;
  selectedToken?: Token;
  transactionStatusList: TransactionStatus[];
  setTransactionStatusList: Dispatch<SetStateAction<TransactionStatus[]>>;
  showTransaction?: TransactionStatus;
  setShowTransaction: Dispatch<SetStateAction<TransactionStatus | undefined>>;
  availNativeBalance: string;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(
  undefined,
);

interface ConfigProviderProps {
  children?: React.ReactNode;
  accessToken?: string;
}

type ChainType = {
  name: string;
  icon: string;
};

type Token = {
  name: string;
  icon: string;
};

export type TransactionStatus = {
  id: string;
  status: "initialised" | "finality" | "completed";
  txnHash?: `0x${string}`;
  orderId: number;
  tokenAmount: number;
  tokenAddress: `0x${string}`;
};

export const ConfigProvider: React.FC<ConfigProviderProps> = ({
  children,
  accessToken,
}) => {
  const { getToken } = useAuth();
  const { selected } = useAvailAccount();
  const { api } = useAvailWallet();
  const [token, setToken] = useState<string>(accessToken ?? "");
  const [selectedChain, setSelectedChain] = useState<ChainType>({
    name: "Ethereum",
    icon: "/currency/eth.png",
  });
  const [selectedToken, setSelectedToken] = useState<Token | undefined>({
    name: "ETH",
    icon: "/currency/eth.png",
  });
  const [transactionStatusList, setTransactionStatusList] = useState<
    TransactionStatus[]
  >([]);
  const [showTransaction, setShowTransaction] = useState<TransactionStatus>();
  const [availNativeBalance, setAvailNativeBalance] = useState<string>("0");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchToken();
  }, []);

  useEffect(() => {
    if (selected?.address && api) {
      fetchAvailBalance();

      intervalRef.current = setInterval(() => {
        fetchAvailBalance();
      }, 20000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [selected?.address, api?.isReady]);

  const fetchToken = async () => {
    await getToken({ template: template })
      .then((res) => {
        if (res) setToken(res);
      })
      .catch((err) => {
        console.error(err);
      });
  };

  const fetchAvailBalance = async () => {
    if (!selected?.address || !api) return;

    try {
      console.log("avail balance", "fetching");
      const balance = await getTokenBalance(
        Chain.AVAIL,
        selected.address as `0x${string}`,
        api,
      );
      console.log(balance, "avail balance", selected.address);
      setAvailNativeBalance(balance);
    } catch (error) {
      console.error("Failed to fetch Avail balance:", error);
    }
  };

  return (
    <ConfigContext.Provider
      value={{
        token,
        fetchToken,
        selectedChain,
        setSelectedChain,
        selectedToken,
        setSelectedToken,
        transactionStatusList,
        setTransactionStatusList,
        showTransaction,
        setShowTransaction,
        availNativeBalance,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);

  if (context === undefined) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }

  return context;
};
