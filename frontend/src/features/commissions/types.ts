import type { CommissionPaymentType } from "../../types";

export interface PaymentFormPayload {
  payment_type: CommissionPaymentType;
  advisor_id?: number | null;
  project_id?: number | null;
  contract_id?: number | null;
  base_amount?: number | null;
  percent_applied?: number | null;
  amount?: number | null;
  concept?: string;
  payment_period?: string | null;
  notes?: string;
}

export interface PayPayload {
  amount?: number;
  payment_date?: string;
  payment_method?: string;
  transaction_number?: string;
  notes?: string;
}