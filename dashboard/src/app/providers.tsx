"use client";

import { DialogProvider } from "@/components/dialog/provider";
import { config } from "@/config/walletConfig";
import { ConfigProvider } from "@/providers/ConfigProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { ReactNode } from "react";
import { State, WagmiProvider } from "wagmi";
import "./globals.css";

const queryClient = new QueryClient();

export function Providers({
  children,
  initialState,
  token,
}: {
  children: ReactNode;
  initialState?: State;
  token?: string;
}) {
  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <ConfigProvider accessToken={token}>
            <DialogProvider>{children}</DialogProvider>
          </ConfigProvider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
