import { Logger } from "@/lib/logger";
import { fetchTokenBalances, fetchTransactions } from "@/lib/services";
import { Balances, Transaction } from "@/lib/types";
import {
  capitalizeFirstLetter,
  getTokenDecimals,
  getTokenNameByAddress,
  getTokenTicker,
  template,
} from "@/lib/utils";
import { useCommonStore } from "@/store/common";
// import { showFailedMessage } from "@/utils/toasts";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import useWallet from "./useWallet";

export default function useTransactions() {
  const { switchNetwork, activeUserAddress, activeNetworkId, showBalance } =
    useWallet();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { setTokenBalances, setRecentTransactions } = useCommonStore();
  const { isConnected } = useAccount();

  /** Poll transactions here every 30 seconds */
  useEffect(() => {
    // pollWithDelay(getTransactions, [], 300, () => true);
  }, [activeNetworkId, isConnected]);

  /**
   * TODO: we'll implement everything related to the handling incoming transactions here
   *
   * 1. getTransactions() -
   *     a. fetch all transactions for the user from the api
   *     b. return the transactions in a sorted | desired way
   *     c. add to transaction store
   *
   * 3. getTokenBalances() -
   *   a. fetch balances for all tokens
   *   b. update the token store
   *
   * poll both every 30 seconds
   */

  const getTransactions = useCallback(async () => {
    /**
     * STEPS
     *
     * 0. sanity checks {isConnected, isLoggedIn}
     * 1. fetch all transactions for the user from fetchTransactions()
     * 2. sort the transactions + add token images + metadata
     * 2. add to transaction store(zustand)
     *
     */

    try {
      console.log("fetching transactions");
      if (!isSignedIn) {
        throw new Error("User not signed in. Did you forget to sign in?");
      }

      const token = await getToken({ template });
      if (!token) {
        throw new Error("Failed to retrieve authentication token.");
      }

      const transactions = await fetchTransactions(token);
      if (!transactions) throw new Error("Error fetching transactions");

      const _recentTransactions: Transaction[] = [];

      transactions.requests.forEach(async (transaction) => {
        const tokenName = getTokenNameByAddress(transaction.token_address);

        _recentTransactions.push({
          ...transaction,
          token_name: tokenName,
          token_image: `/tokens/${transaction.token_address}.png`,
        });
      });

      setRecentTransactions(
        _recentTransactions.sort((a, b) =>
          b.created_at.localeCompare(a.created_at)
        )
      );
    } catch (error: any) {
      Logger.error(
        `TRANSACTION_FETCHER_ERROR ${error.message} - ${error.status}`
      );
    }
  }, [getToken, isSignedIn, setRecentTransactions]);

  const getTokenBalances = useCallback(async () => {
    try {
      if (!isSignedIn) {
        throw new Error("User not signed in. Did you forget to sign in?");
      }

      const token = await getToken({ template });
      if (!token) {
        throw new Error("Failed to retrieve authentication token.");
      }

      const balances = await fetchTokenBalances(token);
      if (!balances) throw new Error("Error fetching balances");

      const response = balances.results;

      const _balances: Balances[] = [];

      response.forEach(async (token) => {
        const tokenName = getTokenNameByAddress(token.token_address);
        const tokenDecimals = getTokenDecimals(tokenName);
        const tokenTicker = getTokenTicker(tokenName);

        _balances.push({
          token_name: capitalizeFirstLetter(tokenName),
          token_address: token.token_address,
          token_image: `/tokens/${token.token_address}.png`,
          token_balance: formatUnits(
            BigInt(token.token_balance),
            tokenDecimals
          ),
          token_ticker: tokenTicker,
          token_used: formatUnits(BigInt(token.token_used), tokenDecimals),
        });
      });

      setTokenBalances(_balances);

      setTokenBalances(_balances);
      return _balances;
    } catch (error: any) {
      Logger.error(`BALANCE_FETCHER_ERROR ${error.message} - ${error.status}`);
      // showFailedMessage({
      //   title: "Error",
      //   description: "An error occurred while fetching token balances",
      // });
    }
  }, [getToken, isSignedIn, setTokenBalances]);

  return {
    getTransactions,
    getTokenBalances,
  };
}
