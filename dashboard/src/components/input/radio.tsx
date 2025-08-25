import React from "react";

interface RadioButtonProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  name: string;
  value: string;
  className?: string;
}

export const RadioButton: React.FC<RadioButtonProps> = ({
  checked,
  onChange,
  name,
  value,
  className = "",
}) => {
  return (
    <div className={`relative ${className}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <div
        className="flex w-5 h-5 p-1 justify-center items-center aspect-square rounded-3xl border-[1.5px] border-[#425C72] cursor-pointer"
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <div className="w-[13.333px] h-[13.333px] flex-shrink-0 aspect-square rounded-3xl bg-[#3CA3FC]" />
        )}
      </div>
    </div>
  );
};
