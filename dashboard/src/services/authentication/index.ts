class AuthenticationService {
  static async registerUser({ name, token }: { name?: string; token: string }) {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/user/register_new_user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name }),
        }
      );

      if (!response.ok) {
        return undefined;
      }

      return await response.json();
    } catch (error) {
      return undefined;
    }
  }

  static async fetchUser({ token }: { token: string }) {
    try {
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
        return undefined;
      }

      return await response.json();
    } catch (error) {
      return undefined;
    }
  }
}

export default AuthenticationService;
