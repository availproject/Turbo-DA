"use client";
import { APP_TABS, cn, formatDataBytes } from "@/lib/utils";
import { useOverview } from "@/providers/OverviewProvider";
import { useConfig } from "@/providers/ConfigProvider";
import HistoryService from "@/services/history";
import { CreditRequest } from "@/services/history/response";
import { SignInButton } from "@clerk/nextjs";
import { useAuthState } from "@/providers/AuthProvider";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { supportedTokensAndChains } from "@/lib/types";

import Button from "@/components/button";
import DynamicTable from "@/components/data-table";
import Label from "@/components/label";
import { Text } from "@/components/text";
import { Skeleton } from "@/components/ui/skeleton";
import Label from "@/components/label";
import EmptyState from "./empty-state";

const CreditHistory = () => {
  const [historyList, setHistoryList] = useState<CreditRequest[]>();
  const [loading, setLoading] = useState(true);
  const { setMainTabSelected } = useOverview();
  const { isAuthenticated, isLoggedOut, token } = useAuthState();
  const { transactionStatusList } = useConfig();

  const fetchHistory = useCallback(async () => {
    if (!token) return;

    try {
      const response = await HistoryService.getCreditHistory({
        token,
      });
      // Sort by latest transactions first and add token information
      const sortedData = (response?.data ?? [])
        .sort(
          (a: CreditRequest, b: CreditRequest) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .map((item: CreditRequest) => ({
          ...item,
          token: item.chain_id, // Use chain_id to determine token
        }));
      setHistoryList(sortedData);
    } catch (error) {
      console.log(error);
      setHistoryList([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchHistory();
    } else if (isLoggedOut) {
      setHistoryList([]);
      setLoading(false);
    }
  }, [isAuthenticated, token, isLoggedOut, fetchHistory]);

  // Refresh history when transactions update to get latest status
  useEffect(() => {
    if (isAuthenticated && token && transactionStatusList.length > 0) {
      const hasActiveTransactions = transactionStatusList.some(
        (tx) =>
          tx.status === "broadcast" ||
          tx.status === "inblock" ||
          tx.status === "finality"
      );

      const hasCompletedTransactions = transactionStatusList.some(
        (tx) => tx.status === "completed"
      );

      if (hasActiveTransactions || hasCompletedTransactions) {
        // Debounce the refresh to avoid too many API calls
        const timeoutId = setTimeout(
          () => {
            fetchHistory();
          },
          hasCompletedTransactions ? 500 : 1000
        ); // Faster refresh for completed transactions

        return () => clearTimeout(timeoutId);
      }
    }
  }, [transactionStatusList, isAuthenticated, token, fetchHistory]);

  // Listen for transaction completion events to trigger immediate refresh
  useEffect(() => {
    const handleTransactionCompleted = () => {
      if (isAuthenticated && token) {
        // Immediate refresh since backend is fast
        fetchHistory();
      }
    };

    window.addEventListener(
      "transaction-completed",
      handleTransactionCompleted
    );

    return () => {
      window.removeEventListener(
        "transaction-completed",
        handleTransactionCompleted
      );
    };
  }, [isAuthenticated, token, fetchHistory]);

  // Helper function to get chain info from supportedTokensAndChains
  const getChainInfo = useCallback((chainId: number) => {
    // Find the chain by ID in supportedTokensAndChains
    for (const [chainKey, chainData] of Object.entries(
      supportedTokensAndChains
    )) {
      if (chainData.id === chainId) {
        return {
          logo: chainData.icon,
          name: chainData.name,
          tokens: chainData.tokens,
        };
      }
    }
    // Fallback for unknown chains
    return {
      logo: "/favicon.ico",
      name: "Unknown",
      tokens: [],
    };
  }, []);

  // Helper function to check if a transaction is currently in process
  const isTransactionInProcess = useCallback(
    (historyItem: CreditRequest) => {
      if (!transactionStatusList || transactionStatusList.length === 0)
        return false;

      return transactionStatusList.some((activeTx) => {
        // Skip completed transactions - they should show real server status
        if (activeTx.status === "completed") {
          return false;
        }

        // Only match truly active transactions
        const isActiveStatus =
          activeTx.status === "broadcast" ||
          activeTx.status === "inblock" ||
          activeTx.status === "finality";
        if (!isActiveStatus) {
          return false;
        }

        // Primary matching: by order ID (history.id matches activeTx.orderId)
        if (
          historyItem.id &&
          activeTx.orderId &&
          Number(historyItem.id) === Number(activeTx.orderId)
        ) {
          return true;
        }

        // Secondary matching: by transaction hash (first 5 chars) if both have hashes
        if (
          historyItem.tx_hash &&
          activeTx.txnHash &&
          historyItem.tx_hash.length > 5 &&
          activeTx.txnHash.length > 5
        ) {
          const historyHashFirst5 = historyItem.tx_hash.slice(0, 5);
          const activeHashFirst5 = activeTx.txnHash.slice(0, 5);

          if (historyHashFirst5 === activeHashFirst5) {
            return true;
          }
        }

        return false;
      });
    },
    [transactionStatusList]
  );

  const displayValues = useCallback(
    (heading: string, value: any, rowData?: any) => {
      switch (heading) {
        case "created_at":
          return new Date(value).toLocaleDateString().replaceAll("/", "-");
        case "request_status":
          // Map the API status to Label component status
          let labelStatus: "pending" | "complete" | "cancelled";
          switch (value?.toLowerCase()) {
            case "completed":
            case "success":
              labelStatus = "complete";
              break;
            case "pending":
              labelStatus = "pending";
              break;
            case "failed":
            case "cancelled":
              labelStatus = "cancelled";
              break;
            default:
              labelStatus = "pending";
          }
          return <Label status={labelStatus} />;
        case "amount_credit":
          return value ? `${Number(value).toLocaleString()} Credits` : "-";
        case "amount_paid":
          return value === "-" ? <Text variant={"light-grey"} size={"sm"}>-</Text> : 
                 value === "Amount from blockchain" ? <Text variant={"light-grey"} size={"sm"}>View on Explorer</Text> : 
                 value;
        case "chain_id":
          const chainInfo = getChainInfo(value);
          return (
            <div className="flex items-center gap-x-2">
              <Image
                src={chainInfo.logo}
                alt={chainInfo.name}
                width={20}
                height={20}
              />
              <Text variant={"light-grey"} weight={"semibold"} size={"sm"}>
                {chainInfo.name}
              </Text>
            </div>
          );
        case "token":
          // Get the default token for the chain (first token in the chain's token list)
          const chainInfoForToken = getChainInfo(value);
          const defaultToken = chainInfoForToken.tokens[0];
          if (defaultToken) {
            return (
              <div className="flex items-center gap-x-2">
                <Image
                  src={defaultToken.icon}
                  alt={defaultToken.name}
                  width={20}
                  height={20}
                />
                <Text variant={"light-grey"} weight={"semibold"} size={"sm"}>
                  {defaultToken.name}
                </Text>
              </div>
            );
          }
          return "-";
        case "request_status":
          // Check if this transaction is currently in process
          if (rowData && isTransactionInProcess(rowData)) {
            return <span style={{ fontStyle: "italic" }}>in process</span>;
          }

          let labelStatus: "pending" | "complete" | "cancelled";
          switch (value?.toUpperCase()) {
            case "COMPLETED":
            case "PROCESSED":
              labelStatus = "complete";
              break;
            case "PENDING":
              labelStatus = "cancelled";
              break;
            case "INCLUDED":
              labelStatus = "pending";
              break;
            default:
              return "-";
          }
          return <Label status={labelStatus} />;
        case "tx_hash":
          if (value && value.length > 10 && !value.includes("…")) {
            return `${value.slice(0, 6)}…${value.slice(-4)}`;
          }
          return value ?? "-";
        default:
          return value ?? "-";
      }
    },
    [getChainInfo, isTransactionInProcess]
  );

  return (
    <>
      <div className="h-px bg-[#2B4761]" />
      {!loading && !historyList?.length ? (
        <EmptyState
          message="Your Credit History Would Be Shown Here"
          cta={
            <>
              {!isAuthenticated ? (
                <SignInButton mode="modal" component="div">
                  <Button className="w-[195px]">Sign In</Button>
                </SignInButton>
              ) : (
                <Button
                  className="w-[195px]"
                  onClick={() => {
                    setMainTabSelected(APP_TABS.OVERVIEW);
                  }}
                >
                  Buy Credits
                </Button>
              )}
            </>
          }
        />
      ) : null}
      {loading ? (
        <div className="flex flex-col gap-y-4 mt-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : historyList?.length ? (
        <DynamicTable
          headings={[
            { key: "created_at", label: "Purchasing Date" },
            { key: "request_status", label: "Status" },
            { key: "request_type", label: "Type" },
            { key: "chain_id", label: "Chain" },
            { key: "token", label: "Token" },
            { key: "tx_hash", label: "Amount Paid" },
            { key: "amount_credit", label: "Credit Received" },
          ]}
          listdata={historyList}
          renderCell={(
            heading: string,
            value: any,
            last: boolean,
            rowData?: any
          ) => (
            <div
              className={cn(
                "flex",
                last ? "w-[180px] justify-end" : "w-[150px]"
              )}
            >
              <Text
                weight={"bold"}
                size={"base"}
                className={cn(
                  "py-3 px-4 break-words",
                  !last && "text-right",
                  heading === "amount_credit" &&
                    "whitespace-nowrap overflow-hidden text-ellipsis"
                )}
                variant={heading === "request_type" ? "green" : "white"}
                as={
                  heading === "chain_id" ||
                  heading === "token" ||
                  heading === "request_status"
                    ? "div"
                    : "p"
                }
              >
                {displayValues(heading, value, rowData)}
              </Text>
            </div>
          )}
        />
      ) : null}
    </>
  );
};

export default CreditHistory;
