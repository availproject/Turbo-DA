"use client";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ReactNode } from "react";

interface ClerkWrapperProps {
  children: ReactNode;
}

export function ClerkWrapper({ children }: ClerkWrapperProps) {
  const ClerkProviderComponent = ClerkProvider as any;

  return (
    <ClerkProviderComponent
      appearance={{
        baseTheme: dark,
      }}
      dynamic
    >
      {children}
    </ClerkProviderComponent>
  );
}
