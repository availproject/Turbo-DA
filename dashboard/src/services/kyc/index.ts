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
  private static baseUrl = "http://localhost:8000/v1/user/kyc";

  static async generateAccessToken(
    clerkJWT: string,
    levelName: string = "basic-kyc-level",
    ttlInSecs: number = 3600
  ): Promise<string> {
    console.log("[KYC Service] Starting generateAccessToken request", {
      levelName,
      ttlInSecs,
      hasClerkJWT: !!clerkJWT,
      clerkJWTLength: clerkJWT?.length || 0,
    });

    try {
      const requestBody = {
        level_name: levelName,
        ttl_in_secs: ttlInSecs,
      };

      console.log(
        "[KYC Service] Making API request to:",
        `${this.baseUrl}/generate_access_token`
      );
      console.log("[KYC Service] Request body:", requestBody);

      const response = await fetch(`${this.baseUrl}/generate_access_token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkJWT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("[KYC Service] Response status:", response.status);
      console.log(
        "[KYC Service] Response headers:",
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[KYC Service] Error response body:", errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        const errorMessage =
          errorData.message ||
          `KYC API error: ${response.status} ${response.statusText}`;
        console.error("[KYC Service] Parsed error:", errorMessage);
        throw new Error(errorMessage);
      }

      const responseText = await response.text();

      const response_data = JSON.parse(responseText);
      console.log("[KYC Service] response data:", response_data);

      // Extract token from nested structure
      const token = response_data?.data?.token;
      console.log("[KYC Service] Extracted access token");

      if (!token) {
        throw new Error("No access token in response");
      }

      return token;
    } catch (error) {
      console.error(
        "[KYC Service] Failed to generate KYC access token:",
        error
      );

      if (error instanceof Error) {
        console.error("[KYC Service] Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
        throw error;
      }

      throw new Error("Failed to generate KYC access token. Please try again.");
    }
  }

  static async registerUserAfterVerification(
    clerkJWT: string,
    fullName?: string
  ): Promise<void> {
    console.log(
      "[KYC Service] Registering user after verification via /v1/user/register_new_user"
    );
    await AuthenticationService.registerUser({
      token: clerkJWT,
      name: fullName,
    });
    // Attempt to create a default app, non-fatal on failure
    try {
      await AppService.createApp({
        token: clerkJWT,
        appId: 0,
        appName: `${fullName || "My"}'s App`,
        avatar: "avatar_1",
      });
    } catch (e) {
      console.warn(
        "[KYC Service] Failed to create default app after registration:",
        e
      );
    }
  }
}

export type { KYCAccessTokenRequest, KYCAccessTokenResponse, KYCError };
