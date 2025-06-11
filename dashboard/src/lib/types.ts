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
        address: "0x8B42845d23C68B845e262dC3e5cAA1c9ce9eDB44",
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
    id: 84532, // Base Sepolia testnet
    tokens: [
      {
        name: "ETH",
        icon: "/currency/eth.png",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        ticker: "ETH",
        isNative: true,
      },
    ],
  },
  avail: {
    name: "Avail",
    icon: "/avail-icon.svg",
    id: 0, // Special ID for Avail (non-EVM)
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

// Legacy TOKEN_MAP for backward compatibility (will be deprecated)
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
