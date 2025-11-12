"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";

export async function updateUserCountry(country: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { error: "Unauthorized" };
    }

    if (!country) {
      return { error: "Country is required" };
    }

    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        country,
      },
    });

    return { success: true, country };
  } catch (error) {
    console.error("Error updating country:", error);
    return { error: "Failed to update country" };
  }
}
