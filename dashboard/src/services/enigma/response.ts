export interface AddParticipantResponse {
  turbo_da_app_id: string;
  participants_added: number;
}

export interface DeleteParticipantResponse {
  turbo_da_app_id: string;
  participants_deleted: number;
}

export interface CreateDecryptRequestResponse {
  id: string;
  turbo_da_app_id: string;
  status: string;
  signers: string[];
  created_at: number;
}

export interface GetDecryptRequestResponse {
  id: string;
  turbo_da_app_id: string;
  ciphertext: number[];
  submitted_signatures: string;
  decrypted_data: number[] | null;
  status: string;
  created_at: number;
  completed_at: number | null;
}

export interface SubmitSignatureResponse {
  id: string;
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
