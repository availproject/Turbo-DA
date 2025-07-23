import Button from "@/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
} from "@/components/dialog";
import { useDialog } from "@/components/dialog/provider";
import Input from "@/components/input";
import { Text } from "@/components/text";
import { useConfig } from "@/providers/ConfigProvider";
import { Close, DialogTitle } from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { availChain, chainList } from "../utils/constant";
import AvailChainConnect from "./avail-chain-connect";

const SelectChainToken = () => {
  const { selectedChain, selectedToken, setSelectedChain, setSelectedToken } =
    useConfig();
  const [searchChain, setSearchChain] = useState<string>("");
  const [searchToken, setSearchToken] = useState<string>("");
  const { open, setOpen } = useDialog();

  return (
    <Dialog
      open={open === "select-token"}
      onOpenChange={(value) => {
        setOpen(value ? "select-token" : "");
      }}
    >
      <DialogContent className="min-w-[600px] h-[600px] p-0 border-none rounded-3xl">
        <div className="shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden flex flex-col focus-within:outline-0 h-full w-full relative">
          <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />

          <div className="flex h-full relative">
            <div className="bg-[#2b47613d] py-6 w-[240px] h-full">
              <div className="w-full px-3">
                <div className="border border-border-blue rounded-lg flex gap-x-1.5 items-center py-2 px-3 h-12">
                  <Search color="#B3B3B3" size={26} />
                  <Input
                    placeholder="Search For Chain"
                    value={searchChain}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchChain(value);
                    }}
                    className="border-none text-base font-medium placeholder:text-base placeholder:font-medium cursor-text p-0"
                  />
                </div>
              </div>
              <div className="flex gap-y-2 flex-col my-6 px-3">
                {Object.values(chainList).map((chain) => {
                  return (
                    <Button
                      variant={"outline"}
                      key={`evm-${chain.name}`}
                      className="flex gap-x-1.5 items-center justify-between"
                      data-state={
                        selectedChain?.name === chain.name
                          ? "active"
                          : "inactive"
                      }
                      onClick={() => {
                        setSelectedChain(chain);
                        setSelectedToken(undefined);
                      }}
                    >
                      <div className="flex gap-x-2 items-center">
                        <Image
                          src={chain.icon}
                          alt={chain.name}
                          width={24}
                          height={24}
                          className="border border-border-blue rounded-full"
                        />
                        <Text weight={"semibold"}>{chain.name}</Text>
                      </div>
                    </Button>
                  );
                })}
              </div>
              <div className="bg-border-blue h-px w-full" />
              <div className="flex gap-y-2 flex-col mt-6 px-3">
                <AvailChainConnect />
              </div>
            </div>
            <div className="px-4 py-8 flex-1 h-full flex flex-col gap-y-2">
              <DialogHeader className="p-0 flex flex-row gap-x-2 justify-between items-center">
                <DialogTitle className="text-xl font-semibold text-white">
                  Select Token
                </DialogTitle>
                <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
                  <X color="#FFF" size={26} strokeWidth={1} />
                </Close>
              </DialogHeader>
              <DialogDescription className="font-medium text-sm text-secondary-grey">
                Select a token from our default list or search for a token by
                symbol or address.
              </DialogDescription>
              <div className="border border-border-blue rounded-lg flex gap-x-1.5 items-center py-2 px-3 h-12 mt-2">
                <Search color="#B3B3B3" size={26} />
                <Input
                  placeholder="Search For Token"
                  value={searchToken}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchToken(value);
                  }}
                  className="border-none text-base font-medium placeholder:text-base placeholder:font-medium cursor-text p-0"
                />
              </div>
              <div className="flex flex-col gap-y-3 mt-2">
                {selectedChain &&
                  { ...chainList, ...availChain }[
                    selectedChain.name.toLowerCase()
                  ]?.tokens.map((token) => (
                    <Button
                      variant={"outline"}
                      key={`token-${token.name}`}
                      className="flex gap-x-1.5 items-center justify-between"
                      data-state={
                        selectedToken?.name === token.name
                          ? "active"
                          : "inactive"
                      }
                      onClick={() => {
                        setSelectedToken(token);
                        setOpen("");
                      }}
                    >
                      <div className="flex gap-x-2 items-center">
                        <Image
                          src={token.icon}
                          alt="ethereum"
                          width={24}
                          height={24}
                          className="border border-border-blue rounded-full"
                        />
                        <Text weight={"semibold"}>{token.name}</Text>
                      </div>
                      <Text className="text-[#999]" weight={"semibold"}>
                        00.00
                      </Text>
                    </Button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SelectChainToken;
