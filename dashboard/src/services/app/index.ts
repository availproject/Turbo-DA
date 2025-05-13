class AppService {
  static async getApps({ token }: { token: string }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/get_apps`,
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

  static async updateApp({
    token,
    appId,
    appName,
    avatar,
    id,
    fallbackEnabled = false,
  }: {
    token: string;
    appId: number;
    appName: string;
    avatar: string;
    id: string;
    fallbackEnabled?: boolean;
  }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/edit_app_account`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          avail_app_id: +appId,
          app_id: id,
          app_name: appName,
          app_logo: avatar,
          fallback_enabled: fallbackEnabled,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async createApp({
    token,
    appId,
    appName,
    avatar,
  }: {
    token: string;
    appId: number;
    appName: string;
    avatar: string;
  }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/generate_app_account`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          avail_app_id: +appId,
          app_name: appName,
          app_logo: avatar,
          fallback_enabled: true,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async uploadFile({ token, file }: { token: string; file: File }) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/upload_file`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async deleteApp({ token, appId }: { token: string; appId: string }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/delete_account`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          app_id: appId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async deleteAPIKey({
    token,
    identifier,
  }: {
    token: string;
    identifier: string;
  }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/delete_api_key`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          identifier: identifier,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async getAPIKeys({ token }: { token: string }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/get_api_keys`,
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

  static async generateAPIKey({
    token,
    appId,
  }: {
    token: string;
    appId: string;
  }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/generate_api_key`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          app_id: appId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async reclaimCredits({
    token,
    appId,
    amount,
  }: {
    token: string;
    appId: string;
    amount: string;
  }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/reclaim_credits`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          app_id: appId,
          amount,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async assignCredits({
    token,
    appId,
    amount,
  }: {
    token: string;
    appId: string;
    amount: string;
  }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/allocate_credit_balance`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          app_id: appId,
          amount,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }
}

export default AppService;
