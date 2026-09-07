/**
 * Constants for Owners and Collections module
 */

export const PERSON_TYPES = {
  natural: "Persona Natural",
  juridica: "Persona Jurídica",
} as const;

export const DOCUMENT_TYPES = {
  DNI: "DNI",
  RUC: "RUC",
  CE: "Carnet de Extranjería",
  PASAPORTE: "Pasaporte",
  OTRO: "Otro",
} as const;

export const PAYMENT_MODALITIES = {
  contado: "Al Contado",
  financiado: "Financiado",
} as const;

export const CONTRACT_STATUS = {
  activo: "Activo",
  cancelado: "Cancelado",
  resuelto: "Resuelto",
  anulado: "Anulado",
} as const;

export const CONTRACT_STATUS_COLORS = {
  activo: "#16a34a",
  cancelado: "#0d7a44",
  resuelto: "#dc2626",
  anulado: "#9ca3af",
} as const;

export const COLLECTION_STATUS = {
  al_dia: "Al Día",
  proximo_vencer: "Próximo a Vencer",
  vencido: "Vencido",
  cancelado: "Cancelado",
  pendiente: "Pendiente",
} as const;

export const COLLECTION_STATUS_COLORS = {
  al_dia: "#16a34a",
  proximo_vencer: "#f59e0b",
  vencido: "#dc2626",
  cancelado: "#0d7a44",
  pendiente: "#64748b",
} as const;

export const INSTALLMENT_STATUS = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  parcial: "Pago Parcial",
  vencida: "Vencida",
  anulada: "Anulada",
} as const;

export const INSTALLMENT_STATUS_COLORS = {
  pendiente: "#f59e0b",
  pagada: "#16a34a",
  parcial: "#3b82f6",
  vencida: "#dc2626",
  anulada: "#9ca3af",
} as const;

export const PAYMENT_METHODS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  deposito: "Depósito",
  cheque: "Cheque",
  tarjeta: "Tarjeta",
  yape: "Yape",
  plin: "Plin",
  otro: "Otro",
} as const;

export const FREQUENCY_TYPES = {
  mensual: "Mensual",
  quincenal: "Quincenal",
  semanal: "Semanal",
  personalizada: "Personalizada",
} as const;

export const OWNERSHIP_ROLES = {
  titular: "Titular",
  cotitular: "Cotitular",
  copropietario: "Copropietario",
} as const;

export const formatSoles = (amount: number | string | undefined | null): string => {
  if (amount === undefined || amount === null) return "S/ 0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "S/ 0.00";
  return `S/ ${num.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export const formatDateLong = (dateString: string | undefined | null): string => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-PE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const getOwnerFullName = (owner: {
  person_type: string;
  first_name?: string;
  paternal_surname?: string;
  maternal_surname?: string;
  business_name?: string;
}): string => {
  if (owner.person_type === "juridica") {
    return owner.business_name || "Sin nombre";
  }
  const parts = [owner.first_name, owner.paternal_surname, owner.maternal_surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Sin nombre";
};

export const getDaysOverdueLabel = (days: number): string => {
  if (days === 0) return "Al día";
  if (days === 1) return "1 día";
  return `${days} días`;
};
