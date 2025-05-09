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
  token_address: string;
  token_decimals: number;
  token_ticker?: string;
}

export interface TokenMap {
  [key: string]: TokenInfo;
}

export const TOKEN_MAP: TokenMap = {
  avail: {
    token_address: "0x99a907545815c289fb6de86d55fe61d996063a94",
    token_decimals: 18,
    token_ticker: "AVAIL",
  },
  ethereum: {
    token_address: "0x8B42845d23C68B845e262dC3e5cAA1c9ce9eDB44",
    token_decimals: 18,
    token_ticker: "ETH",
  },
};

export type Transaction = {
  amount_avail_approved: string | null;
  amount_token_deposited: string;
  created_at: string;
  id: number;
  request_status: "Requested" | "Completed" | "Rejected";
  token_address: string;
  token_name: string;
  token_symbol: string;
  token_image: string;
  user_id: string;
};

export enum SupportedChains {
  Mainnet = 1,
  Sepolia = 11155111,
}

export type BalanceResult = {
  results: {
    token_address: string;
    token_balance: string;
    token_details_id: number;
    user_id: string;
    token_used: string;
  }[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  app_id: number;
  assigned_wallet: string;
  credit_balance: string;
  credit_used: string;
};

export type Balances = {
  token_address: string;
  token_balance: string;
  token_name: string;
  token_image: string;
  token_used: string;
  token_ticker?: string;
};
