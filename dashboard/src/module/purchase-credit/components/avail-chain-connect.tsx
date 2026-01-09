import Button from "@/components/button";
import { Text } from "@/components/text";
import { useConfig } from "@/providers/ConfigProvider";
import Image from "next/image";

const AvailChainConnect = () => {
  const {
    selectedChain,
    setSelectedChain,
    setSelectedToken,
    supportedTokensAndChains,
  } = useConfig();
  const availChain = supportedTokensAndChains[0];

  if (!availChain) return null;

  return (
    <Button
      variant={"outline"}
      className="flex gap-x-1.5 justify-between"
      data-state={
        selectedChain?.name === availChain.name ? "active" : "inactive"
      }
      onClick={() => {
        setSelectedChain(availChain);
        setSelectedToken(availChain.tokens[0]);
      }}
    >
      <div className="flex gap-x-2 items-center">
        <Image
          src={availChain.icon}
          alt={availChain.name}
          width={24}
          height={24}
          className="border border-border-blue rounded-full bg-black p-[3px]"
        />
        <div className="flex flex-col gap-y-0 justify-start items-start">
          <Text weight={"semibold"}>{availChain.name}</Text>
          <Text weight={"semibold"} variant={"secondary-grey"} size={"xs"}>
            Requires Avail Wallet
          </Text>
        </div>
      </div>
    </Button>
  );
};

export default AvailChainConnect;
