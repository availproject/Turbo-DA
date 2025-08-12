"use client";
import AuthenticationService from "@/services/authentication";
import AppService from "@/services/app";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "./AuthProvider";
import { useUser as useClerkUser } from "@clerk/nextjs";

interface UserData {
  id?: string;
  name?: string;
  email?: string;
  credit_balance?: number;
  created_at?: string;
  updated_at?: string;
}

interface UserContextType {
  user: UserData | null;
  isLoading: boolean;
  error: string | null;
  creditBalance: number;
  refetchUser: () => Promise<void>;
  clearError: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
  initialCreditBalance?: number;
}

export const UserProvider: React.FC<UserProviderProps> = ({
  children,
  initialCreditBalance = 0,
}) => {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const { user: clerkUser } = useClerkUser();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState(initialCreditBalance);

  const fetchUser = async (): Promise<UserData | null> => {
    if (!token) {
      throw new Error("No authentication token available");
    }

    try {
      const response = await AuthenticationService.fetchUser({ token });

      if (!response?.data) {
        return null;
      }

      return response.data;
    } catch (err) {
      console.error("Failed to fetch user details:", err);
      throw new Error("Failed to load user details. Please try again.");
    }
  };

  const registerUser = async (): Promise<UserData | null> => {
    if (!token || !clerkUser?.fullName) {
      throw new Error("Missing required information for user registration");
    }

    try {
      const registerResponse = await AuthenticationService.registerUser({
        token,
        name: clerkUser.fullName,
      });

      if (!registerResponse) {
        throw new Error("Failed to register user");
      }

      // Create default app for new user
      try {
        await AppService.createApp({
          token,
          appId: 0,
          appName: `${clerkUser.fullName}'s App`,
          avatar: "avatar_1",
        });
      } catch (appError) {
        console.warn("Failed to create default app for user:", appError);
        // Don't throw here as user registration was successful
      }

      // Fetch user details after registration
      return await fetchUser();
    } catch (err) {
      console.error("Failed to register user:", err);
      throw new Error("Failed to complete user registration. Please try again.");
    }
  };

  const refetchUser = async () => {
    if (!isAuthenticated || authLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      let userData = await fetchUser();

      // If user doesn't exist, try to register them
      if (!userData && clerkUser?.fullName) {
        userData = await registerUser();
      }

      setUser(userData);
      setCreditBalance(userData?.credit_balance || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load user data";
      setError(errorMessage);
      setUser(null);
      setCreditBalance(0);
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  // Fetch user when authentication state changes
  useEffect(() => {
    if (isAuthenticated && token && !authLoading) {
      refetchUser();
    } else if (!isAuthenticated && !authLoading) {
      // Clear user data when not authenticated
      setUser(null);
      setCreditBalance(0);
      setError(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, token, authLoading]);

  const contextValue: UserContextType = {
    user,
    isLoading,
    error,
    creditBalance,
    refetchUser,
    clearError,
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);

  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }

  return context;
};

// Hook for components that need user data with proper loading states
export const useUserState = () => {
  const { user, isLoading, error, creditBalance } = useUser();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const isUserLoading = authLoading || isLoading;
  const hasUserData = Boolean(user && isAuthenticated);
  const hasError = Boolean(error);

  return {
    user,
    creditBalance,
    isLoading: isUserLoading,
    hasUserData,
    hasError,
    error,
    isLoggedOut: !authLoading && !isAuthenticated,
  };
};
