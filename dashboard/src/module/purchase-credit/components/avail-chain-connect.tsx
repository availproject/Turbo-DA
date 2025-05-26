import Button from "@/components/button";
import { Text } from "@/components/text";
import { useConfig } from "@/providers/ConfigProvider";
import Image from "next/image";
import { availChain } from "../utils/constant";

const AvailChainConnect = () => {
  const { selectedChain, setSelectedChain, setSelectedToken } = useConfig();

  return (
    <Button
      variant={"outline"}
      className="flex gap-x-1.5 justify-between"
      data-state={
        selectedChain?.name === availChain.avail.name ? "active" : "inactive"
      }
      onClick={() => {
        setSelectedChain(availChain.avail);
        setSelectedToken(undefined);
      }}
    >
      <div className="flex gap-x-2 items-center">
        <Image
          src={availChain.avail.icon}
          alt={availChain.avail.name}
          width={24}
          height={24}
          className="border border-border-blue rounded-full bg-black p-[3px]"
        />
        <div className="flex flex-col gap-y-0 justify-start items-start">
          <Text weight={"semibold"}>{availChain.avail.name}</Text>
          <Text weight={"semibold"} variant={"secondary-grey"} size={"xs"}>
            Requires Avail Wallet
          </Text>
        </div>
      </div>
    </Button>
  );
};

export default AvailChainConnect;
