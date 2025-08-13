"use client";
import { template } from "@/lib/utils";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface AuthContextType {
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  initialToken?: string;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  initialToken,
}) => {
  const { getToken, isLoaded, isSignedIn } = useClerkAuth();
  const [token, setToken] = useState<string | null>(initialToken || null);
  const [isLoading, setIsLoading] = useState(!isLoaded);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = async (): Promise<string | null> => {
    try {
      if (!isSignedIn) {
        return null;
      }

      const authToken = await getToken({ template });
      return authToken;
    } catch (err) {
      console.error("Failed to fetch authentication token:", err);
      throw new Error("Failed to authenticate. Please try logging in again.");
    }
  };

  const refreshToken = async () => {
    if (!isLoaded) return;

    setIsLoading(true);
    setError(null);

    try {
      const newToken = await fetchToken();
      setToken(newToken);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Authentication failed";
      setError(errorMessage);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  useEffect(() => {
    if (isLoaded) {
      refreshToken();
    }
  }, [isLoaded, isSignedIn]);

  // Auto-refresh token every 5 minutes to keep it fresh
  useEffect(() => {
    if (!isSignedIn || !isLoaded) return;

    const interval = setInterval(() => {
      refreshToken();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isSignedIn, isLoaded]);

  const isAuthenticated = Boolean(token && isSignedIn);

  const contextValue: AuthContextType = {
    token,
    isLoading,
    isAuthenticated,
    error,
    refreshToken,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};

// Higher-order component for protecting components that require authentication
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, error } = useAuth();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-white">Loading...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-red-400">Authentication Error: {error}</div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-gray-400">
            Please sign in to access this content.
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

// Hook for components that need to handle auth states gracefully
export const useAuthState = () => {
  const { isAuthenticated, isLoading, error, token } = useAuth();

  return {
    isAuthenticated,
    isLoading,
    hasError: Boolean(error),
    error,
    token,
    isLoggedOut: !isLoading && !isAuthenticated && !error,
  };
};
