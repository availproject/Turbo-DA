import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import Input from ".";
import { Text } from "../text";

export interface PrimaryInputProps {
  label?: string;
  onChange?: (value: string) => void;
  value?: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "number";
  disabled?: boolean;
  rightElement?: ReactNode;
  description?: string;
  className?: string;
  error?: string;
}

const PrimaryInput = ({
  label,
  onChange,
  value,
  disabled = false,
  type = "text",
  placeholder = "",
  rightElement,
  description,
  className = "",
  error,
}: PrimaryInputProps) => {
  const handleClick = (event: any) => {
    const { value } = event.target;
    const position = value.length;
    event.target.setSelectionRange(position, position);
  };
  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      {label && (
        <Text size={"sm"} weight={"medium"} color="light-grey" as="label">
          {label}
        </Text>
      )}
      <div
        className={cn(
          "relative",
          rightElement
            ? "border border-border-blue flex rounded-lg justify-center items-center pr-4 h-12"
            : "",
          rightElement && error && error !== "" ? "border-error" : ""
        )}
      >
        <Input
          value={value}
          type={type}
          name="input"
          disabled={disabled}
          className={cn(
            "text-base font-semibold",
            rightElement
              ? "border-none"
              : error && error !== ""
              ? "border-error"
              : "border-border-blue",
            !rightElement ? "rounded-lg h-12" : ""
          )}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          onClick={handleClick}
        />
        {rightElement}
      </div>
      {error ? (
        <Text weight={"medium"} as="label" size={"sm"} variant={"error"}>
          {error}
        </Text>
      ) : description ? (
        <Text weight={"medium"} as="label" size={"sm"}>
          {description}
        </Text>
      ) : null}
    </div>
  );
};

export default PrimaryInput;
