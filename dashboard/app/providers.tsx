'use client';

import * as React from 'react';
import './globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { darkTheme, getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { ThemeProvider } from 'degen'
import 'degen/styles'
import { mainnet, sepolia } from 'viem/chains';


const queryClient = new QueryClient();

export const config = getDefaultConfig({
  appName: 'TurboDa',
  projectId: 'ff3e7e095aae4b0550ed934c1539ed07',
  chains: [{
    ...sepolia,
    name: 'Sepolia',
    default: true,
    rpcUrls: {
      default: {
        http: ['https://black-prettiest-thunder.ethereum-sepolia.quiknode.pro/d019b4c81102cd5eb4ed27042800f51331e5e5a9'],
      }
    }
  }],

  ssr: true,
});


export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider forcedMode='dark' defaultAccent='orange' defaultMode='dark'>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
    </ThemeProvider>
  );
}
