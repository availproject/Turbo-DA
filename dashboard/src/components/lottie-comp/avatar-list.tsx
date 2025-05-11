import { avatarList } from "@/lib/constant";
import { cn } from "@/lib/utils";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

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
                ? "p-1 border border-light-grey"
                : "cursor-pointer"
            )}
            key={key}
          >
            <DotLottieReact
              src={value.path}
              loop
              autoplay
              playOnHover={true}
              width={40}
              height={40}
              onClick={() => onClick(key)}
            />
          </div>
        );
      })}
    </div>
  );
};

export default AvatarList;
