import { Balances, Tokens, Transaction, User } from "@/lib/types";
import { create } from "zustand";

interface CommonStore {
  balance: string;
  setBalance: (balance: string) => void;
  supportedTokens: Tokens[];
  setSupportedTokens: (tokens: Tokens[]) => void;
  recentTransactions: Transaction[];
  setRecentTransactions: (transactions: Transaction[]) => void;
  selectedToken: Tokens;
  setSelectedToken: (token: Tokens) => void;
  user: User;
  setUser: (user: User) => void;
  userFetched: boolean;
  setUserFetched: (fetched: boolean) => void;
  sessionToken: string | null;
  setSessionToken: (token: string) => void;
  tokenBalances: Balances[];
  setTokenBalances: (balances: Balances[]) => void;
  tab: string;
  setTab: (tab: string) => void;
}

export const useCommonStore = create<CommonStore>((set) => ({
  balance: "0",
  setBalance: (balance) => set({ balance }),
  supportedTokens: [],
  setSupportedTokens: (tokens) => set({ supportedTokens: tokens }),
  recentTransactions: [],
  setRecentTransactions: (transactions) =>
    set({ recentTransactions: transactions }),
  selectedToken: {
    name: "Avail",
    symbol: "AVAIL",
    address: "0xb1c3cb9b5e598d4e95a85870e7812b99f350982d",
    decimals: 18,
    logo: "/tokens/0xb1c3cb9b5e598d4e95a85870e7812b99f350982d.png",
  },
  setSelectedToken: (token) => set({ selectedToken: token }),
  user: {
    id: "",
    name: "",
    email: "",
    credit_balance: "0",
    credit_used: "0",
    app_id: 0,
    assigned_wallet: "",
  },
  setUser: (user) => set({ user }),
  userFetched: false,
  setUserFetched: (fetched) => set({ userFetched: fetched }),
  sessionToken: null,
  setSessionToken: (token) => set({ sessionToken: token }),
  tokenBalances: [],
  setTokenBalances: (balances) => set({ tokenBalances: balances }),
  tab: "balances",
  setTab: (tab) => set({ tab }),
}));
