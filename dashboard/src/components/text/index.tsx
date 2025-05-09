import { cn } from "@/lib/utils"; // Tailwind merge utility (like clsx + tailwind-merge)
import { cva, VariantProps } from "class-variance-authority";
import React from "react";

const textVariants = cva("", {
  variants: {
    size: {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
      xl: "text-xl",
      sxl: "text-sxl",
      "2xl": "text-2xl",
      "3xl": "text-3xl",
      "4xl": "text-[40px]",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    variant: {
      white: "text-white",
      "white-700": "text-white-700",
      "light-grey": "text-light-grey",
      blue: "text-blue",
      yellow: "text-yellow",
      green: "text-green",
      error: "text-error",
    },
  },
  defaultVariants: {
    size: "base",
    weight: "normal",
    variant: "white",
  },
});

export interface TextProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof textVariants> {
  as?: keyof HTMLElementTagNameMap;
  children: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
  as: Component = "p",
  size,
  weight,
  variant,
  className,
  children,
  ...props
}) => {
  return (
    <Component
      className={cn(textVariants({ size, weight, variant }), className)}
      {...props}
    >
      {children}
    </Component>
  );
};
