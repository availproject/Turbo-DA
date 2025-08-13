"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { KYCService } from "@/services/kyc";
import { useUser as useClerkUser } from "@clerk/nextjs";
import SumsubWebSDK from "@/components/kyc/SumsubWebSDK";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface KYCDialogProps {
  isOpen: boolean;
  onCompleted: () => void;
}

type KYCStep = "checking" | "verification" | "completed";
type InterimStatus = "pending" | "cancelled" | null;

export default function KYCDialog({ isOpen, onCompleted }: KYCDialogProps) {
  const { token } = useAuth();
  const { user: clerkUser } = useClerkUser();
  const [step, setStep] = useState<KYCStep>("checking");
  const [accessToken, setAccessToken] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [interimStatus, setInterimStatus] = useState<InterimStatus>(null);

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

      console.log("[KYC Dialog] Fetching access token from backend");
      const sumsubToken = await KYCService.generateAccessToken(token);

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
    console.log("[KYC Dialog] Verification completed, registering user...");

    try {
      if (!token) {
        console.error("[KYC Dialog] No token available for registration");
        return;
      }

      await KYCService.registerUserAfterVerification(
        token,
        clerkUser?.fullName || undefined
      );
      console.log("[KYC Dialog] User registered successfully");

      setStep("completed");

      setTimeout(() => {
        console.log("[KYC Dialog] Completing KYC flow");
        onCompleted();
      }, 2000);
    } catch (err) {
      console.error("[KYC Dialog] Error registering user:", err);
      setError(
        err instanceof Error ? err.message : "Failed to complete registration"
      );
    }
  }, [token, onCompleted, clerkUser?.fullName]);

  const handleVerificationError = useCallback((error: any) => {
    console.log("[KYC Dialog] Verification error:", error);
    setError(error.error || "Verification failed. Please try again.");
  }, []);

  const getNewAccessToken = useCallback(async () => {
    console.log("[KYC Dialog] Token expired, refreshing...");
    if (!token) throw new Error("No auth token available");
    return await KYCService.generateAccessToken(token);
  }, [token]);

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
              Please wait while we prepare your verification
            </div>
          </div>
        );

      case "verification":
        if (interimStatus === "pending") {
          return (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mb-4" />
              <DialogTitle>
                <div className="text-xl font-bold text-white text-center">
                  Verification in review
                </div>
              </DialogTitle>
              <div className="text-gray-300 text-center mt-2">
                Your documents are submitted and being reviewed. You can close
                this window and return later.
              </div>
            </div>
          );
        }
        if (interimStatus === "cancelled") {
          return (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mb-4" />
              <DialogTitle>
                <div className="text-xl font-bold text-white text-center">
                  Verification cancelled
                </div>
              </DialogTitle>
              <div className="text-gray-300 text-center mt-2">
                Your verification was cancelled.
              </div>
            </div>
          );
        }
        return (
          <div className="h-full w-full overflow-auto">
            <SumsubWebSDK
              accessToken={accessToken}
              onTokenExpiration={getNewAccessToken}
              onCompleted={handleVerificationCompleted}
              onError={handleVerificationError}
              onStatusUpdate={({ reviewStatus, answer }) => {
                const status = (reviewStatus || "").toLowerCase();
                const ans = (answer || "").toUpperCase();
                if (status === "pending" || ans === "YELLOW") {
                  setInterimStatus("pending");
                } else if (status === "canceled" || status === "cancelled") {
                  setInterimStatus("cancelled");
                } else {
                  setInterimStatus(null);
                }
              }}
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
        className="max-w-4xl w-full h-[80vh] p-0 border-none rounded-3xl"
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
