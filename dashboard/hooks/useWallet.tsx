/* eslint-disable react-hooks/exhaustive-deps */
import { config } from "@/app/providers";
import { useCallback, useMemo } from "react";
import { useSwitchChain, useAccount } from "wagmi";
import { getBalance } from "wagmi/actions";
import { getChainId } from '@wagmi/core'

/**
 * @description All the functionalities related to wallet such as connecting, switching network, etc
 */
export default function useWallet() {
    const { switchChainAsync } = useSwitchChain();
    const { address, isConnected, chainId } = useAccount();

    const switchNetwork =
        async (chainId: number) => {
            await switchChainAsync({ chainId: chainId })
        }

    const activeUserAddress = useMemo(
        () => {
            if(!isConnected) {
                return null
            }
            
            return address
        },

        [chainId],
    );

    const activeNetworkId = useMemo(()=>{
        const activeNetworkId = getChainId(config)
        return activeNetworkId

    },[chainId])

    const showBalance = useCallback( async ({token} : {token?: `0x${string}`} ) => {
        if(!address) {
            return null
        }
        //TOCHECK: should we use the chainId from the parameter or the one from the hook or does it even matter?
        const balance = await getBalance(config, { address: address, token: token, chainId: activeNetworkId })
        return balance.formatted

    } , [address, chainId])

    /**
     * TODO: implement a function that fetches dollar value from coingecko api
     * 
     * fetchDollarValue() 
     */

    return {
        activeUserAddress,
        activeNetworkId,
        switchNetwork, 
        showBalance
    };
}
