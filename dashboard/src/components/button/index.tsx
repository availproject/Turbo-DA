import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva("cursor-pointer", {
  variants: {
    variant: {
      primary:
        "h-12 bg-blue rounded-full w-full hover:bg-blue/90 text-base font-bold text-white",
      disabled:
        "bg-grey rounded-full w-full text-base font-bold text-black/40 cursor-not-allowed h-12 ",
      ghost: "inline-flex justify-center items-center has-[>svg]:p-1",
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
