/* eslint-disable react-hooks/exhaustive-deps */
import { config } from "@/config/walletConfig";
import { getChainId, readContract } from "@wagmi/core";
import { useCallback, useMemo } from "react";
import { erc20Abi } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { getBalance } from "wagmi/actions";

/**
 * @description All the functionalities related to wallet such as connecting, switching network, etc
 */
export default function useWallet() {
  const { switchChainAsync } = useSwitchChain();
  const { address, isConnected, chainId } = useAccount();

  const switchNetwork = async (chainId: number) => {
    await switchChainAsync({ chainId: chainId });
  };

  const activeUserAddress = useMemo(() => {
    if (!isConnected) {
      return null;
    }

    return address;
  }, [chainId]);

  const activeNetworkId = useMemo(() => {
    const activeNetworkId = getChainId(config);
    return activeNetworkId;
  }, [chainId]);

  const showBalance = useCallback(
    async ({ token, chainId: targetChainId }: { token?: `0x${string}`, chainId?: number }) => {
      if (!address) {
        return null;
      }
      const balance = await getBalance(config, {
        address: address,
        token: token,
        chainId: targetChainId || activeNetworkId,
      });
      return balance.formatted;
    },
    [address, chainId, activeNetworkId],
  );

  const getERC20AvailBalance = useCallback(
    async (address: `0x${string}`, tokenAddress?: string, chainId?: number) => {
      await readContract(config, {
        address: (tokenAddress || "0x8B42845d23C68B845e262dC3e5cAA1c9ce9eDB44") as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
        chainId: chainId || activeNetworkId,
      })
        .then((balance) => {
          if (!balance) return new BigNumber(0);
          return new BigNumber(balance as bigint);
        })
        .catch((error) => {
          console.log(error);
        });
    },
    [activeNetworkId],
  );

  /**
   * TODO: implement a function that fetches dollar value from coingecko api
   *
   * fetchDollarValue()
   */

  return {
    activeUserAddress,
    activeNetworkId,
    switchNetwork,
    showBalance,
    getERC20AvailBalance,
  };
}
