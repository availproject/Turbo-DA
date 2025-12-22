import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Label } from "../../ui/label";
import { Checkbox } from "../../ui/checkbox";
import {
  type SUPPORTED_TOKENS,
  type UserAsset,
} from "@avail-project/nexus-core";

interface SourceSelectProps {
  token?: SUPPORTED_TOKENS;
  balanceBreakdown?: UserAsset;
  selected?: number[];
  onChange?: (selected: number[]) => void;
  disabled?: boolean;
}

const SourceSelect = ({
  token,
  balanceBreakdown,
  selected = [],
  onChange,
  disabled = false,
}: SourceSelectProps) => {
  const isSelected = (id: number) => selected?.includes(id);
  const toggle = (id: number) => {
    if (!onChange) return;
    if (disabled) return;
    if (isSelected(id)) onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  };

  const allSelected =
    Boolean(balanceBreakdown?.breakdown.length) &&
    balanceBreakdown?.breakdown.every((chain) =>
      selected.includes(chain.chain.id)
    );

  const toggleAll = () => {
    if (!onChange || disabled || !balanceBreakdown?.breakdown.length) return;
    if (allSelected) {
      onChange([]);
    } else {
      onChange(balanceBreakdown.breakdown.map((chain) => chain.chain.id));
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        aria-disabled={disabled}
        className={`flex items-center justify-between w-full px-0 py-2 ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        Customise source chains
        <ChevronDown className="size-4 text-primary data-[state=open]:rotate-180 shrink-0 translate-y-0.5 transition-transform duration-200" />
      </PopoverTrigger>
      <PopoverContent className="w-max sm:w-sm no-scrollbar">
        {balanceBreakdown && balanceBreakdown?.breakdown.length > 0 ? (
          <>
            <div className="flex items-center gap-x-2 pb-3 mb-3 border-b border-border w-full">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                disabled={disabled}
                className={`${
                  disabled ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              />
              <Label
                className="text-primary text-sm cursor-pointer"
                onClick={toggleAll}
              >
                Select All
              </Label>
            </div>
            <div className="grid grid-cols-1 gap-1 w-full overflow-y-auto max-h-[300px] no-scrollbar">
              {balanceBreakdown?.breakdown.map((chain) => (
                <div key={chain.chain.id} className="flex items-center gap-x-2">
                  <Checkbox
                    checked={isSelected(chain.chain.id)}
                    onCheckedChange={() => toggle(chain.chain.id)}
                    value={chain.chain.id}
                    disabled={disabled}
                    className={`${
                      disabled ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                  />
                  <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-x-2 p-2">
                      <img
                        src={chain.chain.logo}
                        alt={chain.chain.name}
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                      <Label
                        className="text-primary text-sm"
                        htmlFor={String(chain.chain.id)}
                      >
                        {chain.chain.name}
                      </Label>
                    </div>
                    <p className="text-sm font-semibold">
                      {chain.balance} {token}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No chains with balance
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
};
export default SourceSelect;
