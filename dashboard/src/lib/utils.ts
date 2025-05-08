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

export const formatDataBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = Math.max(0, decimals);
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
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

export const formatBytes = (bytes: string) => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = parseFloat(bytes);
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(3)} ${units[unitIndex]}`;
};
