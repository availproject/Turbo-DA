class AppService {
  static async uploadAvatar({ token, data }: { token: string; data: number }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/estimate_credits?data=${data}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }
}

export default AppService;
