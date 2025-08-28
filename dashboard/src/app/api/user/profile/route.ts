import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { template } from "@/lib/utils";

export async function GET(request: NextRequest) {
  console.log("[User Profile API] ========== REQUEST START ==========");
  console.log("[User Profile API] Request URL:", request.url);
  console.log(
    "[User Profile API] API URL environment:",
    process.env.NEXT_PUBLIC_API_URL
  );

  try {
    // Get the authenticated user
    const { getToken } = await auth();
    console.log("[User Profile API] Auth object received");

    const token = await getToken({ template });
    console.log("[User Profile API] Token retrieval:", {
      hasToken: !!token,
      tokenLength: token?.length,
      tokenPreview: token ? `${token.substring(0, 20)}...` : "null",
      template: template,
    });

    if (!token) {
      console.log("[User Profile API] No token found, returning 401");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[User Profile API] Fetching user profile", {
      hasToken: !!token,
      backendUrl: `${process.env.NEXT_PUBLIC_API_URL}/v1/user/get_user`,
    });

    // Call the backend get_user endpoint server-side
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/get_user`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("[User Profile API] Backend response received:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[User Profile API] Backend error response:", {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
      });
      console.error("[User Profile API] Failed to fetch user:", errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
        console.log("[User Profile API] Parsed error data:", errorData);
      } catch {
        errorData = { message: errorText };
        console.log(
          "[User Profile API] Could not parse error as JSON, using raw text"
        );
      }

      // Check if this is a "user not found" scenario
      let isUserNotFound = false;

      // Handle 404 status
      if (response.status === 404) {
        isUserNotFound = true;
      }

      // Handle 500 status with "Record not found" message
      if (response.status === 500 && errorData.error === "Record not found") {
        isUserNotFound = true;
      }

      // Return 404 for not found scenarios
      if (isUserNotFound) {
        console.log("[User Profile API] User not found, returning 404");
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json(
        {
          error:
            errorData.message ||
            errorData.error ||
            "Failed to fetch user profile",
        },
        { status: response.status }
      );
    }

    const userData = await response.json();
    console.log("[User Profile API] User profile fetched successfully:", {
      hasUserData: !!userData,
      userDataKeys: userData ? Object.keys(userData) : [],
    });

    const successResponse = {
      success: true,
      data: userData,
    };

    console.log("[User Profile API] Returning success response");
    console.log(
      "[User Profile API] ========== REQUEST END (SUCCESS) =========="
    );

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error("[User Profile API] ========== EXCEPTION CAUGHT ==========");
    console.error("[User Profile API] Server error:", {
      error: error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
      type: typeof error,
    });
    console.log("[User Profile API] ========== REQUEST END (ERROR) ==========");

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
