"use client";

import type { ReactNode, PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

interface InfoCardProps extends PropsWithChildren {
  className?: string;
}

export const InfoCard = ({ className, children }: InfoCardProps) => {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-1 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
};

interface InfoRowProps {
  label: ReactNode;
  value: ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}

export const InfoRow = ({
  label,
  value,
  className,
  labelClassName,
  valueClassName,
}: InfoRowProps) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-0.5 leading-tight text-sm",
        className
      )}
    >
      <span className={cn("text-muted-foreground", labelClassName)}>
        {label}
      </span>
      <span className={cn("text-foreground font-medium", valueClassName)}>
        {value}
      </span>
    </div>
  );
};
