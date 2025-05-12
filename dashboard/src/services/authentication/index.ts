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

      return await response.json();
    } catch (error) {
      return undefined;
    }
  }

  static async fetchUser({ token }: { token: string }) {
    try {
      console.log("token", token);
      console.log(
        "process.env.NEXT_PUBLIC_API_URL",
        `${process.env.NEXT_PUBLIC_API_URL}/v1/user/get_user`
      );
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
      console.log("response", response);
      if (!response.ok) {
        return new Error(`HTTP error! Status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return undefined;
    }
  }
}

export default AuthenticationService;
