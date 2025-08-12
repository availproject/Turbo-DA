import { useDialog } from "@/components/dialog/provider";
import { Text } from "@/components/text";
import { useConfig } from "@/providers/ConfigProvider";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import SelectChainToken from "./components/select-chain-token-alert";

const SelectTokenButton = () => {
  const { setOpen } = useDialog();
  const { selectedChain, selectedToken } = useConfig();

  return (
    <>
      <div
        className="flex-1 border border-border-blue bg-[#2b47613d] rounded-full h-14 px-2.5 flex items-center justify-between cursor-pointer"
        onClick={() => setOpen("select-token")}
      >
        {selectedChain ? (
          <div className="flex gap-x-3 justify-center items-center">
            <div className="relative w-10 h-10">
              {selectedChain && (
                <Image
                  src={selectedChain.icon}
                  width={24}
                  height={24}
                  alt={selectedChain.name}
                  className="absolute bottom-0 -right-2 border border-border-blue rounded-full"
                />
              )}

              {selectedToken && (
                <Image
                  src={selectedToken.icon}
                  width={40}
                  height={40}
                  alt={selectedToken.name}
                />
              )}
            </div>
            <div className="flex flex-col gap-y-1.5 justify-center">
              <Text weight={"semibold"} className="leading-6">
                {selectedToken?.name ?? "Select Token"}
              </Text>
              <Text
                weight={"semibold"}
                size={"xs"}
                className="text-[#999] leading-[15px]"
              >
                On {selectedChain.name}
              </Text>
            </div>
          </div>
        ) : (
          <div className="pl-4">
            <Text weight={"semibold"}>Select Chain</Text>
          </div>
        )}
        <div>
          <ChevronDown size={24} color="#B3B3B3" />
        </div>
      </div>
      <SelectChainToken />
    </>
  );
};

export default SelectTokenButton;
