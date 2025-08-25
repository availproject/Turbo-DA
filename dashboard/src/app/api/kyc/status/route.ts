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

    // Check if user exists in backend
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

    if (!userResponse.ok) {
      // User doesn't exist in backend, KYC verification required
      if (userResponse.status === 404) {
        return NextResponse.json({
          kycCompleted: false,
          userExists: false,
          kycStatus: "required",
        });
      }

      // Other errors
      return NextResponse.json(
        { error: "Failed to check user status" },
        { status: userResponse.status }
      );
    }

    const userData = await userResponse.json();

    // User exists in backend, KYC is considered completed
    // In the future, you could add userData.kycStatus check here
    return NextResponse.json({
      kycCompleted: true,
      userExists: true,
      kycStatus: "verified",
      user: userData,
    });
  } catch (error) {
    console.error("[KYC Status API] Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
