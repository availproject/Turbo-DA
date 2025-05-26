import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { TOKEN_MAP } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export enum APP_TABS {
  OVERVIEW = "overview",
  HISTORY = "history",
}

export const numberToBytes32 = (num: number): `0x${string}` => {
  const hex = num.toString(16);
  const paddedHex = hex.padStart(64, "0");
  return `0x${paddedHex}` as `0x${string}`;
};

export const tokenMap = {
  ethereum: {
    tokenAddress: "0x8B42845d23C68B845e262dC3e5cAA1c9ce9eDB44",
  },
  avail: {
    tokenAddress: "0x8B42845d23C68B845e262dC3e5cAA1c9ce9eDB44",
  },
};

export const baseImageUrl = (path?: string) => {
  return process.env.NEXT_PUBLIC_IMAGES_URL! + path;
};

export const maskNumber = (value: string) => {
  if (value.length <= 5) return value;
  return "..." + value.slice(-5);
};

export const formatInKB = (bytes: number) => {
  const kb = bytes / 1024;
  return {
    fixedValue: Number.isInteger(kb) ? kb : truncateToFixed(kb),
    kbValue: kb,
  };
};

export const truncateToFixed = (num: number, decimals = 4) => {
  const factor = Math.pow(10, decimals);
  return (Math.floor(num * factor) / factor).toFixed(decimals);
};

export const truncateAddress = (address: string): string => {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export const formatInBytes = (bytes: number) => bytes * 1024;

export const formatDataBytes = (bytes: number) => {
  const formatBytes = formatInKB(bytes);
  const kb = formatBytes.kbValue as number;
  const fixedValue = formatBytes.fixedValue as number;
  return fixedValue + ` Credit${kb > 1 ? "s" : ""}`;
};

export function formatBalance(balance: string) {
  return parseFloat(balance).toFixed(2);
}

export const template = "turbo";

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
