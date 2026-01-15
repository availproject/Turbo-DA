export interface AddParticipantResponse {
  turbo_da_app_id: string;
  participants_added: number;
}

export interface DeleteParticipantResponse {
  turbo_da_app_id: string;
  participants_deleted: number;
}

export interface CreateDecryptRequestResponse {
  request_id: string;
  turbo_da_app_id: string;
  status: string;
  signers: string[];
  created_at: number;
}

export interface GetDecryptRequestResponse {
  request_id: string;
  turbo_da_app_id: string;
  status: string;
  signers: string[];
  created_at: number;
}

export interface SubmitSignatureResponse {
  request_id: string;
  status: string;
  signatures_submitted: number;
  threshold: number;
  ready_to_decrypt: boolean;
  tee_attestation?: string;
}

export interface DecryptionRequestListItem {
  id: string;
  turbo_da_app_id: string;
  submitted_signatures: string;
  status: string;
  created_at: number;
  completed_at: number | null;
  threshold: number;
}

export interface ListDecryptRequestsResponse {
  items: DecryptionRequestListItem[];
  total: number;
  offset: number;
  limit: number;
}
