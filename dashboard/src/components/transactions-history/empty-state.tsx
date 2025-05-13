import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import Button from "../button";
import { Text } from "../text";

type EmptyStateProps = {
  message?: string;
  cta?: {
    label: string;
    action: () => void;
  };
};

const EmptyState = ({ message, cta }: EmptyStateProps) => {
  return (
    <div className="flex justify-center items-center flex-col h-[334px]">
      <div className="flex flex-col gap-4 items-center justify-center">
        <div className="w-[140px]">
          <DotLottieReact
            src={"/turbo_during_meditation.lottie"}
            loop
            autoplay
            width={140}
            height={140}
          />
        </div>
        {message && (
          <Text weight={"semibold"} size={"base"}>
            {message}
          </Text>
        )}
        {cta && (
          <Button className="w-[195px]" onClick={cta.action}>
            {cta.label}
          </Button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
