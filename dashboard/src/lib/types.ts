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
  id: number;
  tokens: TokenInfo[];
}

export interface SupportedTokensAndChains {
  [chainKey: string]: ChainInfo;
}

export const supportedTokensAndChains: SupportedTokensAndChains = {
  ethereum: {
    name: "Ethereum",
    icon: "/currency/eth.png",
    id: 11155111,
    tokens: [
      {
        name: "ETH",
        icon: "/currency/eth.png",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        ticker: "ETH",
        isNative: true,
      },
      {
        name: "MTK",
        icon: "/currency/mtk.png",
        address: "0x8b42845d23c68b845e262dc3e5caa1c9ce9edb44",
        decimals: 18,
        ticker: "MTK",
      },
      {
        name: "AVAIL",
        icon: "/avail-icon.svg",
        address: "0x99a907545815c289fb6de86d55fe61d996063a94",
        decimals: 18,
        ticker: "AVAIL",
      },
    ],
  },
  base: {
    name: "Base",
    icon: "/currency/base.png",
    id: 84532,
    tokens: [
      {
        name: "ETH",
        icon: "/currency/eth.png",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        ticker: "ETH",
        isNative: true,
      },
      {
        name: "MTK",
        icon: "/currency/mtk.png",
        address: "0x8b42845d23c68b845e262dc3e5caa1c9ce9edb44",
        decimals: 18,
        ticker: "MTK",
      },
      {
        name: "AVAIL",
        icon: "/avail-icon.svg",
        address: "0x99a907545815c289fb6de86d55fe61d996063a94",
        decimals: 18,
        ticker: "AVAIL",
      },
    ],
  },
  baseMainnet: {
    name: "Base Mainnet",
    icon: "/currency/base.png",
    id: 8453,
    tokens: [
      {
        name: "ETH",
        icon: "/currency/eth.png",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        ticker: "ETH",
        isNative: true,
      },
      {
        name: "AVAIL",
        icon: "/avail-icon.svg",
        address: "0xd89d90d26b48940fa8f58385fe84625d468e057a",
        decimals: 18,
        ticker: "AVAIL",
      },
    ],
  },
  avail: {
    name: "Avail",
    icon: "/avail-icon.svg",
    id: 0,
    tokens: [
      {
        name: "AVAIL",
        icon: "/avail-icon.svg",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        ticker: "AVAIL",
        isNative: true,
      },
    ],
  },
};

interface TokenInfo_Legacy {
  token_address: string;
  token_decimals: number;
  token_ticker?: string;
}

export interface TokenMap {
  [key: string]: TokenInfo_Legacy;
}

// Generate TOKEN_MAP from supportedTokensAndChains for backward compatibility
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

export enum SupportedChains {
  Mainnet = 1,
  Sepolia = 11155111,
  BaseSepolia = 84532,
}
