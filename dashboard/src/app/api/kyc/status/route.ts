import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { template } from "@/lib/utils";

export async function GET(request: NextRequest) {
  console.log("[KYC Status API] ========== REQUEST START ==========");
  console.log("[KYC Status API] Request URL:", request.url);
  console.log(
    "[KYC Status API] API URL environment:",
    process.env.NEXT_PUBLIC_API_URL
  );

  try {
    // Get the authenticated user
    const { getToken } = await auth();
    console.log("[KYC Status API] Auth object received");

    const token = await getToken({ template });
    console.log("[KYC Status API] Token retrieval:", {
      hasToken: !!token,
      tokenLength: token?.length,
      tokenPreview: token ? `${token.substring(0, 20)}...` : "null",
      template: template,
    });

    if (!token) {
      console.log("[KYC Status API] No token found, returning 401");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user exists in backend
    console.log("[KYC Status API] Checking user existence in backend:", {
      backendUrl: `${process.env.NEXT_PUBLIC_API_URL}/v1/user/get_user`,
    });

    const userResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/get_user`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("[KYC Status API] Backend response received:", {
      status: userResponse.status,
      statusText: userResponse.statusText,
      ok: userResponse.ok,
      headers: Object.fromEntries(userResponse.headers.entries()),
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error("[KYC Status API] Backend error:", {
        status: userResponse.status,
        statusText: userResponse.statusText,
        errorText: errorText,
      });

      // Check if this is a "user not found" scenario
      let isUserNotFound = false;

      // Handle 404 status
      if (userResponse.status === 404) {
        isUserNotFound = true;
      }

      // Handle 500 status with "Record not found" message
      if (userResponse.status === 500) {
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error === "Record not found") {
            isUserNotFound = true;
          }
        } catch (e) {
          // If we can't parse the error, treat as general error
        }
      }

      // User doesn't exist in backend, KYC verification required
      if (isUserNotFound) {
        console.log("[KYC Status API] User not found, KYC required");
        const response = {
          kycCompleted: false,
          userExists: false,
          kycStatus: "required",
        };
        console.log(
          "[KYC Status API] Returning KYC required response:",
          response
        );
        console.log(
          "[KYC Status API] ========== REQUEST END (KYC REQUIRED) =========="
        );
        return NextResponse.json(response);
      }

      // Other genuine errors
      console.log("[KYC Status API] ========== REQUEST END (ERROR) ==========");
      return NextResponse.json(
        { error: "Failed to check user status" },
        { status: userResponse.status }
      );
    }

    const userData = await userResponse.json();
    console.log("[KYC Status API] User data received:", {
      hasUserData: !!userData,
      userDataKeys: userData ? Object.keys(userData) : [],
    });

    // User exists in backend, KYC is considered completed
    // In the future, you could add userData.kycStatus check here
    const successResponse = {
      kycCompleted: true,
      userExists: true,
      kycStatus: "verified",
      user: userData,
    };

    console.log(
      "[KYC Status API] User exists, KYC completed:",
      successResponse
    );
    console.log("[KYC Status API] ========== REQUEST END (SUCCESS) ==========");
    return NextResponse.json(successResponse);
  } catch (error) {
    console.error("[KYC Status API] ========== EXCEPTION CAUGHT ==========");
    console.error("[KYC Status API] Server error:", {
      error: error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
      type: typeof error,
    });
    console.log(
      "[KYC Status API] ========== REQUEST END (EXCEPTION) =========="
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
