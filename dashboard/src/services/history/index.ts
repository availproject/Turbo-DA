class HistoryService {
  static async getCreditHistory({ token }: { token: string }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/get_fund_list`,
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

  static async getDataPostingHistory({ token }: { token: string }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/get_all_expenditure?limit=10`,
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

export default HistoryService;
