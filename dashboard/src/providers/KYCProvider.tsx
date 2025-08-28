"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "./AuthProvider";
import { useUser } from "./UserProvider";
import { useOverview } from "./OverviewProvider";
import KYCDialog from "@/components/kyc/KYCDialog";

interface KYCContextType {
  isKYCRequired: boolean;
  isKYCCompleted: boolean;
  isCheckingKYC: boolean;
  kycError: string | null;
  markKYCCompleted: () => void;
  checkKYCStatus: () => void;
}

const KYCContext = createContext<KYCContextType | undefined>(undefined);

interface KYCProviderProps {
  children: ReactNode;
}

export const KYCProvider: React.FC<KYCProviderProps> = ({ children }) => {
  const { isAuthenticated, token, isLoading: authLoading } = useAuth();
  const { user, isLoading: userLoading, refetchUser } = useUser();
  const { refreshAppsList } = useOverview();
  const [isKYCCompleted, setIsKYCCompleted] = useState(false);
  const [isCheckingKYC, setIsCheckingKYC] = useState(false);
  const [kycError, setKycError] = useState<string | null>(null);
  const [showKYCDialog, setShowKYCDialog] = useState(false);

  // Check KYC status based on backend user presence
  const checkKYCStatus = async () => {
    console.log("[KYC Provider] Starting KYC status check", {
      isAuthenticated,
      hasToken: !!token,
      hasUser: !!user,
    });

    if (!isAuthenticated || !token) {
      console.log(
        "[KYC Provider] User not authenticated, setting KYC completed to false"
      );
      setIsKYCCompleted(false);
      setShowKYCDialog(false);
      return;
    }

    console.log("[KYC Provider] Setting checking KYC to true");
    setIsCheckingKYC(true);
    setKycError(null);

    try {
      // Primary signal: If backend does not have a user yet, we require KYC
      if (!user) {
        console.log("[KYC Provider] No backend user found; KYC required");
        setIsKYCCompleted(false);
        setShowKYCDialog(true);
        return;
      }

      // If backend user exists, KYC is considered completed
      console.log(
        "[KYC Provider] Backend user exists; KYC considered completed"
      );
      setIsKYCCompleted(true);
      setShowKYCDialog(false);
    } catch (error) {
      console.error("[KYC Provider] Failed to check KYC status:", error);
      setKycError("Failed to check verification status");
    } finally {
      setIsCheckingKYC(false);
    }
  };

  // Mark KYC as completed (server-side validation only)
  const markKYCCompleted = () => {
    console.log("[KYC Provider] Marking KYC as completed");
    setIsKYCCompleted(true);
    setShowKYCDialog(false);
    setKycError(null);
    console.log("[KYC Provider] KYC completion state updated");
  };

  // Check KYC status when authentication or user state changes
  useEffect(() => {
    console.log("[KYC Provider] useEffect triggered", {
      authLoading,
      isAuthenticated,
      hasToken: !!token,
      userLoading,
      hasUser: !!user,
    });

    if (!authLoading && !userLoading && isAuthenticated) {
      console.log(
        "[KYC Provider] Auth loaded and user authenticated, checking KYC status"
      );
      checkKYCStatus();
    } else if (!isAuthenticated) {
      console.log("[KYC Provider] User not authenticated, resetting KYC state");
      setIsKYCCompleted(false);
      setShowKYCDialog(false);
      setKycError(null);
    }
  }, [isAuthenticated, authLoading, token, userLoading, user]);

  // Reset KYC state when user changes (important for user switching)
  useEffect(() => {
    console.log("[KYC Provider] User change detected, resetting dialog state");
    setShowKYCDialog(false);
    setIsKYCCompleted(false);
  }, [token]); // Reset when token changes (indicates new user)

  const contextValue: KYCContextType = {
    isKYCRequired: isAuthenticated && !isKYCCompleted && !isCheckingKYC,
    isKYCCompleted,
    isCheckingKYC,
    kycError,
    markKYCCompleted,
    checkKYCStatus,
  };

  return (
    <KYCContext.Provider value={contextValue}>
      {children}

      {/* KYC Dialog - only show when authenticated and KYC is required */}
      <KYCDialog
        isOpen={showKYCDialog && isAuthenticated && !isKYCCompleted}
        onCompleted={async () => {
          // After KYC verified + registration, refetch user, then mark completed
          await refetchUser();
          // Refresh apps list to show the newly created default app
          await refreshAppsList();
          markKYCCompleted();
        }}
      />
    </KYCContext.Provider>
  );
};

export const useKYC = (): KYCContextType => {
  const context = useContext(KYCContext);

  if (context === undefined) {
    throw new Error("useKYC must be used within a KYCProvider");
  }

  return context;
};

// Higher-order component for protecting components that require KYC completion
export const withKYC = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return function KYCProtectedComponent(props: P) {
    const { isKYCRequired, isCheckingKYC, kycError } = useKYC();
    const { isAuthenticated, isLoading: authLoading } = useAuth();

    // Show loading while checking auth or KYC status
    if (authLoading || isCheckingKYC) {
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-white">Loading...</div>
        </div>
      );
    }

    // Show error if there's a KYC error
    if (kycError) {
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-red-400">Verification Error: {kycError}</div>
        </div>
      );
    }

    // If user is authenticated but KYC is required, show minimal content
    // The actual KYC dialog will be shown by the KYCProvider
    if (isAuthenticated && isKYCRequired) {
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-gray-400">
            Identity verification in progress...
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};
