/* eslint-disable import/no-anonymous-default-export */

import { createConfig, http } from "@wagmi/core";
import { getDefaultConfig } from "connectkit";
import { appConfig } from "./default";

export const substrateConfig = {
  endpoint: process.env.NEXT_PUBLIC_AVAIL_RPC || "",
};

import { type Chain } from "viem";

export const avail: Chain = {
  id: 43_117,
  name: "Avail",
  nativeCurrency: {
    decimals: 18,
    name: "Avail",
    symbol: "AVAIL",
  },
  rpcUrls: {
    default: { http: ["wss://hex-rpc.avail.tools/ws"] },
  },
  blockExplorers: {
    default: { name: "Avail", url: "https://avail-turing.subscan.io" },
    avail: { name: "Avail", url: "https://avail-turing.subscan.io" },
  },
  testnet: false,
};

export const config = createConfig(
  getDefaultConfig({
    chains: [appConfig.networks.ethereum, appConfig.networks.base, avail],
    transports: {
      [appConfig.networks.ethereum.id]: http(
        process.env.NEXT_PUBLIC_ETH_RPC_URL || ""
      ),
      [appConfig.networks.base.id]: http(
        process.env.NEXT_PUBLIC_BASE_RPC_URL || ""
      ),
      [avail.id]: http("https://avail-turing.subscan.io"),
    },
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
      "e77cdade22390c135f6dfb134f075abe",
    appName: "TurboDA",
    appDescription: "Official UI for the Avail Bridge",
    appIcon: "https://bridge.availproject.org/favicon.ico",
    ssr: true,
  })
);
