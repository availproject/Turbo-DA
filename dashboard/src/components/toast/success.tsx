import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Text } from "../text";

type SuccessProps = {
  label?: string;
  description?: string;
  className?: string;
};

const Success = ({ label, description, className }: SuccessProps) => {
  return (
    <div className={cn("flex gap-x-4 items-center pr-4 w-fit", className)}>
      <div className="bg-white rounded-lg p-2">
        <Check
          color="#1FC16B"
          size={24}
          strokeWidth={3}
          className="border-2 border-[#1FC16B] rounded-full p-0.5"
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

export default Success;
