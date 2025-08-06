"use client";
import { Text } from "@/components/text";
import { SignInButton } from "@clerk/nextjs";
import Button from "@/components/button";
import BuyButton from "./buy-button";
import { ClickHandler } from "../utils/types";

interface BuySectionProps {
  tokenAmount: string;
  tokenAmountError: string;
  error: string;
  onBuyStart?: ClickHandler;
  onBuyComplete?: ClickHandler;
  onBuyError?: (error: string) => void;
  onTokenAmountClear?: ClickHandler;
  token?: string;
  showBalanceError?: boolean;
  isAuthenticated?: boolean;
  isLoggedOut?: boolean;
}

const BuySection = ({
  tokenAmount,
  tokenAmountError,
  error,
  onBuyStart,
  onBuyComplete,
  onBuyError,
  onTokenAmountClear,
  token,
  showBalanceError,
  isAuthenticated,
  isLoggedOut,
}: BuySectionProps) => {
  return (
    <div className="flex-1 flex flex-col gap-y-3 items-center p-4 justify-end">
      {isAuthenticated ? (
        <>
          {!!error && (
            <Text variant={"error"} size={"sm"} weight={"medium"}>
              {error}
            </Text>
          )}
          {tokenAmountError && (
            <Text variant={"error"} size={"sm"} weight={"medium"}>
              {tokenAmountError}
            </Text>
          )}
          {showBalanceError && !tokenAmountError && (
            <Text variant={"error"} size={"sm"} weight={"medium"}>
              Insufficient balance. Please enter a smaller amount
            </Text>
          )}
          <BuyButton
            tokenAmount={tokenAmount}
            tokenAmountError={tokenAmountError}
            onBuyStart={onBuyStart}
            onBuyComplete={onBuyComplete}
            onBuyError={onBuyError}
            onTokenAmountClear={onTokenAmountClear}
            token={token}
          />
        </>
      ) : isLoggedOut ? (
        <SignInButton mode="modal" component="div">
          <Button>Sign In</Button>
        </SignInButton>
      ) : (
        <Button disabled>Loading...</Button>
      )}
    </div>
  );
};

export default BuySection;
