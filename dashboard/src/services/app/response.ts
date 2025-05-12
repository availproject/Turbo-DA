export interface AppDetails {
  id: string;
  user_id: string;
  app_id: number;
  app_name: string;
  app_description: string | null;
  app_logo: string;
  created_at: string;
  credit_balance: string;
  credit_used: string;
  fallback_enabled: boolean;
  allback_updated_at: { updated_at: string; value: boolean }[];
}
