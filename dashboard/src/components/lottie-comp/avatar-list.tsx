import { avatarList } from "@/lib/constant";
import { cn } from "@/lib/utils";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { memo } from "react";

const AvatarList = ({
  selected,
  onClick,
}: {
  selected?: string;
  onClick: (select: string) => void;
}) => {
  return (
    <div className="flex gap-x-2 justify-between">
      {Object.entries(avatarList).map(([key, value], index) => {
        return (
          <div
            className={cn(
              "w-10 rounded overflow-hidden",
              selected === key
                ? "border border-light-grey"
                : "cursor-pointer border border-transparent"
            )}
            key={key}
          >
            {value?.path ? (
              <DotLottieReact
                src={value.path}
                loop
                playOnHover={true}
                width={40}
                height={40}
                onClick={() => onClick(key)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default memo(AvatarList);
