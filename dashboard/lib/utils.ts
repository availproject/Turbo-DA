import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { TOKEN_MAP } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function formatBalance(balance: string) {
  return parseFloat(balance).toFixed(2)
}

export const template = 'gas'

export const getTokenNameByAddress = (address: string): string => {
  const tokenEntry = Object.entries(TOKEN_MAP).find(
    ([_, info]) => info.token_address.toLowerCase() === address.toLowerCase()
  );
  return tokenEntry ? tokenEntry[0] : "Unknown Token";
};

export const getTokenDecimals = (tokenName: string): number => {
  return TOKEN_MAP[tokenName]?.token_decimals ?? 18; 
};

export const getTokenTicker = (tokenName: string): string => {
  return TOKEN_MAP[tokenName]?.token_ticker ?? tokenName.toUpperCase();
};

export const capitalizeFirstLetter = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};