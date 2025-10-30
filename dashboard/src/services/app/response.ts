interface CreditLog {
  updated_at: string;
  value: boolean;
}

export interface AppDetails {
  app_description: string | null;
  app_id: number;
  app_logo: string;
  app_name: string;
  assigned_credits_logs: any | null;
  created_at: string;
  credit_balance: string;
  credit_selection: number;
  credit_used: string;
  fallback_credit_used: string;
  id: string;
  user_id: string;
  encryption: boolean;
}
