import { ClickHandler } from "@/module/purchase-credit/utils/types";
import { useMemo } from "react";
import { useAccount, useSwitchChain } from "wagmi";

export const useDesiredChain = (desiredChain: number) => {
  const { chainId } = useAccount();
  const { chains, error, switchChain, switchChainAsync } = useSwitchChain();

  const selectedChain = chains.find(
    (ch: { id: number }) => ch.id === desiredChain,
  );

  const isDesiredChain = useMemo(() => {
    if (!chainId || !chains) return false;

    const chainObj = chainId === selectedChain?.id;
    if (!chainObj) return false;
    return true;
  }, [selectedChain?.id, chainId, chains]);

  const chainChanger = async () => {
    try {
      switchChain?.({ chainId: selectedChain?.id! });
    } catch (e) {
      console.error(e, error);
    }
  };

  const chainChangerAsync = async (callback?: ClickHandler) => {
    try {
      return switchChainAsync?.({ chainId: selectedChain?.id! })
        .then(() => {
          callback?.();
          return true;
        })
        .catch((error) => {
          return false;
        });
    } catch (e) {
      return false;
    }
  };

  return { isDesiredChain, chainChanger, chainChangerAsync };
};
