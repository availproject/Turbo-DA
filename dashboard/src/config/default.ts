import { Signer } from "@polkadot/api/types";
import { base, baseSepolia } from "@wagmi/core/chains";
import { Chain } from "viem";

export interface LegacySignerOptions {
  app_id: number;
  signer?: Signer;
}

type AppConfig = {
  assetId: string;
  config: string;
  networks: {
    base: Chain;
  };
  rpcUrl: string;
  rpcUrlBase: string;
  rpcUrlEthereum: string;
};

export const appConfig: AppConfig = {
  assetId: "0x0000000000000000000000000000000000000000000000000000000000000000",
  config: process.env.NEXT_PUBLIC_ETH_NETWORK || "testnet",
  networks: {
    base:
      process.env.NEXT_PUBLIC_ETH_NETWORK === "mainnet" ? base : baseSepolia,
  },
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "wss://hex-rpc.avail.tools/ws",
  rpcUrlBase: process.env.NEXT_PUBLIC_BASE_RPC_URL || "",
  rpcUrlEthereum: process.env.NEXT_PUBLIC_ETH_RPC_URL || "",
};
