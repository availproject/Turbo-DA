import { InfoIcon } from "lucide-react";
import { Text } from "./text";
import { Switch } from "./ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type SwitchDescriptionProps = {
  id: string;
  disabled?: boolean;
  checked: boolean;
  onChecked?: (value: boolean) => void;
};

const SwitchDescription = ({
  id,
  disabled = false,
  checked = false,
  onChecked,
}: SwitchDescriptionProps) => {
  return (
    <div className="flex items-center space-x-2 mt-4">
      <Switch
        id={"use-main-baalnce" + id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChecked?.(value)}
      />
      <Text
        size={"sm"}
        weight={"medium"}
        variant={disabled ? "disabled" : "light-grey"}
      >
        Use Main Credit Balance
      </Text>
      <Tooltip>
        <TooltipTrigger
          className={disabled ? "pointer-events-none" : ""}
          asChild
        >
          <InfoIcon
            size={20}
            color={disabled ? "#B3B3B3" : "#FFF"}
            className="cursor-pointer"
          />
        </TooltipTrigger>
        <TooltipContent className="bg-black w-[300px]">
          <Text size={"sm"} weight={"medium"} className="text-[#949494] py-2">
            By default, apps use your{" "}
            <Text as="i" size={"sm"} weight={"medium"}>
              ‘Main Credit Balance’
            </Text>
            . Deactivate this toggle to{" "}
            <Text as="i" size={"sm"} weight={"medium"}>
              ‘Assign Credits’
            </Text>{" "}
            to this app.{" "}
            <Text
              as="span"
              size={"sm"}
              className="text-[#E4A354]"
              weight={"medium"}
            >
              Once the credits are assigned, you cannot activate this before
              exhausting your assigned credits.
            </Text>
          </Text>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default SwitchDescription;
