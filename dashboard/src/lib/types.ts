export type Tokens = {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  logo: string;
};

export interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export enum HISTORY_TYPES {
  CREDIT = "credit",
  PUBLISH = "publish",
}

interface TokenInfo {
  name: string;
  icon: string;
  address: string;
  decimals: number;
  ticker: string;
  isNative?: boolean;
}

interface ChainInfo {
  name: string;
  icon: string;
  isTestnet: boolean | "both";
  id: number;
  tokens: TokenInfo[];
}

export interface SupportedTokensAndChains {
  [chainKey: string]: ChainInfo;
}

export interface TokenMap {
  [key: string]: TokenInfo_Legacy;
}

interface TokenInfo_Legacy {
  token_address: string;
  token_decimals: number;
  token_ticker?: string;
}

const RAW_TOKEN_MAP = {
  "0": {
    "0x0000000000000000000000000000000000000000": {
      address: "0x0000000000000000000000000000000000000000",
      coin_gecho_id: "avail",
      decimals: 18,
      name: "Avail",
      symbol: "AVAIL",
    },
  },
  "8453": {
    "0xd89d90d26b48940fa8f58385fe84625d468e057a": {
      address: "0xd89d90d26b48940fa8f58385fe84625d468e057a",
      coin_gecho_id: "avail",
      decimals: 18,
      name: "Avail",
      symbol: "AVAIL",
    },
  },
  "84532": {
    "0x0000000000000000000000000000000000000000": {
      address: "0x0000000000000000000000000000000000000000",
      coin_gecho_id: "ethereum",
      decimals: 18,
      name: "Ether",
      symbol: "ETH",
    },
    "0xf50F2B4D58ce2A24b62e480d795A974eD0f77A58": {
      address: "0xf50F2B4D58ce2A24b62e480d795A974eD0f77A58",
      coin_gecho_id: "avail",
      decimals: 18,
      name: "Avail",
      symbol: "AVAIL",
    },
  },
} as const;

const CHAIN_METADATA: Record<
  number,
  { name: string; icon: string; isTestnet: boolean | "both" }
> = {
  0: { name: "Avail", icon: "/avail-icon.svg", isTestnet: "both" },
  8453: { name: "Base", icon: "/currency/base.png", isTestnet: false },
  84532: { name: "Base Sepolia", icon: "/currency/eth.png", isTestnet: true },
};

const TOKEN_ICONS: Record<string, string> = {
  AVAIL: "/avail-icon.svg",
  ETH: "/currency/eth.png",
};

export const supportedTokensAndChains: SupportedTokensAndChains =
  Object.entries(RAW_TOKEN_MAP).reduce((acc, [chainId, tokens]) => {
    const id = parseInt(chainId);
    const metadata = CHAIN_METADATA[id];

    if (!metadata) {
      console.warn(`No metadata found for chain ID ${id}`);
      return acc;
    }

    acc[id] = {
      ...metadata,
      id,
      tokens: Object.values(tokens).map((token) => ({
        name: token.symbol,
        icon: TOKEN_ICONS[token.symbol] || "/avail-icon.svg",
        address: token.address.trim(),
        decimals: token.decimals,
        ticker: token.symbol,
        isNative:
          token.address.trim().toLowerCase() ===
          "0x0000000000000000000000000000000000000000",
      })),
    };

    return acc;
  }, {} as SupportedTokensAndChains);

export const TOKEN_MAP: TokenMap = Object.values(
  supportedTokensAndChains,
).reduce((acc, chain) => {
  chain.tokens.forEach((token) => {
    const key = token.name.toLowerCase();
    acc[key] = {
      token_address: token.address,
      token_decimals: token.decimals,
      token_ticker: token.ticker,
    };
  });
  return acc;
}, {} as TokenMap);

export const getAvailableChains = (): SupportedTokensAndChains => {
  const isMainnet = process.env.NEXT_PUBLIC_ETH_NETWORK === "mainnet";

  return Object.fromEntries(
    Object.entries(supportedTokensAndChains).filter(
      ([_, chain]) =>
        chain.isTestnet === "both" || chain.isTestnet === !isMainnet,
    ),
  );
};
