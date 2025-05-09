import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReactNode } from "react";
import { Text } from "..//text";

type SelectOption = {
  label: string;
  value: string;
  icon?: ReactNode;
};

interface IconSelectContainerProps {
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  className?: string;
}

const IconSelectContainer = ({
  options,
  placeholder = "Select",
  value,
  onChange,
}: IconSelectContainerProps) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={
          "h-12 border-grey-900 rounded-lg w-full flex-1 cursor-pointer"
        }
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>

      <SelectContent className="bg-grey-700 p-0 border-0">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="cursor-pointer hover:bg-grey-800 focus:bg-grey-800"
          >
            <div className="flex items-center gap-2">
              {option.icon}
              <Text variant={"light-grey"} weight={"medium"}>
                {option.label}
              </Text>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default IconSelectContainer;
