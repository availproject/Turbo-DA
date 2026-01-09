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

const CHAIN_METADATA: Record<
  number,
  { name: string; isTestnet: boolean | "both"; coinGeckoId?: string }
> = {
  0: { name: "Avail", isTestnet: "both", coinGeckoId: "avail" },
  8453: { name: "Base", isTestnet: false },
  84532: { name: "Base Sepolia", isTestnet: true },
};

const LOGO_CACHE_KEY = "turbo-da-token-logos-v1";
const CACHE_DURATION = 24 * 60 * 60 * 1000;

let cachedTokenMap: SupportedTokensAndChains | null = null;

interface LogoCacheData {
  timestamp: number;
  logos: Record<string, string>;
}

function getLogoCache(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const cached = localStorage.getItem(LOGO_CACHE_KEY);
    if (!cached) return {};
    const data: LogoCacheData = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_DURATION) {
      localStorage.removeItem(LOGO_CACHE_KEY);
      return {};
    }
    return data.logos;
  } catch {
    return {};
  }
}

function saveLogoCache(logos: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    const data: LogoCacheData = {
      timestamp: Date.now(),
      logos,
    };
    localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

async function fetchTokenMap() {
  const response = await fetch(
    "https://hex.turbo-api.availproject.org/core-api/v1/token_map"
  );
  const data = await response.json();
  return data.data;
}

async function fetchCoinGeckoLogos(coinIds: string[]): Promise<Record<string, string>> {
  const logoCache = getLogoCache();
  const results: Record<string, string> = { ...logoCache };
  const missingIds = coinIds.filter((id) => !logoCache[id]);

  if (missingIds.length === 0) return results;

  await Promise.all(
    missingIds.map(async (coinId) => {
      try {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}`
        );
        const data = await response.json();
        results[coinId] = data.image?.small || data.image?.thumb || "/currency/base.png";
      } catch {
        results[coinId] = "/currency/base.png";
      }
    })
  );

  saveLogoCache(results);
  return results;
}

async function buildSupportedTokensAndChains(rawTokenMap: any): Promise<SupportedTokensAndChains> {
  const chains: SupportedTokensAndChains = {};
  const allCoinIds = new Set<string>();

  Object.values(rawTokenMap).forEach((tokens) => {
    Object.values(tokens as Record<string, any>).forEach((token) => {
      allCoinIds.add(token.coin_gecho_id);
    });
  });

  Object.values(CHAIN_METADATA).forEach((metadata) => {
    if (metadata.coinGeckoId) allCoinIds.add(metadata.coinGeckoId);
  });

  const logoMap = await fetchCoinGeckoLogos(Array.from(allCoinIds));

  for (const [chainId, tokens] of Object.entries(rawTokenMap)) {
    const id = parseInt(chainId);
    const metadata = CHAIN_METADATA[id];

    if (!metadata) continue;

    const chainIcon = metadata.coinGeckoId
      ? logoMap[metadata.coinGeckoId]
      : id === 8453
      ? "/currency/base.png"
      : "/currency/eth.png";

    chains[id] = {
      name: metadata.name,
      icon: chainIcon,
      isTestnet: metadata.isTestnet,
      id,
      tokens: Object.values(tokens as Record<string, any>).map((token) => ({
        name: token.symbol,
        icon: logoMap[token.coin_gecho_id] || "/currency/base.png",
        address: token.address.trim(),
        decimals: token.decimals,
        ticker: token.symbol,
        isNative:
          token.address.trim().toLowerCase() ===
          "0x0000000000000000000000000000000000000000",
      })),
    };
  }

  return chains;
}

export async function getSupportedTokensAndChains(): Promise<SupportedTokensAndChains> {
  if (cachedTokenMap) return cachedTokenMap;
  const rawTokenMap = await fetchTokenMap();
  cachedTokenMap = await buildSupportedTokensAndChains(rawTokenMap);
  return cachedTokenMap;
}

export const supportedTokensAndChains: SupportedTokensAndChains = {} as SupportedTokensAndChains;

export const TOKEN_MAP: TokenMap = {} as TokenMap;

export async function getAvailableChains(): Promise<SupportedTokensAndChains> {
  const isMainnet = process.env.NEXT_PUBLIC_ETH_NETWORK === "mainnet";
  const chains = await getSupportedTokensAndChains();

  return Object.fromEntries(
    Object.entries(chains).filter(
      ([_, chain]) => chain.isTestnet === "both" || chain.isTestnet === !isMainnet
    )
  );
}
