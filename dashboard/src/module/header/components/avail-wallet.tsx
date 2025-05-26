import { Text } from "@/components/text";
import { truncateAddress } from "@/lib/utils";
import { useConfig } from "@/providers/ConfigProvider";
import { Copy, LogOut } from "lucide-react";
import Image from "next/image";
import { AvailWalletConnect, useAvailAccount } from "wallet-sdk";

const AvailWallet = () => {
  const { selected, selectedWallet, clearWalletState } = useAvailAccount();
  const { selectedChain, setSelectedChain, setSelectedToken } = useConfig();
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
                      {truncateAddress(selected?.address!)}
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
                      navigator.clipboard.writeText(selected?.address!)
                    }
                  />
                  <LogOut
                    size={20}
                    color="#B3B3B3"
                    strokeWidth={2}
                    className="cursor-pointer"
                    onClick={() => {
                      if (selectedChain?.name === "Avail") {
                        setSelectedChain(undefined);
                        setSelectedToken(undefined);
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
                  1.32 ETH
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
