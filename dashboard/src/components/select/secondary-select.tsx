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
        "relative rounded-lg overflow-hidden border border-border-blue",
        className
      )}
    >
      <div className="flex items-center h-full">
        <Select
          defaultValue={defaultValue}
          value={value}
          onValueChange={onChange}
        >
          <SelectTrigger className="h-12 w-32 [&>span>p]:truncate border-0 outline-none cursor-pointer">
            <SelectValue
              placeholder={
                <Text variant={"light-grey"} weight={"semibold"} size={"sm"}>
                  {placeholder}
                </Text>
              }
              className="font-bold text-white text-sm data-[placeholder]:text-white cursor-pointer selected-value"
            />
          </SelectTrigger>
          <SelectContent
            className="p-0 border border-border-blue bg-[#112235] mt-1"
            defaultValue={defaultValue}
          >
            {options.map((option, index: number) => (
              <SelectItem
                key={option}
                value={option}
                className={cn(
                  "cursor-pointer hover:bg-[#2b47613d] focus:bg-[#2b47613d] h-10",
                  index === options.length - 1
                    ? "border-b-0"
                    : "border-b border-b-border-blue"
                )}
              >
                <Text weight={"semibold"}>{option}</Text>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default SecondarySelect;
