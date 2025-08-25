import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { template } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const { getToken } = await auth();
    const token = await getToken({ template });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[User Profile API] Fetching user profile", {
      hasToken: !!token,
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

    if (!response.ok) {
      // Return 404 for not found, other errors as-is
      if (response.status === 404) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const errorText = await response.text();
      console.error("[User Profile API] Failed to fetch user:", errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      return NextResponse.json(
        { error: errorData.message || "Failed to fetch user profile" },
        { status: response.status }
      );
    }

    const userData = await response.json();
    console.log("[User Profile API] User profile fetched successfully");

    return NextResponse.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    console.error("[User Profile API] Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
