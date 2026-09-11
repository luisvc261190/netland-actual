export type LotStatus = "available" | "reserved" | "sold" | "not_available";

export interface Project {
  id: number;
  slug: string;
  name: string;
  short_name: string;
  project_type: string;
  tagline: string;
  description: string;
  long_description: string;
  features: string;
  location: string;
  reference: string;
  map_link: string;
  latitude: number | null;
  longitude: number | null;
  color_primary: string;
  color_secondary: string;
  hero_image: string;
  hero_video: string;
  logo_url: string;
  plan_pdf_url: string;
  status: string;
  is_published: boolean;
  legal_info: string;
  seo_title: string;
  seo_description: string;
  og_image: string;
  blocks_count: number;
  lots_count: number;
  available_count: number;
}

export interface Block {
  id: number;
  project_id: number;
  code: string;
  name: string;
  sort_order: number;
  lots_count: number;
}

export interface Lot {
  id: number;
  project_id: number;
  block_id: number | null;
  block_code: string | null;
  code: string;
  lot_number: number | null;
  area_m2: number | null;
  price_per_m2: number | null;
  price: number | null;
  promo_price: number | null;
  status: LotStatus;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  notes: string | null;
  zone: string | null;
  location_bonus: string | null;
  location_bonus_amount: number | null;
  normal_price_usd: number | null;
  normal_price_soles: number | null;
  contract_pdf_url?: string | null;
}

export interface GalleryItem {
  id: number;
  url: string;
  caption: string;
  category: string;
  sort_order: number;
  is_cover: boolean;
}

export interface ProjectVideo {
  id: number;
  url: string;
  title: string;
  description?: string;
  video_type: string;
}

export interface ProjectDocument {
  id: number;
  name: string;
  category: string;
  url: string;
  description: string;
}

export interface Announcement {
  id: number;
  title: string;
  description: string;
  kind: "announcement" | "promotion";
  media_type: "image" | "video";
  image_url: string;
  button_phone: string;
  is_active: boolean;
  once_per_session: boolean;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface Advisor {
  id: number;
  name: string;
  role_title: string;
  photo_url: string;
  phone: string;
  whatsapp: string;
  email: string | null;
  project_ids: string;
  is_available: boolean;
  bio: string;
  sort_order: number;
}

export interface ClientInfo {
  id: number;
  name: string;
  last_name: string;
  phone: string;
  whatsapp: string;
  email: string | null;
  notes: string;
}

export interface Lead {
  id: number;
  client: ClientInfo | null;
  project_id: number | null;
  project_name: string | null;
  lot_id: number | null;
  lot_code: string | null;
  advisor_id: number | null;
  advisor_name: string | null;
  status: string;
  budget: number | null;
  source: string;
  message: string;
  follow_up: string;
  created_at: string | null;
}

export interface Visit {
  id: number;
  lead_id: number;
  advisor_id: number | null;
  project_id: number | null;
  scheduled_at: string | null;
  status: string;
  notes: string;
  lead_name: string | null;
  project_name: string | null;
  advisor_name: string | null;
}

export interface Quote {
  id: number;
  quote_number: string;
  lead_id: number | null;
  advisor_id: number | null;
  project_id: number | null;
  lot_id: number | null;
  lot_price: number | null;
  price_per_m2: number | null;
  esquina_surcharge: number | null;
  frente_parque_surcharge: number | null;
  frente_a_pista_surcharge: number | null;
  discount_type: string | null;
  discount_value: number | null;
  payment_type: string | null;
  initial_payment: number | null;
  installments: number | null;
  installment_value: number | null;
  total_amount: number | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  notes: string | null;
  status: string;
  pdf_url: string;
  project_name: string | null;
  lot_code: string | null;
  lot_area: number | null;
  advisor_name: string | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  advisor_id?: number | null;
  advisor_name?: string | null;
}

export interface Backup {
  id: number;
  filename: string;
  size_bytes: number;
  tables_count: number;
  total_rows: number;
  status: string;
  created_at: string;
  created_by?: string | null;
}

export interface DashboardStats {
  projects_total: number;
  projects_published: number;
  lots_total: number;
  lots_available: number;
  lots_reserved: number;
  lots_sold: number;
  lots_not_available: number;
  leads_total: number;
  leads_new: number;
  leads_visit_scheduled: number;
  leads_by_status: { status: string; count: number }[];
  lots_by_status: { status: string; count: number }[];
  visits_total: number;
  advisors_total: number;
  quotes_total: number;
  leads_by_project: { project: string; count: number }[];
  owners_total: number;
  contracts_total: number;
  contracts_active: number;
  pending_balance: number;
  overdue_debt: number;
}

export interface QuoteInput {
  lead_id?: number | null;
  project_id: number;
  lot_id: number;
  lot_price: number | null;
  price_per_m2: number | null;
  esquina_surcharge: number;
  frente_parque_surcharge: number;
  frente_a_pista_surcharge: number;
  discount_type: string;
  discount_value: number;
  payment_type: string;
  initial_payment: number;
  installments: number;
  client_name: string;
  client_phone: string;
  client_email: string;
  notes: string;
}

export interface LeadInput {
  name: string;
  last_name: string;
  phone: string;
  whatsapp: string;
  email: string | null;
  project_id: number | null;
  lot_id: number | null;
  budget: number | null;
  source?: string;
  message: string;
}