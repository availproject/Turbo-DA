"use client";
import useTokenMap from "@/hooks/useTokenMap";
import { Tokens } from "@/lib/types";
import { APP_TABS } from "@/lib/utils";
import AppService from "@/services/app";
import { AppDetails } from "@/services/app/response";
import React, {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useConfig } from "./ConfigProvider";
import { useUser } from "./UserProvider";

interface OverviewContextType {
  creditBalance: number;
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
  transactionProgress: TransactionProgress[];
  setTransactionProgress: Dispatch<SetStateAction<TransactionProgress[]>>;
  isAwaitingCreditUpdate: boolean;
  setIsAwaitingCreditUpdate: Dispatch<SetStateAction<boolean>>;
}

type TransactionProgress = {
  id: 1;
};

export type Filter = "All" | "Using Assigned Credits" | "Using Main Credits";

export const OverviewContext = createContext<OverviewContextType | undefined>(
  undefined
);

interface OverviewProviderProps {
  children?: React.ReactNode;
}

export const OverviewProvider: React.FC<OverviewProviderProps> = ({
  children,
}) => {
  const { creditBalance } = useUser();
  const [supportedTokens, setSupportedTokens] = useState<Tokens[]>([]);
  const [appsList, setAppsList] = useState<AppDetails[]>([]);
  const [apiKeys, setAPIKeys] = useState<Record<string, string[]>>();
  const [filter, setFilter] = useState<Filter>("All");
  const [mainTabSelected, setMainTabSelected] = useState<APP_TABS>(
    APP_TABS.OVERVIEW
  );
  const [tokenList, setTokenList] =
    useState<Record<string, Record<string, any>>>();
  const [transactionProgress, setTransactionProgress] = useState<
    TransactionProgress[]
  >([]);
  const [isAwaitingCreditUpdate, setIsAwaitingCreditUpdate] = useState(false);
  const tokenMap = useTokenMap();
  const { token } = useConfig();

  useEffect(() => {
    token &&
      AppService.getTokens({ token })
        .then((response) => {
          console.log(response);
        })
        .catch((error) => {
          console.log(error);
        });
  }, [token]);

  const filterAppList = useMemo(
    () =>
      appsList.filter((app) =>
        filter === "Using Assigned Credits"
          ? app.credit_balance !== "0"
          : filter === "Using Main Credits"
          ? app.credit_balance === "0"
          : true
      ),
    [appsList, filter]
  );

  const allAppList = useMemo(
    () => filterAppList.filter((app) => app.app_id),
    [filterAppList]
  );

  return (
    <OverviewContext.Provider
      value={{
        creditBalance,
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
        transactionProgress,
        setTransactionProgress,
        isAwaitingCreditUpdate,
        setIsAwaitingCreditUpdate,
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
