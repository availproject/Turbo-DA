import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva("cursor-pointer", {
  variants: {
    variant: {
      primary:
        "h-12 bg-blue rounded-full w-full hover:bg-blue/90 text-md font-semibold text-white pt-px shadow-primary-button bg-linear-[90deg] from-button-light-blue from-[3.81%] to-blue to-[92.61%]",
      secondary:
        "h-12 bg-transparent border border-[#425C72] rounded-full w-full text-base font-semibold text-white pt-px",
      disabled:
        "bg-[#13334F] rounded-full w-full text-base font-semibold text-white/40 cursor-not-allowed h-12",
      ghost: "inline-flex justify-center items-center has-[>svg]:p-1",
      danger: "w-full h-12 bg-[#CB62623D] hover:bg-[#CB62623D]/90 rounded-full",
      link: "text-light-grey underline",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

function Button({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, className }))}
      {...props}
    />
  );
}

export default Button;
