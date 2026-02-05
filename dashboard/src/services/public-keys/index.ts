export interface PublicKey {
  id: string;
  user_id: string;
  public_address: string;
  created_at: string;
}

export interface PublicKeyResponse {
  state: "SUCCESS" | "ERROR";
  message: string;
  data?: PublicKey | PublicKey[];
  error?: string;
}

class PublicKeyService {
  static async getPublicKeys({ token }: { token: string }): Promise<PublicKeyResponse> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/public_keys`,
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

  static async addPublicKey({
    token,
    publicAddress,
  }: {
    token: string;
    publicAddress: string;
  }): Promise<PublicKeyResponse> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/public_keys`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          public_address: publicAddress,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async deletePublicKey({
    token,
    publicAddress,
  }: {
    token: string;
    publicAddress: string;
  }): Promise<PublicKeyResponse> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/public_keys`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          public_address: publicAddress,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }
}

export default PublicKeyService;
