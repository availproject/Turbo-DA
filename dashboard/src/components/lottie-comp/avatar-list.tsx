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
              "w-[52px] rounded-lg overflow-hidden p-1",
              selected === key
                ? "border border-light-grey bg-[#44515F]"
                : "cursor-pointer border border-transparent"
            )}
            key={key}
            onClick={() => onClick(key)}
          >
            <div className="w-fit rounded overflow-hidden">
              {value.path ? (
                <AvatarWrapper path={value.path} width={40} height={40} />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default memo(AvatarList);
