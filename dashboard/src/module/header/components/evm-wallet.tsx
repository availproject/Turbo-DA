"use client";
import { Text } from "@/components/text";
import { truncateAddress } from "@/lib/utils";
import { chainList } from "@/module/purchase-credit/utils/constant";
import { useConfig } from "@/providers/ConfigProvider";
import { ConnectKitButton } from "connectkit";
import { Copy, LogOut } from "lucide-react";
import Image from "next/image";
import { useAccount, useBalance, useDisconnect } from "wagmi";

const EVMWallet = () => {
  const account = useAccount();
  const { selectedChain, setSelectedChain, setSelectedToken } = useConfig();
  const { disconnect } = useDisconnect();
  const result = useBalance({
    address: account.address,
  });

  console.log({
    account,
  });

  return (
    <div className="w-full">
      <ConnectKitButton.Custom>
        {(props) => {
          if (!props.isConnected) {
            return (
              <div
                className="flex gap-x-2 items-center cursor-pointer w-fit"
                onClick={() => props.show?.()}
              >
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
                  className="underline underline-offset-2"
                >
                  Connect EVM Wallet
                </Text>
              </div>
            );
          }

          return (
            <>
              <Text variant={"secondary-grey"} size={"sm"} weight={"medium"}>
                Ethereum Wallet
              </Text>
              <div className="bg-[#2b47613d] w-full rounded-lg mt-2">
                <div className="flex justify-between items-center gap-x-2 w-full py-4 px-3">
                  <div className="flex gap-x-2 items-center">
                    <Image
                      src={account.connector?.icon ?? "/common-wallet.svg"}
                      width={24}
                      height={24}
                      alt="logo"
                    />
                    <Text weight={"semibold"}>
                      {account.address ? truncateAddress(account.address) : ""}
                    </Text>
                  </div>
                  <div className="flex gap-x-3">
                    {account?.address && (
                      <Copy
                        size={20}
                        color="#B3B3B3"
                        strokeWidth={2}
                        className="cursor-pointer"
                        onClick={() =>
                          navigator.clipboard.writeText(account.address!)
                        }
                      />
                    )}
                    <LogOut
                      size={20}
                      color="#B3B3B3"
                      className="cursor-pointer"
                      strokeWidth={2}
                      onClick={() => {
                        if (selectedChain?.name === "Ethereum") {
                          setSelectedChain(chainList.ethereum);
                          setSelectedToken(chainList.ethereum.tokens[0]);
                        }
                        disconnect();
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
                    {Number(result.data?.formatted).toFixed(4)}{" "}
                    {result.data?.symbol}
                  </Text>
                </div>
              </div>
            </>
          );
        }}
      </ConnectKitButton.Custom>
    </div>
  );
};

export default EVMWallet;
