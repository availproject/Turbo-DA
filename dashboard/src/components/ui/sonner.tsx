"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group w-[900px]"
      style={
        {
          "--normal-bg": "#88D67B29",
          "--normal-text": "#ffffff",
          "--normal-width": "900px",
        } as React.CSSProperties
      }
      position="top-right"
      expand
      {...props}
    />
  );
};

export { Toaster };
