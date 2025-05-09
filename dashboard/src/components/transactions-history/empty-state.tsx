import Image from "next/image";
import Link from "next/link";
import Button from "../button";
import { Text } from "../text";

type EmptyStateProps = {
  message?: string;
  cta?: {
    label: string;
    link: string;
  };
};

const EmptyState = ({ message, cta }: EmptyStateProps) => {
  return (
    <div className="flex justify-center items-center flex-col h-[334px]">
      <div className="flex flex-col gap-4 items-center justify-center">
        <Image src={"/empty.svg"} width={159} height={134} alt="empty-state" />
        {message && (
          <Text weight={"semibold"} size={"base"}>
            {message}
          </Text>
        )}
        {cta && (
          <Link href={cta.link}>
            <Button className="w-[195px]">{cta.label}</Button>
          </Link>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
