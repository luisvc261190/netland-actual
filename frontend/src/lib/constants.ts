const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "");

export const API_URL = configuredApiUrl
  ? `${configuredApiUrl.replace(/\/api$/, "")}/api`
  : "http://localhost:8000/api";

export const WHATSAPP_NUMBER: string =
  (import.meta.env.VITE_WHATSAPP_NUMBER as string) || "51985928062";

export const whatsappLink = (
  message = "Hola Luis, estoy interesado en conocer los lotes disponibles de Netland.",
  to?: string
) => {
  const number = (to?.replace(/\D/g, "") || WHATSAPP_NUMBER);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
};

export const formatSoles = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  return `S/ ${value.toLocaleString("es-PE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};

export const formatArea = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value} m²`;

export const LOT_STATUS_LABELS: Record<string, string> = {
  available: "DISPONIBLE",
  reserved: "RESERVADO",
  sold: "VENDIDO",
  not_available: "NO DISPONIBLE",
};

export const LOT_STATUS_COLORS: Record<string, string> = {
  available: "#16a34a",
  reserved: "#eab308",
  sold: "#dc2626",
  not_available: "#9ca3af",
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "NUEVO",
  contacted: "CONTACTADO",
  interested: "INTERESADO",
  visit_scheduled: "VISITA PROGRAMADA",
  negotiation: "NEGOCIACIÓN",
  reserved: "RESERVADO",
  sold: "VENDIDO",
  discarded: "DESCARTADO",
};

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "interested",
  "visit_scheduled",
  "negotiation",
  "reserved",
  "sold",
  "discarded",
];

export const lotWhatsappMessage = (
  projectName: string,
  lotCode: string,
  price?: number | null
) =>
  `Hola Luis, estoy interesado en el lote ${lotCode} de ${projectName}${
    price ? ` con precio de S/ ${price.toLocaleString("es-PE")}` : ""
  }.`;

export const CAPTURED_SOURCES = ["campo", "llamada", "referido", "whatsapp"] as const;

export const CAPTURED_SOURCE_LABELS: Record<string, string> = {
  campo: "EN CAMPO",
  llamada: "LLAMADA",
  referido: "REFERIDO",
  whatsapp: "WHATSAPP",
};

export const CAPTURED_SOURCE_COLORS: Record<string, string> = {
  campo: "#0d9488",
  llamada: "#4f46e5",
  referido: "#db2777",
  whatsapp: "#16a34a",
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Administrador",
  ADMIN: "Administrador",
  ASESOR: "Asesor",
  VENTAS: "Ventas",
  COBRANZAS: "Cobranzas",
  SUPERVISOR: "Supervisor",
};

export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "#f5a623",
  ADMIN: "#0d7a44",
  ASESOR: "#1e40af",
  VENTAS: "#0891b2",
  COBRANZAS: "#db2777",
  SUPERVISOR: "#4f46e5",
};

export const SUPER_ADMIN_ROLES = ["SUPER_ADMIN"];
export const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"];
export const SALES_ROLES = ["SUPER_ADMIN", "ADMIN", "VENTAS", "SUPERVISOR"];
export const COLLECTIONS_ROLES = ["SUPER_ADMIN", "ADMIN", "COBRANZAS", "SUPERVISOR"];
export const OWNERS_ROLES = ["SUPER_ADMIN", "ADMIN", "VENTAS", "COBRANZAS", "SUPERVISOR"];