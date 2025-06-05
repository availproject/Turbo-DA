import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Text } from "../text";

type FailureProps = {
  label?: string;
  description?: string;
  className?: string;
};

const Failure = ({ label, description, className }: FailureProps) => {
  return (
    <div className={cn("flex gap-x-4 items-center pr-4", className)}>
      <div className="bg-white rounded-lg p-2">
        <X
          color="#ff7360"
          size={24}
          strokeWidth={3}
          className="border-2 border-[#ff7360] rounded-full p-0.5"
        />
      </div>
      <div>
        {label ? <Text weight={"semibold"}>{label}</Text> : null}
        {description ? (
          <Text size={"sm"} weight={"medium"} variant={"grey-500"}>
            {description}
          </Text>
        ) : null}
      </div>
    </div>
  );
};

export default Failure;
