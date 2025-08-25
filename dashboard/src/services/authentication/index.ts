class AuthenticationService {
  static async registerUser({
    name,
    token,
    tosAcceptedAt,
  }: {
    name?: string;
    token: string;
    tosAcceptedAt?: string;
  }) {
    console.log(
      "[AuthenticationService] ========== REGISTER USER START =========="
    );
    console.log("[AuthenticationService] registerUser called with:", {
      hasName: !!name,
      nameValue: name,
      nameType: typeof name,
      hasToken: !!token,
      tokenLength: token?.length,
      tokenPreview: token ? `${token.substring(0, 20)}...` : "null",
    });

    try {
      console.log(
        "[AuthenticationService] Making request to Next.js API route..."
      );

      // Use Next.js API route instead of direct backend call
      const response = await fetch("/api/user/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, tosAcceptedAt }),
      });

      console.log("[AuthenticationService] API route response received:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        console.error("[AuthenticationService] API route request failed");

        const errorData = await response.json();
        console.error("[AuthenticationService] Error data from API:", {
          errorData: errorData,
          errorDataKeys: Object.keys(errorData),
        });

        const errorMessage =
          errorData.error ||
          `Registration failed: ${response.status} ${response.statusText}`;
        console.error("[AuthenticationService] Throwing error:", errorMessage);

        throw new Error(errorMessage);
      }

      console.log(
        "[AuthenticationService] API route request successful, parsing response..."
      );
      const result = await response.json();

      console.log("[AuthenticationService] Registration response parsed:", {
        hasResult: !!result,
        resultKeys: result ? Object.keys(result) : [],
        hasData: !!result?.data,
        dataKeys: result?.data ? Object.keys(result.data) : [],
        fullResult: result,
      });

      console.log(
        "[AuthenticationService] ========== REGISTER USER END (SUCCESS) =========="
      );
      return result.data;
    } catch (error) {
      console.error(
        "[AuthenticationService] ========== REGISTER USER END (ERROR) =========="
      );
      console.error("[AuthenticationService] Registration error:", {
        error: error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : "No stack trace",
        errorType: typeof error,
      });
      throw error;
    }
  }

  static async fetchUser({ token }: { token: string }) {
    try {
      // Use Next.js API route instead of direct backend call
      const response = await fetch("/api/user/profile", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return undefined;
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      return undefined;
    }
  }
}

export default AuthenticationService;
