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

// Change Signers Types

export interface CreateChangeSignersRequest {
  turbo_da_app_id: string;
  new_participants: string[];
  new_threshold: number;
}

export interface CreateChangeSignersResponse {
  success: boolean;
}

export interface ListChangeSignersQuery {
  turbo_da_app_id: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ChangeSignersRequest {
  id: string;
  turbo_da_app_id: string;
  new_participants: string[];
  new_threshold: number;
  status: string;
  created_at: number;
  updated_at: number;
  completed_at?: number;
}

export interface ListChangeSignersResponse {
  items: ChangeSignersRequest[];
  total: number;
  offset: number;
  limit: number;
}

export interface SubmitChangeSignersSignatureRequest {
  request_id: string;
  participant_address: string;
  signature: string;
}

export interface SubmitChangeSignersSignatureResponse {
  id: string;
  status: string;
  signatures_submitted: number;
  threshold: number;
  ready_to_execute: boolean;
  tee_attestation?: any;
}

export interface CurrentSignersResponse {
  participants: string[];
  threshold: number;
}
