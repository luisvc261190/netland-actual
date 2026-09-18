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
  const date = parseDate(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export const formatDateLong = (dateString: string | undefined | null): string => {
  if (!dateString) return "—";
  const date = parseDate(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("es-PE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Evita el desfase de 1 día al renderizar fechas puras "YYYY-MM-DD":
// new Date("2026-09-17") se interpreta como medianoche UTC y en zonas
// como Perú (UTC-5) se mostraría como 16/09. Se parsea en hora local.
const parseDate = (dateString: string): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [y, m, d] = dateString.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateString);
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

export interface LateInfo {
  days: number;
  interest: number;
}

/**
 * Calcula los días de atraso y el interés por mora (S/ diario fijo) de una cuota
 * entre su fecha de vencimiento y la fecha de referencia (fecha del pago).
 */
export const computeLate = (
  dueDate: string | null | undefined,
  refDate: string,
  dailyRate: number
): LateInfo => {
  if (!dueDate || !dailyRate || dailyRate <= 0) return { days: 0, interest: 0 };
  const due = parseDate(dueDate).getTime();
  const ref = parseDate(refDate).getTime();
  if (Number.isNaN(due) || Number.isNaN(ref)) return { days: 0, interest: 0 };
  const days = Math.max(0, Math.floor((ref - due) / 86400000));
  return { days, interest: Number((days * dailyRate).toFixed(2)) };
};

export interface DueSettledItem {
  installment_id: number;
  installment_number: number;
  due_date: string;
  balance: number;
  days: number;
  interest: number;
}

export interface DueSimulation {
  applied: number;
  mora: number;
  excess: number;
  settled: DueSettledItem[];
  blocked: {
    installment_number: number;
    due_date: string;
    balance: number;
    interest: number;
  } | null;
}

export interface DueSummary {
  applied: number;
  mora: number;
  total: number;
}

export interface DueDialogRow {
  installment_number: number;
  due_date: string;
  days: number;
  interest: number;
}

/**
 * Resumen del cobro a partir de una simulación. Cuando está bloqueada, muestra
 * el valor requerido por la cuota que impide continuar; si no, el total a cobrar
 * (cuotas + mora).
 */
export const dueSummary = (sim: DueSimulation): DueSummary =>
  sim.blocked
    ? {
        applied: sim.applied,
        mora: sim.blocked.interest,
        total: sim.blocked.balance + sim.blocked.interest,
      }
    : { applied: sim.applied, mora: sim.mora, total: sim.applied + sim.mora };

/**
 * Filas del diálogo de confirmación de mora: solo las cuotas con interés, ya que
 * el excedente derivado a cuotas futuras no genera recargo.
 */
export const toDialogRows = (settled: DueSettledItem[]): DueDialogRow[] =>
  settled
    .filter((s) => s.interest > 0)
    .map((s) => ({
      installment_number: s.installment_number,
      due_date: s.due_date,
      days: s.days,
      interest: s.interest,
    }));

/**
 * Actualiza la selección de cuotas bajo la regla "desde la más atrasada hacia
 * adelante": al marcar una cuota se incluyen automáticamente todas las más
 * antiguas; al desmarcarla se excluyen todas las posteriores. De esta forma la
 * selección siempre es un bloque continuo desde la cuota pendiente más antigua.
 */
export const applyPrefixSelection = (
  selected: Set<number>,
  targetId: number,
  pending: Array<{ id: number; due_date: string }>,
  checked: boolean
): Set<number> => {
  const target = pending.find((p) => p.id === targetId);
  if (!target) return selected;
  const next = new Set(selected);
  for (const p of pending) {
    if (checked && p.due_date <= target.due_date) next.add(p.id);
    if (!checked && p.due_date >= target.due_date) next.delete(p.id);
  }
  return next;
};

/**
 * Simula el pago recibido sobre las cuotas pendientes (de la más antigua a la
 * más reciente) replicando lo que el backend registrará.
 *
 * **Fase 1 (bloque a cobrar).** Las cuotas de "settleOnlyIds" (o todas si no se
 * filtra) se liquidan en orden. En mora activa (no exonera) una cuota vencida
 * solo puede liquidarse por completo: debe cubrir cuota + mora. Si el monto
 * recibido no alcanza, ``blocked`` indica la cuota que lo impide. Cuando hay
 * selección explícita, una vencida marcada es obligatoria: se bloquea aunque el
 * dinero se haya agotado antes, para reportar el faltante. Sin
 * ``settleOnlyIds`` la fase liquidará todas las pendientes (equivalente de
 * ``_auto_allocate_payment``) y solo bloquea si el dinero alcanzable no llega.
 *
 * **Fase 2 (excedente).** Si tras la fase 1 sobra dinero, se derrama sobre las
 * siguientes cuotas pendientes en orden, como pago a cuenta del cliente. Si la
 * cuota derivada está vencida se cobra completa (cuota + mora) descontando ambos
 * del excedente; si no alcanza, se aplica a capital y el backend registrará la
 * mora completa de la cuota atendida (comportamiento de ``_distribute_amount`` +
 * ``_compute_late_interest``). De esta forma el excedente siempre abona a la
 * siguiente cuota y ``excess`` solo reporta dinero que sobra cuando ya no queda
 * ninguna cuota pendiente.
 */
export const simulateDuePayment = (opts: {
  received: number;
  dailyRate: number;
  refDate: string;
  pending: Array<{
    id: number;
    installment_number: number;
    due_date: string;
    balance: number;
  }>;
  exonerate: boolean;
  settleOnlyIds?: Set<number>;
}): DueSimulation => {
  const { received, dailyRate, refDate, pending, exonerate, settleOnlyIds } = opts;
  const onlySelected = settleOnlyIds ? settleOnlyIds.size > 0 : false;
  const sorted = [...pending].sort((a, b) => (a.due_date > b.due_date ? 1 : -1));
  const isInBundle = (id: number) => !onlySelected || settleOnlyIds!.has(id);

  let rest = received;
  let blocked: DueSimulation["blocked"] = null;
  const settled: DueSettledItem[] = [];

  // Fase 1: liquidar el bloque elegido (o todo en modo automático)
  for (const cuota of sorted) {
    if (!isInBundle(cuota.id)) continue;

    const late = computeLate(cuota.due_date, refDate, dailyRate);
    const isOverdue = late.days > 0 && !exonerate;

    if (isOverdue) {
      const price = cuota.balance + late.interest;
      if (rest + 0.005 < price) {
        // En selección una vencida marcada es obligatoria: se bloquea aunque el
        // dinero se haya agotado antes (así el cajero ve cuánto falta). En
        // automático solo se bloquea cuando quedaba dinero alcanzable.
        if (onlySelected || rest >= 0.005) {
          blocked = {
            installment_number: cuota.installment_number,
            due_date: cuota.due_date,
            balance: cuota.balance,
            interest: late.interest,
          };
        }
        break;
      }
      settled.push({
        installment_id: cuota.id,
        installment_number: cuota.installment_number,
        due_date: cuota.due_date,
        balance: Number(cuota.balance.toFixed(2)),
        days: late.days,
        interest: late.interest,
      });
      rest -= price;
    } else if (!onlySelected && rest < 0.005) {
      // Automático: sin dinero restante no hay nada más que liquidar.
      break;
    } else {
      const to = Math.min(rest, cuota.balance);
      if (to > 0.004) {
        settled.push({
          installment_id: cuota.id,
          installment_number: cuota.installment_number,
          due_date: cuota.due_date,
          balance: Number(to.toFixed(2)),
          days: 0,
          interest: 0,
        });
        rest -= to;
      }
    }
  }

  // Fase 2: derramar el excedente sobre las cuotas que quedan pendientes
  if (!blocked) {
    for (const cuota of sorted) {
      if (rest < 0.005) break;
      if (isInBundle(cuota.id)) continue;

      const late = computeLate(cuota.due_date, refDate, dailyRate);
      const isOverdue = late.days > 0 && !exonerate;

      if (isOverdue) {
        // Una vencida cubierta con el excedente también debe pagar su mora:
        // el costo se descuenta del excedente (cuota + mora por completo).
        const price = cuota.balance + late.interest;
        if (rest + 0.005 < price) {
          // No alcanza a cubrirla completa: aplico parcial a capital. El
          // backend registrará igual la mora completa de la cuota atendida
          // (mismo criterio que _distribute_amount + _compute_late_interest).
          const to = Number(rest.toFixed(2));
          if (to > 0.004) {
            settled.push({
              installment_id: cuota.id,
              installment_number: cuota.installment_number,
              due_date: cuota.due_date,
              balance: to,
              days: late.days,
              interest: late.interest,
            });
            rest -= to;
          }
          break;
        }
        settled.push({
          installment_id: cuota.id,
          installment_number: cuota.installment_number,
          due_date: cuota.due_date,
          balance: Number(cuota.balance.toFixed(2)),
          days: late.days,
          interest: late.interest,
        });
        rest -= price;
      } else {
        const to = Math.min(rest, cuota.balance);
        if (to <= 0.004) continue;
        settled.push({
          installment_id: cuota.id,
          installment_number: cuota.installment_number,
          due_date: cuota.due_date,
          balance: Number(to.toFixed(2)),
          days: 0,
          interest: 0,
        });
        rest -= to;
      }
    }
  }

  const applied = Number(settled.reduce((s, x) => s + x.balance, 0).toFixed(2));
  const mora = Number(settled.reduce((s, x) => s + x.interest, 0).toFixed(2));
  const excess = Number(Math.max(0, received - applied - mora).toFixed(2));

  return { applied, mora, excess, settled, blocked };
};
