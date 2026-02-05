"use client";
import { getTokenBalance } from "@/module/purchase-credit/utils";
import { Chain } from "@/module/purchase-credit/utils/types";
import { getSupportedTokensAndChains, SupportedTokensAndChains } from "@/lib/types";
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

interface ConfigContextType {
  token?: string;
  selectedChain: ChainType;
  setSelectedChain: Dispatch<SetStateAction<ChainType | undefined>>;
  setSelectedToken: Dispatch<SetStateAction<Token | undefined>>;
  selectedToken?: Token;
  transactionStatusList: TransactionStatus[];
  setTransactionStatusList: Dispatch<SetStateAction<TransactionStatus[]>>;
  showTransaction?: TransactionStatus;
  setShowTransaction: Dispatch<SetStateAction<TransactionStatus | undefined>>;
  availNativeBalance: string;
  supportedTokensAndChains: SupportedTokensAndChains;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(
  undefined,
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

  const [supportedTokensAndChains, setSupportedTokensAndChains] =
    useState<SupportedTokensAndChains>({});
  const [selectedChain, setSelectedChain] = useState<ChainType>();
  const [selectedToken, setSelectedToken] = useState<Token | undefined>();
  const [transactionStatusList, setTransactionStatusList] = useState<
    TransactionStatus[]
  >([]);
  const [showTransaction, setShowTransaction] = useState<TransactionStatus>();
  const [availNativeBalance, setAvailNativeBalance] = useState<string>("0");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    getSupportedTokensAndChains().then((chains) => {
      setSupportedTokensAndChains(chains);
      const isMainnet = process.env.NEXT_PUBLIC_ETH_NETWORK === "mainnet";
      const availableChains = Object.values(chains).filter(
        (chain) => chain.isTestnet === "both" || chain.isTestnet === !isMainnet
      );
      const defaultChain = availableChains[0];

      if (typeof window !== "undefined") {
        try {
          const storedChain = localStorage.getItem(STORAGE_KEYS.SELECTED_CHAIN);
          const storedToken = localStorage.getItem(STORAGE_KEYS.SELECTED_TOKEN);

          if (storedChain) {
            setSelectedChain(JSON.parse(storedChain));
          } else if (defaultChain) {
            setSelectedChain({
              name: defaultChain.name,
              icon: defaultChain.icon,
              id: defaultChain.id,
            });
          }

          if (storedToken) {
            setSelectedToken(JSON.parse(storedToken));
          } else if (defaultChain) {
            setSelectedToken({
              name: defaultChain.tokens[0].name,
              icon: defaultChain.tokens[0].icon,
            });
          }
        } catch (error) {
          console.warn("Failed to parse stored chain/token preferences:", error);
          if (defaultChain) {
            setSelectedChain({
              name: defaultChain.name,
              icon: defaultChain.icon,
              id: defaultChain.id,
            });
            setSelectedToken({
              name: defaultChain.tokens[0].name,
              icon: defaultChain.tokens[0].icon,
            });
          }
        }

        setIsHydrated(true);
      } else if (defaultChain) {
        setSelectedChain({
          name: defaultChain.name,
          icon: defaultChain.icon,
          id: defaultChain.id,
        });
        setSelectedToken({
          name: defaultChain.tokens[0].name,
          icon: defaultChain.tokens[0].icon,
        });
      }
    });
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
  }, [selected?.address, api]);

  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(
          STORAGE_KEYS.SELECTED_CHAIN,
          JSON.stringify(selectedChain),
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
          JSON.stringify(selectedToken),
        );
      } catch (error) {
        console.warn("Failed to save selected token to localStorage:", error);
      }
    }
  }, [selectedToken, isHydrated]);

  const fetchAvailBalance = async () => {
    if (!selected?.address || !api) {
      return;
    }

    try {
      const balance = await getTokenBalance(
        Chain.AVAIL,
        selected.address as `0x${string}`,
        api,
      );
      setAvailNativeBalance(balance);
    } catch (error) {
      console.error("Failed to fetch Avail balance:", error);
      setAvailNativeBalance("0");
    }
  };

  if (!selectedChain) {
    return null;
  }

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
        supportedTokensAndChains,
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
