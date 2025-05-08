import { cn } from "@/lib/utils";
import { Text } from "../text";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface SecondarySelectProps {
  options: string[];
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
}

const SecondarySelect = ({
  options,
  placeholder = "Select",
  label,
  onChange,
  value,
  className,
}: SecondarySelectProps) => {
  return (
    <div
      className={cn(
        "relative w-32 h-10 rounded-lg overflow-hidden border border-solid border-[#bbbbbb]",
        className
      )}
    >
      <div className="flex items-center h-full">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-12 w-full flex-1 border-0 outline-none cursor-pointer">
            <SelectValue
              placeholder={
                <Text variant={"light-grey"} weight={"medium"}>
                  {placeholder}
                </Text>
              }
              className="font-bold text-white font-inter flex-1 data-[placeholder]:text-white cursor-pointer"
            />
          </SelectTrigger>
          <SelectContent className="bg-[#112235] p-0 border-0">
            {options.map((option) => (
              <SelectItem
                key={option}
                value={option}
                className="cursor-pointer hover:bg-[#414E5D] focus:bg-[#414E5D]"
              >
                <Text variant={"light-grey"} weight={"medium"}>
                  {option}
                </Text>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default SecondarySelect;
