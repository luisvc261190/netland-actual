import type { CommissionPaymentStatus } from "../../types";

export const COMMISSION_STATUS_LABELS: Record<CommissionPaymentStatus, string> = {
  pendiente: "PENDIENTE",
  parcial: "PARCIAL",
  pagado: "PAGADO",
  anulado: "ANULADO",
};

export const COMMISSION_STATUS_COLORS: Record<CommissionPaymentStatus, string> = {
  pendiente: "#f59e0b",
  parcial: "#0ea5e9",
  pagado: "#16a34a",
  anulado: "#dc2626",
};

export const COMMISSION_PAYMENT_METHODS = [
  "transferencia",
  "deposito",
  "efectivo",
  "cheque",
  "yape",
  "plin",
  "otro",
] as const;

export const COMMISSION_PAYMENT_METHOD_LABELS: Record<string, string> = {
  transferencia: "Transferencia",
  deposito: "Depósito",
  efectivo: "Efectivo",
  cheque: "Cheque",
  yape: "Yape",
  plin: "Plin",
  otro: "Otro",
};

export const COMMISSION_DOCUMENT_TYPES = ["DNI", "CE", "RUC", "PASAPORTE", "OTRO"] as const;

export const formatMoney = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  return `S/ ${value.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};