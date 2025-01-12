
export type Tokens = {
    name: string;
    symbol: string;
    address: string;
    decimals: number;
    logo: string;
}

export enum TokenMapEnum {
  "0xb1c3cb9b5e598d4e95a85870e7812b99f350982d" = "AVAIL",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" = "ethereum"
}

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
 }

export enum SupportedChains {
    Mainnet = 1, 
    Sepolia = 11155111,
  }


  export type TokenMap = {
    "token_map": Record<string, string>;
  };

  export type BalanceResult = {
    results: {
        token_address: string;
        token_balance: string;
        token_details_id: number;
        user_id: string;
      }[];
  }

 export type User = {
    id: string;
    name: string;
    email: string;
    address: string;
    app_id: number;
    assigned_wallet: string;
  };

export type Balances = {
    token_address: string;
    token_balance: string;
    token_name: string;
    token_image: string;
}