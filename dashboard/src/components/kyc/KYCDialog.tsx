"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { KYCService } from "@/services/kyc";
import { useUser as useClerkUser } from "@clerk/nextjs";
import SumsubWebSDK from "@/components/kyc/SumsubWebSDK";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Button from "@/components/button";
import { Text } from "@/components/text";
import { tnc, privacyPolicy } from "@/lib/constant";
import Link from "next/link";

interface KYCDialogProps {
  isOpen: boolean;
  onCompleted: () => void;
}

type KYCStep = "checking" | "terms-acceptance" | "verification" | "completed";

export default function KYCDialog({ isOpen, onCompleted }: KYCDialogProps) {
  const { token } = useAuth();
  const { user: clerkUser } = useClerkUser();
  const [step, setStep] = useState<KYCStep>("checking");
  const [accessToken, setAccessToken] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [tosAcceptedAt, setTosAcceptedAt] = useState<string | null>(null);
  const [tosCheckboxChecked, setTosCheckboxChecked] = useState(false);

  // Initialize when dialog opens
  useEffect(() => {
    if (isOpen && step === "checking" && !accessToken) {
      initializeVerification();
    }
  }, [isOpen, step, accessToken]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep("checking");
      setAccessToken("");
      setError(null);
      setTosAccepted(false);
      setTosAcceptedAt(null);
      setTosCheckboxChecked(false);
    }
  }, [isOpen]);

  const initializeVerification = async () => {
    console.log("[KYC Dialog] Initializing verification, checking status...");

    try {
      if (!token) {
        console.error("[KYC Dialog] No authentication token available");
        setError("Authentication token not available");
        return;
      }

      // Skip directly to terms acceptance since this is a new user flow
      console.log("[KYC Dialog] Moving to terms acceptance step");
      setStep("terms-acceptance");
    } catch (err) {
      console.error("[KYC Dialog] Error initializing verification:", err);
      setError(
        err instanceof Error ? err.message : "Failed to initialize verification"
      );
    }
  };

  const handleTosAcceptance = () => {
    if (!tosCheckboxChecked) {
      console.warn("[KYC Dialog] ToS checkbox not checked");
      return;
    }

    const timestamp = new Date().toISOString();
    setTosAccepted(true);
    setTosAcceptedAt(timestamp);
    console.log("[KYC Dialog] ToS accepted at:", timestamp);

    // Move to verification step and initialize Sumsub
    proceedToVerification();
  };

  const proceedToVerification = async () => {
    try {
      console.log("[KYC Dialog] Fetching access token from Next.js API route");
      const response = await fetch("/api/kyc/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          levelName: "basic-kyc-level",
          ttlInSecs: 3600,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate access token");
      }

      const { accessToken: sumsubToken } = await response.json();

      console.log("[KYC Dialog] Access token received, starting WebSDK");
      setAccessToken(sumsubToken);
      setStep("verification");
    } catch (err) {
      console.error("[KYC Dialog] Error initializing verification:", err);
      setError(
        err instanceof Error ? err.message : "Failed to initialize verification"
      );
    }
  };

  const handleVerificationCompleted = useCallback(async () => {
    console.log(
      "[KYC Dialog] ========== VERIFICATION COMPLETED START =========="
    );
    console.log(
      "[KYC Dialog] Verification completed, starting registration process..."
    );
    console.log("[KYC Dialog] Current state:", {
      hasToken: !!token,
      tokenLength: token?.length,
      tokenPreview: token ? `${token.substring(0, 20)}...` : "null",
      hasClerkUser: !!clerkUser,
      clerkUserFullName: clerkUser?.fullName,
      currentStep: step,
      tosAccepted,
      tosAcceptedAt,
    });

    try {
      if (!token) {
        console.error(
          "[KYC Dialog] No authentication token available for registration"
        );
        setError("Authentication token not available");
        return;
      }

      if (!tosAccepted || !tosAcceptedAt) {
        console.error("[KYC Dialog] ToS not accepted before registration");
        setError("Terms of service must be accepted");
        return;
      }

      console.log(
        "[KYC Dialog] Calling KYCService.registerUserAfterVerification..."
      );

      await KYCService.registerUserAfterVerification(
        token,
        clerkUser?.fullName || undefined,
        tosAcceptedAt
      );

      console.log("[KYC Dialog] User registration completed successfully!");
      console.log("[KYC Dialog] Setting step to 'completed'...");

      setStep("completed");

      console.log("[KYC Dialog] Starting timeout for completion callback...");
      setTimeout(() => {
        console.log(
          "[KYC Dialog] Timeout reached, calling onCompleted callback"
        );
        onCompleted();
        console.log(
          "[KYC Dialog] ========== VERIFICATION COMPLETED END (SUCCESS) =========="
        );
      }, 2000);
    } catch (err) {
      console.error("[KYC Dialog] Registration error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to complete registration. Please try again."
      );
      console.log(
        "[KYC Dialog] ========== VERIFICATION COMPLETED END (ERROR) =========="
      );
    }
  }, [token, clerkUser, onCompleted, tosAccepted, tosAcceptedAt]);

  const handleVerificationError = useCallback((error: any) => {
    console.error("[KYC Dialog] ========== VERIFICATION ERROR ==========");
    console.error("[KYC Dialog] Verification error occurred:", {
      error: error,
      errorMessage:
        error instanceof Error ? error.message : "Unknown verification error",
      errorStack: error instanceof Error ? error.stack : "No stack trace",
      errorType: typeof error,
      errorToString: String(error),
      hasErrorProperty: !!error?.error,
      errorProperty: error?.error,
    });

    const errorMessage =
      error.error || "Verification failed. Please try again.";
    console.error(
      "[KYC Dialog] Setting verification error state:",
      errorMessage
    );
    setError(errorMessage);
  }, []);

  const getNewAccessToken = async (): Promise<string> => {
    console.log("[KYC Dialog] Token expired, getting new access token");
    try {
      // Use Next.js API route instead of direct service call
      const response = await fetch("/api/kyc/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          levelName: "basic-kyc-level",
          ttlInSecs: 3600,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate access token");
      }

      const { accessToken } = await response.json();
      return accessToken;
    } catch (error) {
      console.error("[KYC Dialog] Failed to refresh access token:", error);
      throw error;
    }
  };

  const renderContent = () => {
    switch (step) {
      case "checking":
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-4" />
            <DialogTitle>
              <div className="text-xl font-bold text-white text-center">
                Checking Verification Status...
              </div>
            </DialogTitle>
            <div className="text-gray-300 text-center mt-2">
              Please wait while we check your verification status
            </div>
          </div>
        );

      case "terms-acceptance":
        return (
          <div className="h-full flex flex-col p-6 z-1 justify-between">
            <div className="flex flex-col gap-y-6 text-center max-w-[500px] mx-auto">
              <DialogTitle>
                <Text weight={"bold"} size={"2xl"}>
                  Terms of Service Agreement
                </Text>
              </DialogTitle>

              <div className="flex flex-col gap-y-4">
                <Text
                  weight={"medium"}
                  variant={"secondary-grey"}
                  size={"base"}
                >
                  By proceeding with KYC verification, you acknowledge that you
                  have read and agree to our{" "}
                  <Link
                    href={tnc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href={privacyPolicy}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </Text>
              </div>

              {/* Checkbox for agreement */}
              <div className="flex items-center justify-center gap-x-3 p-4 bg-[#1a2332] rounded-lg border border-[#2B4761]">
                <input
                  type="checkbox"
                  id="tos-checkbox"
                  checked={tosCheckboxChecked}
                  onChange={(e) => setTosCheckboxChecked(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label
                  htmlFor="tos-checkbox"
                  className="text-white cursor-pointer flex-1 text-left"
                >
                  <Text size={"sm"} weight={"medium"}>
                    I have read and agree to the Terms of Service and Privacy
                    Policy
                  </Text>
                </label>
              </div>
            </div>

            <div className="flex gap-x-4 max-w-[500px] mx-auto w-full">
              <Button
                onClick={handleTosAcceptance}
                className="w-full"
                disabled={!tosCheckboxChecked}
                variant={tosCheckboxChecked ? "primary" : "disabled"}
              >
                <Text weight={"semibold"} size={"lg"}>
                  Continue to Verification
                </Text>
              </Button>
            </div>
          </div>
        );

      case "verification":
        return (
          <div className="h-full w-full overflow-auto">
            <SumsubWebSDK
              accessToken={accessToken}
              onTokenExpiration={getNewAccessToken}
              onCompleted={handleVerificationCompleted}
              onError={handleVerificationError}
              className="min-h-[500px]"
            />
          </div>
        );

      case "completed":
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <DialogTitle>
              <div className="text-xl font-bold text-white text-center">
                Verification Completed!
              </div>
            </DialogTitle>
            <div className="text-gray-300 text-center mt-2">
              Redirecting to dashboard...
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal>
      <DialogContent
        className={`${
          step === "verification"
            ? "max-w-4xl w-full h-[80vh]"
            : "min-w-[600px] h-[500px]"
        } p-0 border-none rounded-3xl`}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden flex flex-col focus-within:outline-0 h-full w-full relative">
          <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
          <div className="h-full flex flex-col p-6 z-1 relative">
            {error ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <DialogTitle>
                  <div className="text-xl font-bold text-white text-center">
                    Verification Error
                  </div>
                </DialogTitle>
                <div className="text-gray-300 text-center mt-2 max-w-md">
                  {error}
                </div>
              </div>
            ) : (
              renderContent()
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
