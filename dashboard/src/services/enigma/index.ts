import {
  ChangeSignersRequest,
  CreateChangeSignersResponse,
  CreateDecryptRequestResponse,
  CurrentSignersResponse,
  GetDecryptRequestResponse,
  ListChangeSignersResponse,
  ListDecryptRequestsResponse,
  SubmitChangeSignersSignatureResponse,
  SubmitSignatureResponse,
} from "./response";

class EnigmaService {
  static async createDecryptRequest({
    token,
    turbo_da_app_id,
    submission_id,
  }: {
    token?: string;
    turbo_da_app_id: string;
    submission_id: string;
  }): Promise<CreateDecryptRequestResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/enigma/create_decrypt_request`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          turbo_da_app_id,
          id: submission_id,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async getDecryptRequest({
    token,
    request_id,
  }: {
    token?: string;
    request_id: string;
  }): Promise<GetDecryptRequestResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Assuming the request_id is appended to the path as per standard REST conventions
    // even though the backend macro seemed to miss the param.
    // If backend is strictly /get_decrypt_request without param, this might need changing.
    // But web::Path<String> strongly suggests it expects a path segment.
    const params = new URLSearchParams({ submission_id: request_id });
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/enigma/get_decrypt_request?${params.toString()}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async submitSignature({
    token,
    request_id,
    participant_address,
    signature,
  }: {
    token?: string;
    request_id: string;
    participant_address: string;
    signature: string;
  }): Promise<SubmitSignatureResponse> {
    console.log(  `${process.env.NEXT_PUBLIC_API_URL}/v1/user/enigma/submit_signature`);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/enigma/submit_signature`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: request_id,
          participant_address,
          signature,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async listDecryptRequests({
    token,
    turbo_da_app_id,
    offset,
    limit,
  }: {
    token?: string;
    turbo_da_app_id: string;
    offset?: number;
    limit?: number;
  }): Promise<ListDecryptRequestsResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const params = new URLSearchParams({ turbo_da_app_id });
    if (offset !== undefined) params.append("offset", offset.toString());
    if (limit !== undefined) params.append("limit", limit.toString());

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/enigma/decrypt_requests?${params.toString()}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async getParticipantApps({
    token,
    address,
  }: {
    token: string;
    address: string;
  }): Promise<any[]> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/enigma/participant_apps/${address}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  // Change Signers Methods

  static async createChangeSignersRequest({
    token,
    turbo_da_app_id,
    new_participants,
    new_threshold,
  }: {
    token: string;
    turbo_da_app_id: string;
    new_participants: string[];
    new_threshold: number;
  }): Promise<CreateChangeSignersResponse> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/enigma/change_signers/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          turbo_da_app_id,
          new_participants,
          new_threshold,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async listChangeSignersRequests({
    token,
    turbo_da_app_id,
    status,
    limit,
    offset,
  }: {
    token?: string;
    turbo_da_app_id: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ListChangeSignersResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const params = new URLSearchParams({ turbo_da_app_id });
    if (status !== undefined) params.append("status", status);
    if (limit !== undefined) params.append("limit", limit.toString());
    if (offset !== undefined) params.append("offset", offset.toString());

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/enigma/change_signers/list?${params.toString()}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async getChangeSignersRequest({
    token,
    request_id,
  }: {
    token?: string;
    request_id: string;
  }): Promise<ChangeSignersRequest> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/enigma/change_signers/${request_id}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async submitChangeSignersSignature({
    token,
    request_id,
    participant_address,
    signature,
  }: {
    token?: string;
    request_id: string;
    participant_address: string;
    signature: string;
  }): Promise<SubmitChangeSignersSignatureResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/enigma/change_signers/${request_id}/sign`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          request_id,
          participant_address,
          signature,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async getCurrentSigners({
    token,
    app_id,
  }: {
    token?: string;
    app_id: string;
  }): Promise<CurrentSignersResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/enigma/current_signers/${app_id}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }
}

export default EnigmaService;
