const decimal_points = 2;
import { BigNumber } from "bignumber.js";

export const parseAmount = (amount: string, decimals: number): string => {
  return new BigNumber(amount)
    .dividedBy(new BigNumber(10).pow(decimals))
    .toFixed(decimal_points);
};

export const parseAvailAmount = (
  amount: string,
  decimals: number,
  points?: number,
): string => {
  return new BigNumber(amount.replace(/,/g, ""))
    .dividedBy(new BigNumber(10).pow(decimals))
    .toFixed(points ?? decimal_points);
};
