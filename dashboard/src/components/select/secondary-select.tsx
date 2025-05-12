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
  defaultValue?: string;
}

const SecondarySelect = ({
  options,
  placeholder = "Select",
  onChange,
  value,
  className,
  defaultValue,
}: SecondarySelectProps) => {
  return (
    <div
      className={cn(
        "relative w-32 h-10 rounded-lg overflow-hidden border border-border-blue",
        className
      )}
    >
      <div className="flex items-center h-full">
        <Select
          defaultValue={defaultValue}
          value={value}
          onValueChange={onChange}
        >
          <SelectTrigger className="h-12 w-full flex-1 border-0 outline-none cursor-pointer">
            <SelectValue
              placeholder={
                <Text variant={"light-grey"} weight={"semibold"} size={"sm"}>
                  {placeholder}
                </Text>
              }
              className="font-bold text-white font-inter text-sm flex-1 data-[placeholder]:text-white cursor-pointer"
            />
          </SelectTrigger>
          <SelectContent
            className="bg-bg-primary p-0 border border-border-blue mt-1"
            defaultValue={defaultValue}
          >
            {options.map((option) => (
              <SelectItem
                key={option}
                value={option}
                className="cursor-pointer hover:bg-border-blue focus:bg-border-blue"
              >
                <Text variant={"light-grey"} weight={"semibold"} size={"sm"}>
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
