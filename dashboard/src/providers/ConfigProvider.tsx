"use client";
import { template } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import { getTokenBalance } from "@/module/purchase-credit/utils";
import { Chain, ClickHandler } from "@/module/purchase-credit/utils/types";
import { supportedTokensAndChains } from "@/lib/types";
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

const STORAGE_KEYS = {
  SELECTED_CHAIN: "turbo-da-selected-chain",
  SELECTED_TOKEN: "turbo-da-selected-token",
} as const;

const getDefaultChain = (): ChainType => ({
  name: supportedTokensAndChains.ethereum.name,
  icon: supportedTokensAndChains.ethereum.icon,
  id: supportedTokensAndChains.ethereum.id,
});

const getDefaultToken = (): Token => ({
  name: supportedTokensAndChains.ethereum.tokens[0].name,
  icon: supportedTokensAndChains.ethereum.tokens[0].icon,
});

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
  undefined
);

interface ConfigProviderProps {
  children?: React.ReactNode;
  accessToken?: string;
}

type ChainType = {
  name: string;
  icon: string;
  id: number;
};

type Token = {
  name: string;
  icon: string;
};

export type TransactionStatus = {
  id: string;
  status: "initialised" | "broadcast" | "inblock" | "finality" | "completed";
  txnHash?: `0x${string}`;
  orderId: number;
  tokenAmount: number;
  tokenAddress: `0x${string}`;
  creditsAmount?: number;
};

export const ConfigProvider: React.FC<ConfigProviderProps> = ({
  children,
  accessToken,
}) => {
  const { getToken } = useAuth();
  const { selected } = useAvailAccount();
  const { api } = useAvailWallet();
  const [token, setToken] = useState<string>(accessToken ?? "");
  const [selectedChain, setSelectedChain] =
    useState<ChainType>(getDefaultChain);
  const [selectedToken, setSelectedToken] = useState<Token | undefined>(
    getDefaultToken
  );
  const [transactionStatusList, setTransactionStatusList] = useState<
    TransactionStatus[]
  >([]);
  const [showTransaction, setShowTransaction] = useState<TransactionStatus>();
  const [availNativeBalance, setAvailNativeBalance] = useState<string>("0");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    fetchToken();

    if (typeof window !== "undefined") {
      try {
        const storedChain = localStorage.getItem(STORAGE_KEYS.SELECTED_CHAIN);
        const storedToken = localStorage.getItem(STORAGE_KEYS.SELECTED_TOKEN);

        if (storedChain) {
          const parsedChain = JSON.parse(storedChain);
          setSelectedChain(parsedChain);
        }

        if (storedToken) {
          const parsedToken = JSON.parse(storedToken);
          setSelectedToken(parsedToken);
        }
      } catch (error) {
        console.warn("Failed to parse stored chain/token preferences:", error);
      }

      setIsHydrated(true);
    }
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

  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(
          STORAGE_KEYS.SELECTED_CHAIN,
          JSON.stringify(selectedChain)
        );
      } catch (error) {
        console.warn("Failed to save selected chain to localStorage:", error);
      }
    }
  }, [selectedChain, isHydrated]);

  useEffect(() => {
    if (isHydrated && selectedToken) {
      try {
        localStorage.setItem(
          STORAGE_KEYS.SELECTED_TOKEN,
          JSON.stringify(selectedToken)
        );
      } catch (error) {
        console.warn("Failed to save selected token to localStorage:", error);
      }
    }
  }, [selectedToken, isHydrated]);

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
        api
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
