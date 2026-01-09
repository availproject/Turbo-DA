export interface CreditRequest {
  id: string;
  user_id: string;
  chain_id: number;
  amount_credit: string | null;
  amount_paid: string | null;
  request_status:
    | "PENDING"
    | "COMPLETED"
    | "FAILED"
    | "pending"
    | "completed"
    | "failed";
  request_type: "DEPOSIT" | "credit" | "debit";
  tx_hash: string | null;
  token_address: string | null;
  created_at: string;
}

export interface DataTransaction {
  id: string;
  user_id: string;
  extrinsic_index: number;
  amount_data: string;
  fees: string;
  to_address: string;
  block_number: number;
  block_hash: string;
  data_hash: string;
  tx_hash: string;
  created_at: string;
  error: string | null;
  converted_fees: string;
  app_id: string;
}
