/* eslint-disable import/no-anonymous-default-export */

import { createConfig, http } from "@wagmi/core";
import { getDefaultConfig } from "connectkit";
import { appConfig } from "./default";

export const config = createConfig(
  getDefaultConfig({
    chains: [appConfig.networks.base],
    transports: {
      [appConfig.networks.base.id]: http(
        process.env.NEXT_PUBLIC_BASE_RPC_URL || "",
      ),
    },
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
      "e77cdade22390c135f6dfb134f075abe",
    appName: "TurboDA",
    appDescription: "turbo-da",
    appIcon: "https://turbo.availproject.org/favicon.ico",
    ssr: true,
  }),
);
