interface KYCAccessTokenRequest {
  level_name: string;
  ttl_in_secs: number;
}

interface KYCAccessTokenResponse {
  token: string;
}

interface KYCError {
  message: string;
  code?: string;
}

import AuthenticationService from "@/services/authentication";
import AppService from "@/services/app";

export class KYCService {
  static async registerUserAfterVerification(
    clerkJWT: string,
    fullName?: string,
    tosAcceptedAt?: string
  ): Promise<void> {
    console.log(
      "[KYC Service] ========== REGISTER USER AFTER VERIFICATION START =========="
    );
    console.log("[KYC Service] registerUserAfterVerification called with:", {
      hasClerkJWT: !!clerkJWT,
      clerkJWTLength: clerkJWT?.length,
      clerkJWTPreview: clerkJWT ? `${clerkJWT.substring(0, 20)}...` : "null",
      hasFullName: !!fullName,
      fullNameValue: fullName,
      fullNameType: typeof fullName,
    });

    console.log("[KYC Service] Calling AuthenticationService.registerUser...");

    try {
      await AuthenticationService.registerUser({
        token: clerkJWT,
        name: fullName,
        tosAcceptedAt,
      });

      console.log(
        "[KYC Service] User registration successful, proceeding to create default app..."
      );
    } catch (registrationError) {
      console.error("[KYC Service] User registration failed:", {
        error: registrationError,
        errorMessage:
          registrationError instanceof Error
            ? registrationError.message
            : "Unknown error",
        errorStack:
          registrationError instanceof Error
            ? registrationError.stack
            : "No stack trace",
      });
      throw registrationError; // Re-throw to propagate the error
    }

    // Attempt to create a default app, non-fatal on failure
    console.log("[KYC Service] Attempting to create default app...");

    try {
      await AppService.createApp({
        token: clerkJWT,
        appId: 0,
        appName: `${fullName || "My"}'s App`,
        avatar: "avatar_1",
      });

      console.log("[KYC Service] Default app created successfully");
    } catch (e) {
      console.warn(
        "[KYC Service] Failed to create default app after registration (non-fatal):",
        {
          error: e,
          errorMessage: e instanceof Error ? e.message : "Unknown error",
          errorType: typeof e,
        }
      );
    }

    console.log(
      "[KYC Service] ========== REGISTER USER AFTER VERIFICATION END (SUCCESS) =========="
    );
  }
}

export type { KYCAccessTokenRequest, KYCAccessTokenResponse, KYCError };
