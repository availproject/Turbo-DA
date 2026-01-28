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

export const kbToCredits = (kb: number) => kb / 1024;

export const convertBytes = (kb: number) => {
  if (kb >= 1024) {
    const mb = kb / 1024;
    return `${mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(2)} MB`;
  } else {
    return `${kb % 1 === 0 ? kb.toFixed(0) : kb.toFixed(2)} KB`;
  }
};

export const formatDataBytes = (bytes: number) => {
  const formatBytes = formatInKB(bytes);
  const kb = formatBytes.kbValue as number;
  const fixedValue = formatBytes.fixedValue as number;
  return fixedValue + ` Credit${kb > 1 ? "s" : ""}`;
};

export const formatDataBytesWithPrecision = (bytes: number, decimals = 2) => {
  const kb = bytes / 1024;
  const truncatedValue = Number.isInteger(kb)
    ? kb
    : truncateToFixed(kb, decimals);
  return truncatedValue + ` Credit${kb > 1 ? "s" : ""}`;
};

export function formatBalance(balance: string) {
  return parseFloat(balance).toFixed(2);
}

export const template = "turbo";

export const getTokenNameByAddress = (address: string): string => {
  const tokenEntry = Object.entries(TOKEN_MAP).find(
    ([, info]) => info.token_address.toLowerCase() === address.toLowerCase()
  );
  return tokenEntry ? tokenEntry[0] : "Unknown Token";
};

export const getTokenDecimals = (tokenName: string): number => {
  return TOKEN_MAP[tokenName]?.token_decimals ?? 18;
};

export const formatTokenAmount = (
  weiAmount: string | number,
  decimals: number = 18,
  precision: number = 6
): string => {
  if (!weiAmount) return "0";
  const amount = parseFloat(weiAmount.toString()) / Math.pow(10, decimals);
  return amount.toFixed(precision);
};

export const getTokenTicker = (tokenName: string): string => {
  return TOKEN_MAP[tokenName]?.token_ticker ?? tokenName.toUpperCase();
};

export const capitalizeFirstLetter = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const formatSmartNumber = (value: string | number): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";

  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}k`;
  if (num < 1) return num.toFixed(4);
  return num.toFixed(num >= 10 ? 0 : 2);
};
