import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const { getToken } = await auth();
    const token = await getToken();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const { fullName } = body;

    // Validate fullName
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
      return NextResponse.json(
        { error: "Full name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (fullName.length > 100) {
      return NextResponse.json(
        { error: "Full name must be 100 characters or less" },
        { status: 400 }
      );
    }

    // Sanitize fullName (remove potentially dangerous characters)
    const sanitizedFullName = fullName.trim().replace(/[<>]/g, '');

    // Call the backend register_new_user endpoint server-side
    const registerResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/register_new_user`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: sanitizedFullName }),
      }
    );

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      console.error("[KYC API] Registration failed:", errorText);
      return NextResponse.json(
        { error: "Registration failed" },
        { status: registerResponse.status }
      );
    }

    const userData = await registerResponse.json();

    // Attempt to create a default app (non-fatal on failure)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/user/app/create_app`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          app_id: 0,
          app_name: `${sanitizedFullName || "My"}'s App`,
          avatar: "avatar_1",
        }),
      });
    } catch (appError) {
      console.warn("[KYC API] Failed to create default app:", appError);
      // Don't fail the registration for this
    }

    return NextResponse.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error("[KYC API] Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
