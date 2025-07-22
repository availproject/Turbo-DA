import { Text } from "@/components/text";
import { truncateAddress } from "@/lib/utils";
import { chainList } from "@/module/purchase-credit/utils/constant";
import { useConfig } from "@/providers/ConfigProvider";
import { AvailWalletConnect, useAvailAccount, useAvailWallet } from "avail-wallet-sdk";
import { Copy, LogOut } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

const AvailWallet = () => {
  const { selected, selectedWallet, clearWalletState } = useAvailAccount();
  const { api } = useAvailWallet();
  const { selectedChain, setSelectedChain, setSelectedToken } = useConfig();
  const [availBalance, setAvailBalance] = useState<string>("0.0000");

  // Fetch Avail balance when account changes
  useEffect(() => {
    if (api && selected?.address) {
      fetchAvailBalance();
    }
  }, [api, selected?.address]);

  const fetchAvailBalance = async () => {
    if (!api || !selected?.address) return;
    
    try {
      const balance = await api.query.system.account(selected.address);
      // @ts-ignore - Balance type compatibility between different Polkadot versions
      const freeBalance = balance.data.free.toString();
      
      // Avail uses 18 decimals
      const decimals = 18;
      const divisor = BigInt(10 ** decimals);
      const freeBalanceBigInt = BigInt(freeBalance);
      const wholePart = freeBalanceBigInt / divisor;
      const remainder = freeBalanceBigInt % divisor;
      
      // Convert remainder to decimal with proper precision
      const fractionalPart = remainder.toString().padStart(decimals, '0');
      const balanceStr = `${wholePart.toString()}.${fractionalPart}`;
      const balanceNumber = parseFloat(balanceStr);
      
      setAvailBalance(balanceNumber.toFixed(4));
    } catch (error) {
      console.error("Error fetching Avail balance:", error);
      setAvailBalance("0.0000");
    }
  };

  console.log({
    selectedWallet,
    selected,
  });

  return (
    <div className="w-full">
      <AvailWalletConnect
        connectedChildren={
          <>
            <Text variant={"secondary-grey"} size={"sm"} weight={"medium"}>
              Avail Wallet
            </Text>
            <div className="bg-[#2b47613d] w-full rounded-lg mt-2">
              <div className="flex justify-between items-center gap-x-2 w-full py-4 px-3">
                <div className="flex gap-x-2 items-center">
                  <Image
                    src={"/avail-icon.svg"}
                    width={24}
                    height={24}
                    alt={"avail wallet"}
                    className="w-6 h-6"
                  />
                  {selected?.address && (
                    <Text weight={"semibold"}>
                      {truncateAddress(selected?.address)}
                    </Text>
                  )}
                </div>
                <div className="flex gap-x-3">
                  <Copy
                    size={20}
                    color="#B3B3B3"
                    strokeWidth={2}
                    className="cursor-pointer"
                    onClick={() =>
                      selected?.address &&
                      navigator.clipboard.writeText(selected?.address)
                    }
                  />
                  <LogOut
                    size={20}
                    color="#B3B3B3"
                    strokeWidth={2}
                    className="cursor-pointer"
                    onClick={() => {
                      if (selectedChain?.name === "Avail") {
                        setSelectedChain(chainList.ethereum);
                        setSelectedToken(chainList.ethereum.tokens[0]);
                      }
                      clearWalletState();
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center gap-x-2 py-4 px-3 border-t border-t-border-blue">
                <div className="flex gap-x-2 items-center">
                  <Image
                    src={"/common-wallet.svg"}
                    width={24}
                    height={24}
                    alt="common-wallet"
                  />
                  <Text
                    weight={"medium"}
                    size={"sm"}
                    variant={"secondary-grey"}
                  >
                    Balance
                  </Text>
                </div>
                <Text weight={"semibold"} size={"sm"}>
                  {availBalance} AVAIL
                </Text>
              </div>
            </div>
          </>
        }
      >
        <div className="flex gap-x-2 items-center cursor-pointer w-fit">
          <Image
            src={"/avail-icon.svg"}
            width={24}
            height={24}
            alt="common-wallet"
          />
          <Text
            weight={"medium"}
            size={"sm"}
            variant={"secondary-grey"}
            className="underline underline-offset-2"
          >
            Connect Avail Wallet
          </Text>
        </div>
      </AvailWalletConnect>
    </div>
  );
};

export default AvailWallet;
