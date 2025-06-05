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
  defaultValue?: string;
}

const IconSelectContainer = ({
  options,
  placeholder = "Select",
  value,
  onChange,
  defaultValue,
}: IconSelectContainerProps) => {
  return (
    <Select value={value} onValueChange={onChange} defaultValue={defaultValue}>
      <SelectTrigger
        className={
          "h-12 border-border-blue rounded-lg w-full flex-1 cursor-pointer"
        }
      >
        <SelectValue
          placeholder={
            <Text variant={"light-grey"} weight={"semibold"} size={"sm"}>
              {placeholder}
            </Text>
          }
        />
      </SelectTrigger>

      <SelectContent className="bg-bg-primary p-0 border border-border-blue">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="cursor-pointer hover:bg-border-blue focus:bg-border-blue"
          >
            <div className="flex items-center gap-x-2">
              {option.icon}
              <Text variant={"light-grey"} weight={"semibold"} size={"sm"}>
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
