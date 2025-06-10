"use client";
import { Text } from "@/components/text";
import { useAuth, SignInButton } from "@clerk/nextjs";
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
}: BuySectionProps) => {
  const { isSignedIn } = useAuth();

  return (
    <div className="flex-1 flex flex-col gap-y-3 items-center p-4 justify-end">
      {isSignedIn ? (
        <>
          {!!error && (
            <Text variant={"error"} size={"sm"} weight={"medium"}>
              {error}
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
      ) : (
        <SignInButton mode="modal" component="div">
          <Button>Sign In</Button>
        </SignInButton>
      )}
    </div>
  );
};

export default BuySection;
