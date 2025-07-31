import { useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import AuthenticationService from "@/services/authentication";
import { useCallback, useState, useEffect } from "react";
import { useAccount, useBalance as useWagmiBalance } from "wagmi";
import { config } from "@/config/walletConfig";
import { readContract, getBalance } from "@wagmi/core";
import { TOKEN_MAP } from "@/lib/types";
import BigNumber from "bignumber.js";

// Custom event for transaction completion
const TRANSACTION_COMPLETED_EVENT = "transactionCompleted";

// Dispatch transaction completed event
export const dispatchTransactionCompleted = () => {
  window.dispatchEvent(new CustomEvent(TRANSACTION_COMPLETED_EVENT));
};

const useBalance = () => {
  const [loading, setLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const { setCreditBalance, creditBalance } = useOverview();
  const { token } = useConfig();
  const account = useAccount();

  const updateCreditBalance = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await AuthenticationService.fetchUser({ token });
      const mainCreditBalance = +response?.data?.credit_balance || 0;
      setCreditBalance(mainCreditBalance);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }, [token, setCreditBalance]);

  // Function to refresh AVAIL ERC20 balance on Ethereum
  const refreshAvailERC20Balance = useCallback(async () => {
    if (!account.address || !account.chainId) return;

    try {
      const availTokenAddress = TOKEN_MAP.avail?.token_address;
      if (!availTokenAddress) return;

      const erc20Abi = [
        {
          type: "function",
          name: "balanceOf",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
        },
      ] as const;

      await readContract(config, {
        address: availTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
        chainId: account.chainId,
      });

      // Force refresh by incrementing counter
      setRefreshCounter((prev) => prev + 1);
    } catch (error) {
      console.error("Error refreshing AVAIL ERC20 balance:", error);
    }
  }, [account.address, account.chainId]);

  // Function to refresh ETH balance
  const refreshETHBalance = useCallback(async () => {
    if (!account.address || !account.chainId) return;

    try {
      await getBalance(config, {
        address: account.address,
        chainId: account.chainId,
      });

      // Force refresh by incrementing counter
      setRefreshCounter((prev) => prev + 1);
    } catch (error) {
      console.error("Error refreshing ETH balance:", error);
    }
  }, [account.address, account.chainId]);

  // Function to refresh all token balances
  const refreshTokenBalances = useCallback(async () => {
    await Promise.all([refreshAvailERC20Balance(), refreshETHBalance()]);

    // Increment refresh counter to trigger wagmi hooks to refresh
    setRefreshCounter((prev) => prev + 1);
  }, [refreshAvailERC20Balance, refreshETHBalance]);

  // Combined function to update both credit balance and token balances
  const updateAllBalances = useCallback(async () => {
    console.log("Updating all balances...");
    await Promise.all([updateCreditBalance(), refreshTokenBalances()]);
  }, [updateCreditBalance, refreshTokenBalances]);

  // Listen for transaction completion events
  useEffect(() => {
    const handleTransactionCompleted = () => {
      console.log("Transaction completed event received, updating balances...");
      updateAllBalances();
    };

    window.addEventListener(
      TRANSACTION_COMPLETED_EVENT,
      handleTransactionCompleted
    );

    return () => {
      window.removeEventListener(
        TRANSACTION_COMPLETED_EVENT,
        handleTransactionCompleted
      );
    };
  }, [updateAllBalances]);

  return {
    loading,
    updateCreditBalance,
    refreshTokenBalances,
    refreshAvailERC20Balance,
    refreshETHBalance,
    updateAllBalances,
    refreshCounter,
    creditBalance: +creditBalance,
  };
};

export default useBalance;
