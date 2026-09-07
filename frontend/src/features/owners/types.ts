/**
 * TypeScript types for Owners and Collections module
 */

export interface Owner {
  id: number;
  client_id: number;
  person_type: "natural" | "juridica";
  document_type: "DNI" | "RUC" | "CE" | "PASAPORTE" | "OTRO";
  document_number: string;
  first_name?: string;
  paternal_surname?: string;
  maternal_surname?: string;
  business_name?: string;
  secondary_phone?: string;
  address?: string;
  district?: string;
  province?: string;
  department?: string;
  birth_date?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface OwnerWithClient extends Owner {
  client_name: string;
  client_phone: string;
  client_email: string;
  total_properties: number;
  total_debt: number;
  overdue_debt: number;
}

export interface OwnerDetail extends OwnerWithClient {
  total_purchased: number;
  total_paid: number;
  outstanding_balance: number;
  contracts_count: number;
  properties: Array<{
    contract_id: number;
    contract_number: string;
    project_name: string;
    block_code?: string;
    lot_code: string;
    lot_area_m2: number;
    total_price: number;
    payment_modality: "contado" | "financiado";
    status: string;
  }>;
}

export interface Contract {
  id: number;
  contract_number: string;
  owner_id: number;
  project_id: number;
  lot_id: number;
  advisor_id?: number;
  contract_date: string;
  start_date: string;
  lot_area_m2: number;
  price_per_m2: number;
  total_price: number;
  payment_modality: "contado" | "financiado";
  status: "activo" | "cancelado" | "resuelto" | "anulado";
  contract_pdf_url?: string;
  is_imported: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface ContractDetail extends Contract {
  owner_name: string;
  owner_document: string;
  project_name: string;
  block_code?: string;
  lot_code: string;
  advisor_name?: string;
  co_owners: Array<{
    owner_id: number;
    name: string;
    percentage: number;
    role: string;
  }>;
  cash_payment?: CashPayment;
  financing?: FinancingPlanDetail;
  collection_status: "al_dia" | "proximo_vencer" | "vencido" | "cancelado" | "pendiente";
  total_paid: number;
  outstanding_balance: number;
  overdue_amount: number;
}

export interface CashPayment {
  id: number;
  contract_id: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  payment_date?: string;
  status: "pagado" | "pendiente";
  created_at: string;
}

export interface FinancingPlan {
  id: number;
  contract_id: number;
  total_price: number;
  initial_payment: number;
  financed_amount: number;
  number_of_installments: number;
  installment_amount: number;
  frequency: "mensual" | "quincenal" | "semanal" | "personalizada";
  first_installment_date: string;
  last_installment_date: string;
  interest_rate: number;
  total_interest: number;
  outstanding_balance: number;
  created_at: string;
}

export interface FinancingPlanDetail extends FinancingPlan {
  installments_paid: number;
  installments_pending: number;
  installments_overdue: number;
  total_paid: number;
  overdue_amount: number;
  next_due_date?: string;
}

export interface Installment {
  id: number;
  financing_plan_id: number;
  installment_number: number;
  due_date: string;
  payment_date?: string;
  scheduled_amount: number;
  paid_amount: number;
  balance: number;
  status: "pendiente" | "pagada" | "parcial" | "vencida" | "anulada";
  days_overdue: number;
  created_at: string;
}

export interface Payment {
  id: number;
  contract_id: number;
  payer_id: number;
  payment_date: string;
  amount: number;
  payment_method: string;
  transaction_number?: string;
  bank_name?: string;
  receipt_url?: string;
  notes?: string;
  is_cancelled: boolean;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_at: string;
}

export interface PaymentDetail extends Payment {
  payer_name: string;
  contract_number: string;
  allocations: Array<{
    installment_id: number;
    installment_number: number;
    allocated_amount: number;
    due_date: string;
  }>;
}

export interface CollectionDashboard {
  total_portfolio: number;
  total_collected: number;
  total_pending: number;
  total_overdue: number;
  collections_today: number;
  collections_month: number;
  upcoming_7_days: number;
  overdue_contracts: number;
  active_contracts: number;
}

export interface CollectionItem {
  contract_id: number;
  contract_number: string;
  owner_name: string;
  owner_document: string;
  owner_phone: string;
  project_name: string;
  block_code?: string;
  lot_code: string;
  payment_modality: string;
  current_installment?: number;
  next_due_date?: string;
  installment_amount?: number;
  outstanding_balance: number;
  overdue_amount: number;
  days_overdue: number;
  overdue_installments: number;
  collection_status: "al_dia" | "proximo_vencer" | "vencido" | "cancelado";
}

export interface PortfolioByProject {
  project_id: number;
  project_name: string;
  total_contracts: number;
  contracts_current: number;
  contracts_overdue: number;
  contracts_cancelled: number;
  total_portfolio: number;
  total_collected: number;
  total_pending: number;
  overdue_amount: number;
}
