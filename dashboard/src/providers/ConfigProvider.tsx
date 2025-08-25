"use client";
import { getTokenBalance } from "@/module/purchase-credit/utils";
import { Chain, ClickHandler } from "@/module/purchase-credit/utils/types";
import { supportedTokensAndChains } from "@/lib/types";
import { useAvailAccount, useAvailWallet } from "avail-wallet-sdk";
import { useAuth } from "./AuthProvider";
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
  blockhash?: `0x${string}`;
  orderId: number;
  tokenAmount: number;
  tokenAddress: `0x${string}`;
  creditsAmount?: number;
  chainType: "avail" | "ethereum" | "base";
};

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const { token } = useAuth();
  const { selected } = useAvailAccount();
  const { api } = useAvailWallet();

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

  // Add debounce ref to prevent rapid API calls
  const lastFetchTimeRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);

  useEffect(() => {
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
    // Define fetchAvailBalance inside useEffect to ensure stable reference
    const fetchAvailBalance = async () => {
      if (!selected?.address || !api) {
        return;
      }

      // Debounce mechanism: prevent calls within 1 second of each other
      const now = Date.now();
      if (now - lastFetchTimeRef.current < 1000) {
        console.log("Skipping balance fetch due to debounce");
        return;
      }

      // Prevent concurrent fetches
      if (isFetchingRef.current) {
        console.log("Skipping balance fetch - already in progress");
        return;
      }

      isFetchingRef.current = true;
      lastFetchTimeRef.current = now;

      try {
        // Add timeout to prevent hanging requests
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Balance fetch timeout")), 10000)
        );

        const balancePromise = getTokenBalance(
          Chain.AVAIL,
          selected.address as `0x${string}`,
          api
        );

        // Race between the balance call and timeout
        const balance = await Promise.race([balancePromise, timeoutPromise]);
        setAvailNativeBalance(balance as string);
      } catch (error) {
        console.error("Failed to fetch Avail balance:", error);
        setAvailNativeBalance("0");
      } finally {
        isFetchingRef.current = false;
      }
    };

    if (selected?.address && api) {
      // Initial balance fetch with small delay to allow wallet to stabilize
      setTimeout(() => {
        fetchAvailBalance();
      }, 1000);

      // Set up interval for periodic updates
      intervalRef.current = setInterval(() => {
        fetchAvailBalance();
      }, 20000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Reset debounce state on cleanup
      isFetchingRef.current = false;
    };
  }, [selected?.address, api]); // Now properly depends only on primitive values

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

  return (
    <ConfigContext.Provider
      value={{
        token: token || undefined,
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
