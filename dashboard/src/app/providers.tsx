"use client";

import { DialogProvider } from "@/components/dialog/provider";
import { config } from "@/config/walletConfig";
import { ConfigProvider } from "@/providers/ConfigProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { ReactNode } from "react";
import { State, WagmiProvider } from "wagmi";
import { AvailWalletProvider } from "wallet-sdk-v2";
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
        <AvailWalletProvider>
          <ConnectKitProvider
            theme="midnight"
            options={{ overlayBlur: 2, embedGoogleFonts: true }}
          >
            <ConfigProvider accessToken={token}>
              <DialogProvider>{children}</DialogProvider>
            </ConfigProvider>
          </ConnectKitProvider>
        </AvailWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
