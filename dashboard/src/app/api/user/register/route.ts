import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { template } from "@/lib/utils";

export async function POST(request: NextRequest) {
  console.log(
    "[User Registration API] ========== REGISTRATION REQUEST START =========="
  );

  try {
    console.log("[User Registration API] Getting authentication token...");

    // Get the authenticated user
    const { getToken } = await auth();
    const token = await getToken({ template });

    console.log("[User Registration API] Authentication check:", {
      hasGetToken: !!getToken,
      hasToken: !!token,
      tokenLength: token?.length,
      tokenPreview: token ? `${token.substring(0, 20)}...` : "null",
      template: template,
    });

    if (!token) {
      console.error(
        "[User Registration API] No authentication token available"
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    console.log("[User Registration API] Parsing request body...");
    const body = await request.json();
    const { name, tosAcceptedAt } = body;

    console.log("[User Registration API] Request body parsed:", {
      hasName: !!name,
      nameType: typeof name,
      nameValue: name,
      hasTosAcceptedAt: !!tosAcceptedAt,
      tosAcceptedAt,
      bodyKeys: Object.keys(body),
    });

    // Validate name (optional parameter)
    if (name !== undefined) {
      console.log("[User Registration API] Validating name parameter...");

      if (typeof name !== "string") {
        console.error(
          "[User Registration API] Name validation failed: not a string"
        );
        return NextResponse.json(
          { error: "Name must be a string" },
          { status: 400 }
        );
      }

      if (name.length > 100) {
        console.error(
          "[User Registration API] Name validation failed: too long"
        );
        return NextResponse.json(
          { error: "Name must be 100 characters or less" },
          { status: 400 }
        );
      }
    }

    // Sanitize name if provided
    const sanitizedName = name ? name.trim().replace(/[<>]/g, "") : undefined;

    console.log("[User Registration API] Name processing:", {
      originalName: name,
      sanitizedName: sanitizedName,
      nameChanged: name !== sanitizedName,
    });

    console.log("[User Registration API] Preparing backend request:", {
      backendUrl: `${process.env.NEXT_PUBLIC_API_URL}/v1/user/register_new_user`,
      hasToken: !!token,
      hasSanitizedName: !!sanitizedName,
    });

    // Call the backend register_new_user endpoint server-side
    console.log("[User Registration API] Making request to backend...");

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/register_new_user`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: sanitizedName,
          // TODO: Uncomment when backend supports tos_accepted_at
          // tos_accepted_at: tosAcceptedAt,
        }),
      }
    );

    console.log("[User Registration API] Backend response received:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[User Registration API] Backend registration failed:", {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
        errorTextLength: errorText.length,
      });

      let errorData;
      try {
        errorData = JSON.parse(errorText);
        console.log("[User Registration API] Parsed error data:", errorData);
      } catch (parseError) {
        console.warn(
          "[User Registration API] Could not parse error as JSON:",
          parseError
        );
        errorData = { message: errorText };
      }

      const errorResponse = {
        error: errorData.message || "Registration failed",
        status: response.status,
        originalError: errorData,
      };

      console.error(
        "[User Registration API] Returning error response:",
        errorResponse
      );

      return NextResponse.json(
        { error: errorData.message || "Registration failed" },
        { status: response.status }
      );
    }

    console.log(
      "[User Registration API] Backend registration successful, parsing response..."
    );
    const userData = await response.json();

    console.log("[User Registration API] Registration successful:", {
      hasUserData: !!userData,
      userDataKeys: userData ? Object.keys(userData) : [],
      userData: userData,
    });

    const successResponse = {
      success: true,
      data: userData,
    };

    console.log(
      "[User Registration API] Returning success response:",
      successResponse
    );
    console.log(
      "[User Registration API] ========== REGISTRATION REQUEST END (SUCCESS) =========="
    );

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error(
      "[User Registration API] ========== REGISTRATION REQUEST END (ERROR) =========="
    );
    console.error("[User Registration API] Unexpected server error:", {
      error: error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : "No stack trace",
      errorType: typeof error,
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
