import {
  AddParticipantResponse,
  CreateDecryptRequestResponse,
  DeleteParticipantResponse,
  GetDecryptRequestResponse,
  ListDecryptRequestsResponse,
  SubmitSignatureResponse,
} from "./response";

class EnigmaService {
  static async addParticipant({
    token,
    turbo_da_app_id,
    participants,
  }: {
    token: string;
    turbo_da_app_id: string;
    participants: string[];
  }): Promise<AddParticipantResponse> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/enigma/add_participant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          turbo_da_app_id,
          participants,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async deleteParticipant({
    token,
    turbo_da_app_id,
    participants,
  }: {
    token: string;
    turbo_da_app_id: string;
    participants: string[];
  }): Promise<DeleteParticipantResponse> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/enigma/delete_participant`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          turbo_da_app_id,
          participants,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async createDecryptRequest({
    token,
    turbo_da_app_id,
    submission_id,
  }: {
    token: string;
    turbo_da_app_id: string;
    submission_id: string;
  }): Promise<CreateDecryptRequestResponse> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/enigma/create_decrypt_request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
    token: string;
    request_id: string;
  }): Promise<GetDecryptRequestResponse> {
    // Assuming the request_id is appended to the path as per standard REST conventions
    // even though the backend macro seemed to miss the param.
    // If backend is strictly /get_decrypt_request without param, this might need changing.
    // But web::Path<String> strongly suggests it expects a path segment.
    const params = new URLSearchParams({ submission_id: request_id });
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/enigma/get_decrypt_request?${params.toString()}`,
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

  static async submitSignature({
    token,
    request_id,
    participant_address,
    signature,
  }: {
    token: string;
    request_id: string;
    participant_address: string;
    signature: string;
  }): Promise<SubmitSignatureResponse> {
    console.log(  `${process.env.NEXT_PUBLIC_API_URL}/v1/enigma/submit_signature`);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/enigma/submit_signature`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
    token: string;
    turbo_da_app_id: string;
    offset?: number;
    limit?: number;
  }): Promise<ListDecryptRequestsResponse> {
    const params = new URLSearchParams({ turbo_da_app_id });
    if (offset !== undefined) params.append("offset", offset.toString());
    if (limit !== undefined) params.append("limit", limit.toString());

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/enigma/decrypt_requests?${params.toString()}`,
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
}

export default EnigmaService;
