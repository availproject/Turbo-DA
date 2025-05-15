import { avatarList } from "@/lib/constant";
import { cn } from "@/lib/utils";
import { memo } from "react";
import AvatarWrapper from "./avatar-container";

const AvatarList = ({
  selected,
  onClick,
}: {
  selected?: string;
  onClick: (select: string) => void;
}) => {
  return (
    <div className="flex gap-x-2 justify-between">
      {Object.entries(avatarList).map(([key, value]) => {
        return (
          <div
            className={cn(
              "w-10 rounded overflow-hidden",
              selected === key
                ? "border border-light-grey"
                : "cursor-pointer border border-transparent"
            )}
            key={key}
            onClick={() => onClick(key)}
          >
            {value.path ? (
              <AvatarWrapper path={value.path} width={40} height={40} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default memo(AvatarList);
