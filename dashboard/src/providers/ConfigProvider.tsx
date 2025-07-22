"use client";
import { template } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import React, {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react";

interface ConfigContextType {
  token?: string;
  fetchToken: () => void;
  selectedChain: Chain;
  setSelectedChain: Dispatch<SetStateAction<Chain>>;
  setSelectedToken: Dispatch<SetStateAction<Token | undefined>>;
  selectedToken?: Token;
  transactionStatusList: TransactionStatus[];
  setTransactionStatusList: Dispatch<SetStateAction<TransactionStatus[]>>;
  showTransaction?: TransactionStatus;
  setShowTransaction: Dispatch<SetStateAction<TransactionStatus | undefined>>;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(
  undefined
);

interface ConfigProviderProps {
  children?: React.ReactNode;
  accessToken?: string;
}

type Chain = {
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
  const [token, setToken] = useState<string>(accessToken ?? "");
  const [selectedChain, setSelectedChain] = useState<Chain>({
    name: "Avail",
    icon: "/avail-icon.svg",
  });
  const [selectedToken, setSelectedToken] = useState<Token | undefined>({
    name: "AVAIL",
    icon: "/avail-icon.svg",
  });
  const [transactionStatusList, setTransactionStatusList] = useState<
    TransactionStatus[]
  >([]);
  const [showTransaction, setShowTransaction] = useState<TransactionStatus>();

  useEffect(() => {
    fetchToken();
  }, []);

  const fetchToken = async () => {
    await getToken({ template: template })
      .then((res) => {
        if (res) setToken(res);
      })
      .catch((err) => {
        console.error(err);
      });
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
