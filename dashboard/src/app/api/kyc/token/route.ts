import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { template } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const { getToken } = await auth();
    const token = await getToken({ template });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body for optional parameters
    const body = await request.json();
    const { levelName = "basic-kyc-level", ttlInSecs = 3600 } = body;

    // Validate levelName
    if (typeof levelName !== "string" || levelName.length === 0) {
      return NextResponse.json(
        { error: "Level name must be a non-empty string" },
        { status: 400 }
      );
    }

    if (levelName.length > 50) {
      return NextResponse.json(
        { error: "Level name must be 50 characters or less" },
        { status: 400 }
      );
    }

    // Validate ttlInSecs
    if (!Number.isInteger(ttlInSecs) || ttlInSecs < 300 || ttlInSecs > 86400) {
      return NextResponse.json(
        {
          error:
            "TTL must be an integer between 300 (5 min) and 86400 (24 hours)",
        },
        { status: 400 }
      );
    }

    console.log("[KYC Token API] Generating access token", {
      levelName,
      ttlInSecs,
      hasToken: !!token,
      tokenLength: token?.length,
      tokenPreview: token ? `${token.substring(0, 10)}...` : "null",
    });

    // Call the backend KYC endpoint server-side
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/kyc/generate_access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          level_name: levelName,
          ttl_in_secs: ttlInSecs,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[KYC Token API] Token generation failed:", errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      return NextResponse.json(
        { error: errorData.message || "Failed to generate access token" },
        { status: response.status }
      );
    }

    const responseData = await response.json();
    console.log("[KYC Token API] Access token generated successfully");

    // Extract token from nested structure (data.token)
    const accessToken = responseData?.data?.token || responseData?.token;

    if (!accessToken) {
      throw new Error("No access token in response");
    }

    return NextResponse.json({
      accessToken,
    });
  } catch (error) {
    console.error("[KYC Token API] Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
