import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function formatBalance(balance: string) {
  return parseFloat(balance).toFixed(2)
}

export const template = 'gas'