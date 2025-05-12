"use client";
import { Tokens } from "@/lib/types";
import { AppDetails } from "@/services/credit/response";
import React, {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useMemo,
  useState,
} from "react";

interface OverviewContextType {
  creditBalance: number;
  setCreditBalance: Dispatch<SetStateAction<number>>;
  filter: Filter;
  setFilter: Dispatch<SetStateAction<Filter>>;
  appsList: AppDetails[];
  setAppsList: Dispatch<SetStateAction<AppDetails[]>>;
  supportedTokens: Tokens[];
  setSupportedTokens: Dispatch<SetStateAction<Tokens[]>>;
  setAPIKeys: Dispatch<SetStateAction<Record<string, string[]> | undefined>>;
  apiKeys?: Record<string, string[]>;
}

export type Filter = "All" | "Allocated";

export const OverviewContext = createContext<OverviewContextType | undefined>(
  undefined
);

interface OverviewProviderProps {
  children?: React.ReactNode;
  creditBalance?: number;
}

export const OverviewProvider: React.FC<OverviewProviderProps> = ({
  children,
  creditBalance: mainCreditBalance,
}) => {
  const [creditBalance, setCreditBalance] = useState<number>(
    mainCreditBalance ?? 0
  );
  const [supportedTokens, setSupportedTokens] = useState<Tokens[]>([]);
  const [appsList, setAppsList] = useState<AppDetails[]>([]);
  const [apiKeys, setAPIKeys] = useState<Record<string, string[]>>();
  const [filter, setFilter] = useState<Filter>("All");

  const filterAppList = useMemo(
    () =>
      appsList.filter((app) =>
        filter === "Allocated" ? app.credit_balance !== "0" : true
      ),
    [appsList, filter]
  );

  return (
    <OverviewContext.Provider
      value={{
        creditBalance,
        setCreditBalance,
        appsList: filterAppList,
        setAppsList,
        supportedTokens,
        setSupportedTokens,
        apiKeys,
        setAPIKeys,
        setFilter,
        filter,
      }}
    >
      {children}
    </OverviewContext.Provider>
  );
};

export const useOverview = () => {
  const context = useContext(OverviewContext);

  if (context === undefined) {
    throw new Error("useOverview must be used within a OverviewProvider");
  }

  return context;
};
