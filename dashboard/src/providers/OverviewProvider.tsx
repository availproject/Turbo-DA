"use client";
import { Tokens } from "@/lib/types";
import { APP_TABS } from "@/lib/utils";
import { AppDetails } from "@/services/app/response";
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
  mainTabSelected: APP_TABS;
  setMainTabSelected: Dispatch<SetStateAction<APP_TABS>>;
}

export type Filter = "All" | "Allocated" | "Unallocated";

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
  const [mainTabSelected, setMainTabSelected] = useState<APP_TABS>(
    APP_TABS.OVERVIEW
  );

  const filterAppList = useMemo(
    () =>
      appsList.filter((app) =>
        filter === "Allocated"
          ? app.credit_balance !== "0"
          : filter === "Unallocated"
          ? app.credit_balance === "0"
          : true
      ),
    [appsList, filter]
  );

  const allAppList = useMemo(() => {
    return filterAppList.filter((app) => app.app_name);
  }, [filterAppList]);

  return (
    <OverviewContext.Provider
      value={{
        creditBalance,
        setCreditBalance,
        appsList: allAppList,
        setAppsList,
        supportedTokens,
        setSupportedTokens,
        apiKeys,
        setAPIKeys,
        setFilter,
        filter,
        mainTabSelected,
        setMainTabSelected,
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
