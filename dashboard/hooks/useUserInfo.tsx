import { Logger } from "@/lib/logger";
import { fetchUser, registerUser } from "@/lib/services";
import { template } from "@/lib/utils";
import { useCommonStore } from "@/store/common";
import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect } from "react";

export default function useUserInfo() {
  const { getToken, isSignedIn } = useAuth();
  const { user, isLoaded } = useUser()
  const { setUser, setSessionToken, setUserFetched } = useCommonStore();

  /** fetches token on every refresh, better to cache perhaps */
  useEffect(() => {
    (async () => {
      if (isSignedIn && isLoaded) {
        const token = await getToken({ template });
        token && setSessionToken(token);
      }
    })();
  }, [getToken, isSignedIn, isLoaded, setSessionToken]);

  const getUserInfo = useCallback(async () => {
    try {

      while(!isLoaded) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!isSignedIn || !isLoaded) {
        throw new Error("User not signed in. Did you forget to sign in?");
      }

      const token = await getToken({ template });
      if (!token) {
        throw new Error("Failed to retrieve authentication token.");
      }

      let _user = await fetchUser(token);
      if (!_user ) {
        console.log("User not found, attempting to register...");
        const registrationResult = await registerUser(token, user?.primaryEmailAddress?.emailAddress!, user?.fullName!);
        if (!registrationResult) {
          throw new Error("Failed to register user.");
        }

        _user = await fetchUser(token);
        if (!_user) {
          throw new Error(
            "User registration succeeded, but fetching user failed."
          );
        }
      }

      setUser(_user);
      setUserFetched(true)
      return user;
    } catch (error: any) {
      Logger.error(error.message || "An unexpected error occurred");
      throw error;
    }
  }, [getToken, isLoaded, isSignedIn, setUser, user]);

  /**
   * TODO: get user session from clerk and get the user object from
   */

  return {
    getUserInfo,
  };
}
