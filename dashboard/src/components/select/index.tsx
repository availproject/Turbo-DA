import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "..//text";

interface SelectContainerProps {
  options: string[];
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  className?: string;
}

const SelectContainer = ({
  options,
  placeholder = "Select",
  value,
  onChange,
}: SelectContainerProps) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-12 border-grey-900 rounded-lg w-full flex-1 cursor-pointer">
        <div className="flex items-center gap-1.5">
          <SelectValue
            placeholder={
              <Text variant={"light-grey"} weight={"medium"}>
                {placeholder}
              </Text>
            }
            defaultValue={value}
            className="font-bold text-white font-inter flex-1 data-[placeholder]:text-white cursor-pointer"
          />
        </div>
      </SelectTrigger>

      <SelectContent className="bg-grey-700 p-0 border-0">
        {options.map((option: string) => (
          <SelectItem
            key={option}
            value={option}
            className="cursor-pointer hover:bg-grey-800 focus:bg-grey-800"
          >
            <Text variant={"light-grey"} weight={"medium"}>
              {option}
            </Text>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default SelectContainer;
