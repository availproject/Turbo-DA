import { Text } from "@/components/text";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { truncateAddress } from "@/lib/utils";
import { useAvailAccount } from "avail-wallet-sdk";
import { ChevronDown, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useAccount } from "wagmi";
import AvailWallet from "./avail-wallet";
import EVMWallet from "./evm-wallet";

const WalletsMenu = () => {
  const account = useAccount();
  const { selected, selectedWallet } = useAvailAccount();
  const [open, setOpen] = useState(false);

  // if (!account.isConnected && !selected?.address) {
  //   return null;
  // }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className="h-full p-0 border-r border-[#444753]"
      >
        <div className="flex gap-x-4 items-center h-full pr-6 cursor-pointer">
          {!account.isConnected && !selected?.address ? (
            <>
              <Text weight={"semibold"} className="leading-[24px]">
                Connect Wallets
              </Text>
            </>
          ) : (
            <>
              <div className="relative">
                {account.connector?.icon && selectedWallet?.logo?.src ? (
                  <div className="flex items-center">
                    <Image
                      src={account.connector?.icon ?? "/common-wallet.svg"}
                      alt="Ethereum wallet"
                      width={32}
                      height={32}
                      className="h-8 w-8"
                    />
                    <Image
                      src={"/avail-icon.svg"}
                      alt="Avail Wallet"
                      width={32}
                      height={32}
                      className="h-8 w-8 -ml-4"
                    />
                  </div>
                ) : account.connector?.icon ? (
                  <Image
                    src={account.connector?.icon ?? "/common-wallet.svg"}
                    alt="Ethereum wallet"
                    width={32}
                    height={32}
                    className="h-8 w-8"
                  />
                ) : selectedWallet?.logo?.src ? (
                  <Image
                    src={selectedWallet?.logo?.src ?? "/common-wallet.svg"}
                    alt="Avail wallet"
                    width={32}
                    height={32}
                    className="h-8 w-8"
                  />
                ) : null}
              </div>
              {account.connector?.icon && selectedWallet?.logo?.src ? (
                <Text weight={"semibold"} className="leading-6">
                  2 Wallets
                </Text>
              ) : account.connector ? (
                <div className="flex flex-col gap-y-1 cursor-pointer">
                  <Text weight={"semibold"} className="leading-6">
                    {truncateAddress(account.address!)}
                  </Text>
                  <Text
                    size={"sm"}
                    weight={"semibold"}
                    className="leading-[18px] text-[#999]"
                  >
                    {account.chain?.name} Chain
                  </Text>
                </div>
              ) : selected ? (
                <div className="flex flex-col gap-y-1 cursor-pointer">
                  <Text weight={"semibold"} className="leading-6">
                    {truncateAddress(selected.address!)}
                  </Text>
                  <Text
                    size={"sm"}
                    weight={"semibold"}
                    className="leading-[18px] text-[#999]"
                  >
                    Avail Chain
                  </Text>
                </div>
              ) : null}
            </>
          )}

          <ChevronDown size={24} color="#B3B3B3" strokeWidth={2} />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="rounded-lg border border-border-blue p-0 w-[350px] backdrop-blur-2xl bg-[linear-gradient(89.09deg,rgba(9,27,43,0.2)_22.12%,rgba(16,12,20,0.2)_99.08%)]">
        <DropdownMenuGroup className="w-full p-0 flex flex-col items-start gap-y-4">
          <div className="flex justify-between items-center w-full px-6 py-4 border-b border-border-blue">
            <Text weight={"semibold"} size={"xl"}>
              {!account.isConnected && !selected?.address
                ? "Wallets"
                : "Connected Wallets"}
            </Text>
            <X
              size={24}
              color="#fff"
              strokeWidth={2}
              className="cursor-pointer"
              onClick={() => setOpen(false)}
            />
          </div>
          <div className="flex flex-col pb-4 pt-1 px-6 w-full gap-y-4">
            <AvailWallet />
            <EVMWallet />
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default WalletsMenu;
