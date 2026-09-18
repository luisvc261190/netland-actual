import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  Plus,
  CalendarDays,
  CreditCard,
  XCircle,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  FileDown,
  FilePlus2,
  Receipt,
} from "lucide-react";
import { api, authStorage } from "../../../lib/api";
import { API_URL } from "../../../lib/constants";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Table,
  Field,
  Select,
  Input,
  StatCard,
} from "../../admin/ui";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LateInterestConfirmDialog } from "../components/LateInterestConfirmDialog";
import type {
  ContractDetail,
  FinancingPlanDetail,
  Installment,
  Payment,
} from "../types";
import {
  CONTRACT_STATUS,
  CONTRACT_STATUS_COLORS,
  PAYMENT_MODALITIES,
  INSTALLMENT_STATUS,
  INSTALLMENT_STATUS_COLORS,
  PAYMENT_METHODS,
  COLLECTION_STATUS,
  COLLECTION_STATUS_COLORS,
  formatSoles,
  formatDate,
  computeLate,
  simulateDuePayment,
  applyPrefixSelection,
  dueSummary,
  toDialogRows,
} from "../constants";

interface AllocRow {
  installment_id: number;
  installment_number: number;
  due_date: string;
  balance: number;
  amount: string;
  checked: boolean;
}

interface ContractDocument {
  id: number;
  contract_id: number;
  document_name: string;
  document_type: string;
  description?: string | null;
  file_url?: string | null;
  file_size?: number | null;
  uploaded_at: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  proforma: "Proforma",
  boleta: "Boleta",
  factura: "Factura",
};

async function downloadPdf(path: string) {
  const token = authStorage.getToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || "Error al descargar el documento");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match?.[1] || "documento.pdf";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const contractId = Number(id);
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split("T")[0],
    amount: "",
    payment_method: "efectivo",
    transaction_number: "",
    bank_name: "",
    notes: "",
  });
  const [allocations, setAllocations] = useState<AllocRow[]>([]);
  const [exonerateInterest, setExonerateInterest] = useState(false);
  const [moraConfirmOpen, setMoraConfirmOpen] = useState(false);
  const moraAccepted = useRef(false);
  const [emitOpen, setEmitOpen] = useState(false);
  const [emitForm, setEmitForm] = useState({ document_type: "proforma", description: "" });
  const [refinanceOpen, setRefinanceOpen] = useState(false);
  const [refinanceForm, setRefinanceForm] = useState({
    start_date: new Date().toISOString().split("T")[0],
    number_of_installments: "",
  });
  const [pdfLoading, setPdfLoading] = useState(false);
  const [schedulePdfLoading, setSchedulePdfLoading] = useState(false);

  // Detalle del contrato
  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: ({ signal }) => api.get<ContractDetail>(`/contracts/${contractId}`, true, signal),
    enabled: !!contractId,
  });

  const { data: documents } = useQuery({
    queryKey: ["contract-documents", contractId],
    queryFn: ({ signal }) => api.get<ContractDocument[]>(`/contracts/${contractId}/documents`, true, signal),
    enabled: !!contractId,
  });

  const { data: financing } = useQuery({
    queryKey: ["contract-financing", contractId],
    queryFn: ({ signal }) =>
      api.get<FinancingPlanDetail>(`/contracts/${contractId}/financing`, true, signal),
    enabled: !!contractId && contract?.payment_modality === "financiado",
  });

  const { data: schedule } = useQuery({
    queryKey: ["contract-schedule", contractId],
    queryFn: ({ signal }) =>
      api.get<Installment[]>(`/contracts/${contractId}/schedule`, true, signal),
    enabled: !!contractId && contract?.payment_modality === "financiado",
  });

  const { data: payments } = useQuery({
    queryKey: ["contract-payments", contractId],
    queryFn: ({ signal }) =>
      api.get<Array<Payment & { created_at: string }>>(
        `/payments/history/${contractId}`,
        true,
        signal
      ),
    enabled: !!contractId,
  });

  const { data: lateConfig } = useQuery({
    queryKey: ["late-interest-config"],
    queryFn: ({ signal }) =>
      api.get<{ daily_rate: number; enabled: boolean }>(
        `/payments/late-interest-config`,
        true,
        signal
      ),
  });

  // Registrar pago
  const savePayment = useMutation({
    mutationFn: (payload: any) => api.post("/payments", payload, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract"] });
      queryClient.invalidateQueries({ queryKey: ["contract-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["contract-payments"] });
      queryClient.invalidateQueries({ queryKey: ["contract-financing"] });
      queryClient.invalidateQueries({ queryKey: ["collections-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["collections-items"] });
      toast("Pago registrado correctamente");
      setPaymentOpen(false);
      resetPaymentForm();
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  // Generar cronograma
  const generateSchedule = useMutation({
    mutationFn: () =>
      api.post(`/contracts/${contractId}/generate-schedule`, {}, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-schedule"] });
      toast("Cronograma generado correctamente");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  // Refinanciar cronograma (solo a solicitud explícita del cliente)
  const refinanceContract = useMutation({
    mutationFn: (payload: { start_date: string; number_of_installments: number }) =>
      api.post(`/contracts/${contractId}/refinance`, payload, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract"] });
      queryClient.invalidateQueries({ queryKey: ["contract-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["contract-financing"] });
      queryClient.invalidateQueries({ queryKey: ["collections-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["collections-items"] });
      toast("Cronograma refinanciado correctamente");
      setRefinanceOpen(false);
      setRefinanceForm({
        start_date: new Date().toISOString().split("T")[0],
        number_of_installments: "",
      });
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const submitRefinance = async () => {
    const num = parseInt(refinanceForm.number_of_installments, 10);
    if (!refinanceForm.start_date) {
      toast("Indica la fecha de inicio del nuevo cronograma", "error");
      return;
    }
    if (!num || num <= 0) {
      toast("Indica el número de cuotas del nuevo cronograma", "error");
      return;
    }
    const confirmed = await confirm({
      title: "Refinanciar cronograma",
      message:
        `Se redistribuirá el saldo pendiente (${formatSoles(totalBalance)}) en ${num} cuotas ` +
        `desde el ${refinanceForm.start_date}. Las cuotas pagadas se mantienen.\n\n` +
        "Esta acción solo se realiza a solicitud explícita del cliente y no se puede deshacer. ¿Continuar?",
      confirmText: "Sí, refinanciar",
      cancelText: "Cancelar",
      danger: true,
    });
    if (!confirmed) return;
    refinanceContract.mutate({
      start_date: refinanceForm.start_date,
      number_of_installments: num,
    });
  };

  // Anular contrato
  const cancelContract = useMutation({
    mutationFn: () => api.del(`/contracts/${contractId}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract"] });
      toast("Contrato anulado y lote liberado");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  // Emitir documento comercial
  const emitDocument = useMutation({
    mutationFn: async (payload: { document_type: string; description?: string }) => {
      const token = authStorage.getToken();
      const response = await fetch(`${API_URL}/contracts/${contractId}/emit-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Error al emitir el documento");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] || "documento.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-documents"] });
      toast("Documento emitido correctamente");
      setEmitOpen(false);
      setEmitForm({ document_type: "proforma", description: "" });
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const downloadContractPdf = async () => {
    setPdfLoading(true);
    try {
      // Si el lote ya tiene una URL almacenada, se abre directamente sin regenerar el PDF
      const pdfUrl = contract?.lot_pdf_url || contract?.contract_pdf_url;
      if (pdfUrl) {
        window.open(pdfUrl, "_blank");
        return;
      }
      await downloadPdf(`/contracts/${contractId}/pdf`);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Error al descargar el contrato", "error");
    } finally {
      setPdfLoading(false);
    }
  };

  const downloadSchedulePdf = async () => {
    setSchedulePdfLoading(true);
    try {
      await downloadPdf(`/contracts/${contractId}/schedule-pdf`);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Error al descargar el cronograma", "error");
    } finally {
      setSchedulePdfLoading(false);
    }
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      payment_date: new Date().toISOString().split("T")[0],
      amount: "",
      payment_method: "efectivo",
      transaction_number: "",
      bank_name: "",
      notes: "",
    });
    setAllocations([]);
    setExonerateInterest(false);
    moraAccepted.current = false;
  };

  const openPaymentModal = () => {
    // Pre-cargar cuotas pendientes para distribución manual
    const pending = (schedule || []).filter((i) =>
      ["pendiente", "parcial", "vencida"].includes(i.status)
    );
    setAllocations(
      pending.map((i) => ({
        installment_id: i.id,
        installment_number: i.installment_number,
        due_date: i.due_date,
        balance: i.balance,
        amount: i.balance.toString(),
        checked: false,
      }))
    );
    moraAccepted.current = false;
    setPaymentOpen(true);
  };

  // En modo mora la selección respeta "desde la más atrasada hacia adelante":
  // la selección siempre es un bloque continuo desde la cuota más antigua.
  // Fuera de modo mora el toggle es libre (distribución manual).
  const toggleAllocation = (targetId: number) => {
    setAllocations((prev) => {
      const target = prev.find((a) => a.installment_id === targetId);
      if (!target) return prev;
      const nextChecked = !target.checked;
      if (!moraMode) {
        return prev.map((a) =>
          a.installment_id === targetId ? { ...a, checked: nextChecked } : a
        );
      }
      const selectedIds = applyPrefixSelection(
        new Set(prev.filter((a) => a.checked).map((a) => a.installment_id)),
        targetId,
        prev.map((a) => ({ id: a.installment_id, due_date: a.due_date })),
        nextChecked
      );
      return prev.map((a) => ({ ...a, checked: selectedIds.has(a.installment_id) }));
    });
  };

  const submitPayment = async () => {
    if (!contract) return;
    const received = parseFloat(paymentForm.amount);
    if (!received || received <= 0) {
      toast("El monto recibido debe ser mayor a 0", "error");
      return;
    }

    let finalAmount = received;
    let allocPayload: Array<{ installment_id: number; amount: number }> | null = null;
    const warnings: string[] = [];

    if (moraMode) {
      // Liquidación obligatoria de cuota + mora (de la cuota más antigua).
      // No se permite un pago parcial de una cuota vencida sin su recargo.
      if (dueSimulation?.blocked) {
        const b = dueSimulation.blocked;
        const required = b.balance + b.interest;
        toast(
          `Cobro de mora obligatorio: la cuota ${String(b.installment_number).padStart(
            2,
            "0"
          )} vencida exige pagar cuota ${formatSoles(b.balance)} + mora ${formatSoles(
            b.interest
          )} = ${formatSoles(required)}. Monto recibido: ${formatSoles(received)}.`,
          "error"
        );
        return;
      }

      // Confirmación explícita del recargo de mora antes de registrar.
      if (!moraAccepted.current && dueSimulation && dueSimulation.mora > 0) {
        setMoraConfirmOpen(true);
        return;
      }

      if (!dueSimulation) return;
      finalAmount = dueSimulation.applied;
      allocPayload = dueSimulation.settled.map((s) => ({
        installment_id: s.installment_id,
        amount: s.balance,
      }));

      // Pago en exceso: ya no quedan cuotas pendientes a las que aplicarlo.
      if (dueSimulation.excess > 0.005) {
        warnings.push(
          `Pago en exceso:\n· Sobran ${formatSoles(
            dueSimulation.excess
          )} sobre el total de cuotas + mora. No hay más cuotas pendientes; el excedente queda como saldo a favor del cliente.`
        );
      }
    } else {
      const checkedAllocs = allocations.filter((a) => a.checked);

      if (checkedAllocs.length > 0) {
        const effectiveAmount = (a: AllocRow) =>
          Math.min(parseFloat(a.amount) || 0, received);

        allocPayload = checkedAllocs.map((a) => ({
          installment_id: a.installment_id,
          amount: effectiveAmount(a),
        }));
        const totalAllocated = allocPayload.reduce((sum, a) => sum + a.amount, 0);

        if (totalAllocated > received) {
          toast("La suma de las cuotas supera el monto del pago", "error");
          return;
        }
        if (totalAllocated <= 0) {
          toast("Ingresa un monto válido para al menos una cuota", "error");
          return;
        }

        // Pago parcial: una cuota marcada no se cubre por completo
        const partials = checkedAllocs.filter((a) => {
          const amount = effectiveAmount(a);
          return amount > 0 && amount < a.balance;
        });
        if (partials.length > 0) {
          warnings.push(
            "Pago parcial:\n" +
              partials
                .map(
                  (a) =>
                    `· Cuota ${a.installment_number}: falta ${formatSoles(a.balance - effectiveAmount(a))} para completarla`
                )
                .join("\n")
          );
        }

        // Pago en exceso: cuotas marcadas que reciben más que su saldo
        const excesses = checkedAllocs.filter((a) => {
          const amount = effectiveAmount(a);
          return amount > a.balance;
        });
        if (excesses.length > 0) {
          warnings.push(
            "Pago en exceso:\n" +
              excesses
                .map(
                  (a) =>
                    `· Cuota ${a.installment_number}: sobra ${formatSoles(effectiveAmount(a) - a.balance)}`
                )
                .join("\n") +
              "\nEl excedente se aplicará automáticamente a la siguiente cuota pendiente."
          );
        }

        // Pago en exceso: el monto total supera lo asignado a las cuotas marcadas
        const surplus = received - totalAllocated;
        if (surplus > 0) {
          warnings.push(
            `Pago en exceso:\n· Sobran ${formatSoles(surplus)} sobre las cuotas marcadas` +
              "\nEl excedente se aplicará automáticamente a la siguiente cuota pendiente."
          );
        }
      } else {
        // Distribución automática: analizar contra la cuota pendiente más antigua
        const oldestPending = (schedule || []).find((i) =>
          ["pendiente", "parcial", "vencida"].includes(i.status)
        );
        if (oldestPending) {
          if (received > 0 && received < oldestPending.balance) {
            warnings.push(
              `Pago parcial:\n· Cuota ${oldestPending.installment_number}: falta ${formatSoles(oldestPending.balance - received)} para completarla`
            );
          }
          if (received > oldestPending.balance) {
            warnings.push(
              `Pago en exceso:\n· Cuota ${oldestPending.installment_number}: sobra ${formatSoles(received - oldestPending.balance)}` +
                "\nEl excedente se aplicará automáticamente a la siguiente cuota pendiente."
            );
          }
        }
      }
    }

    // Popup de confirmación cuando el pago es parcial o en exceso
    if (warnings.length > 0) {
      const confirmed = await confirm({
        title: "Confirmar distribución del pago",
        message: warnings.join("\n\n") + "\n\n¿Deseas registrar el pago de todas formas?",
        confirmText: "Sí, registrar pago",
        cancelText: "Cancelar",
        danger: false,
      });
      if (!confirmed) return;
    }

    const payload = {
      contract_id: contract.id,
      payer_id: contract.owner_id,
      payment_date: paymentForm.payment_date,
      amount: finalAmount,
      payment_method: paymentForm.payment_method,
      transaction_number: paymentForm.transaction_number || null,
      bank_name: paymentForm.bank_name || null,
      notes: paymentForm.notes || null,
      allocations: allocPayload,
      exonerate_late_interest: exonerateInterest,
    };

    savePayment.mutate(payload);
  };

  const handleMoraConfirm = () => {
    setMoraConfirmOpen(false);
    moraAccepted.current = true;
    submitPayment();
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Detalle del contrato" subtitle="Cargando..." />
        <Card>
          <div className="py-12">
            <CoreSpinLoader />
          </div>
        </Card>
      </div>
    );
  }

  if (!contract) {
    return (
      <Card>
        <EmptyState
          title="Contrato no encontrado"
          description="El contrato solicitado no existe."
        />
      </Card>
    );
  }

  const installments = schedule || [];
  const totalInstallments =
    financing?.number_of_installments ?? installments.length;
  const paidCount = installments.filter((i) => i.status === "pagada").length;
  const pendingCount = installments.filter((i) =>
    ["pendiente", "parcial"].includes(i.status)
  ).length;
  const overdueCount = installments.filter((i) => i.status === "vencida").length;

  // Vista de amortización: el saldo de cada cuota es el capital pendiente
  // del monto financiado total, que disminuye con cada amortización.
  const financedAmount =
    financing?.financed_amount ??
    installments.reduce((sum, i) => sum + i.scheduled_amount, 0);
  const totalScheduled = installments.reduce((sum, i) => sum + i.scheduled_amount, 0);
  const totalPaidSchedule = installments.reduce((sum, i) => sum + i.paid_amount, 0);
  const totalBalance = installments.reduce((sum, i) => sum + i.balance, 0);

  // Vista previa del refinanciamiento: replica el cálculo del backend
  // (saldo / cuotas con redondeo a 2 decimales, la última cuota absorbe
  // la diferencia).
  const refinanceNum = parseInt(refinanceForm.number_of_installments, 10);
  const refinancePreview =
    refinanceNum > 0 && totalBalance > 0
      ? (() => {
          const per = Math.round((totalBalance / refinanceNum) * 100) / 100;
          const last =
            refinanceNum > 1
              ? Math.round((totalBalance - per * (refinanceNum - 1)) * 100) / 100
              : per;
          return { per, last: last >= 0.01 ? last : per };
        })()
      : null;

  // Interés por mora (S/ diario configurable): vista previa para el modal de pago
  const dailyRate =
    lateConfig?.enabled && lateConfig.daily_rate > 0 ? lateConfig.daily_rate : 0;
  const refDate = paymentForm.payment_date || new Date().toISOString().split("T")[0];
  const todayRef = new Date().toISOString().split("T")[0];

  const lateOf = (due: string | null | undefined) => computeLate(due, refDate, dailyRate);

  // Cuotas pendientes con atraso (días y mora respecto a una fecha de referencia).
  const buildOverdue = (rows: Installment[] | undefined, ref: string) =>
    (rows || [])
      .filter((i) => ["pendiente", "parcial", "vencida"].includes(i.status))
      .map((i) => {
        const late = computeLate(i.due_date, ref, dailyRate);
        return { installment: i, days: late.days, interest: late.interest };
      })
      .filter((r) => r.days > 0)
      .sort((a, b) => (a.installment.due_date > b.installment.due_date ? 1 : -1));

  // Respecto a la fecha del pago (modal de registro de pago).
  const overdueRows = buildOverdue(schedule, refDate);
  const overdueInterestTotal = overdueRows.reduce((s, r) => s + r.interest, 0);
  const overdueMaxDays = overdueRows.reduce((s, r) => Math.max(s, r.days), 0);
  const hasLateInterest = overdueRows.length > 0 && dailyRate > 0;

  // Respecto a hoy (vista de la página del contrato).
  const todayOverdueRows = buildOverdue(schedule, todayRef);
  const todayOverdueInterestTotal = todayOverdueRows.reduce((s, r) => s + r.interest, 0);
  const todayOverdueMaxDays = todayOverdueRows.reduce((s, r) => Math.max(s, r.days), 0);
  const todayOverdueByInstallment = new Map(
    todayOverdueRows.map((r) => [r.installment.id, { days: r.days, interest: r.interest }])
  );
  const lateBadge = (instId: number) => {
    const info = todayOverdueByInstallment.get(instId);
    return info
      ? `${info.days} ${info.days === 1 ? "día" : "días"} · ${formatSoles(info.interest)}`
      : "—";
  };

  // Modo cobro de mora: hay cuotas vencidas y NO se exonera el recargo. En este
  // modo la liquidación es automática (de la cuota más antigua) y obliga a pagar
  // cuota + mora completos: no se permiten pagos parciales de cuotas vencidas.
  const paymentAmountNum = parseFloat(paymentForm.amount) || 0;
  const moraMode =
    contract?.payment_modality === "financiado" && hasLateInterest && !exonerateInterest;

  const pendingCuotas = (schedule || [])
    .filter((i) => ["pendiente", "parcial", "vencida"].includes(i.status))
    .map((i) => ({
      id: i.id,
      installment_number: i.installment_number,
      due_date: i.due_date,
      balance: i.balance,
    }));

  // En modo mora se cobran SOLO las cuotas marcadas (desde la más antigua). Si
  // no se marca ninguna, se mantiene la liquidación automática de todas.
  const settleOnlyIds =
    moraMode && allocations.some((a) => a.checked)
      ? new Set(allocations.filter((a) => a.checked).map((a) => a.installment_id))
      : undefined;

  const dueSimulation = moraMode
    ? simulateDuePayment({
        received: paymentAmountNum,
        dailyRate,
        refDate,
        pending: pendingCuotas,
        exonerate: false,
        settleOnlyIds,
      })
    : null;

  const summary = dueSimulation ? dueSummary(dueSimulation) : null;
  const summaryApplied = summary ? summary.applied : paymentAmountNum;
  const summaryMora = summary ? summary.mora : 0;
  const summaryTotal = summary ? summary.total : paymentAmountNum;
  const dialogRows = dueSimulation ? toDialogRows(dueSimulation.settled) : [];

  // Total que exigen las cuotas marcadas (saldo + mora) para que el cajero sepa
  // cuánto cobrar según su selección.
  const checkedSummary =
    moraMode && allocations.some((a) => a.checked)
      ? allocations.filter((a) => a.checked).reduce(
          (acc, a) => {
            acc.balance += a.balance;
            const late = lateOf(a.due_date);
            acc.mora += late.days > 0 ? late.interest : 0;
            return acc;
          },
          { balance: 0, mora: 0 }
        )
      : null;
  const checkedTotal = checkedSummary ? checkedSummary.balance + checkedSummary.mora : 0;

  // La última cuota absorbe la diferencia por redondeo para que el saldo cierre en 0.
  const roundingDiff = financedAmount - totalScheduled;
  const scheduleRows = installments.reduce<
    Array<Installment & { saldo_capital: number }>
  >((acc, inst, idx) => {
    const isLast = idx === installments.length - 1;
    const amortization = isLast ? inst.scheduled_amount + roundingDiff : inst.scheduled_amount;
    const prevSaldo = idx === 0 ? financedAmount : acc[idx - 1].saldo_capital;
    acc.push({ ...inst, saldo_capital: Math.max(0, prevSaldo - amortization) });
    return acc;
  }, []);

  const nextToPayId = installments.find((i) =>
    ["pendiente", "parcial", "vencida"].includes(i.status)
  )?.id;

  // Filtrar pagos del pago inicial (vouchers subidos al crear contrato)
  const initialPaymentVouchers = (payments || []).filter(
    (p) => p.notes?.includes("Pago inicial - Voucher subido al crear contrato") && !p.is_cancelled
  );
  const totalInitialPaid = initialPaymentVouchers.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <PageHeader
        title={contract.contract_number}
        subtitle={`${contract.project_name} · ${contract.block_code ? `${contract.block_code} - ` : ""}${contract.lot_code}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <Button
              variant="outline"
              onClick={downloadContractPdf}
              disabled={pdfLoading}
              title="Descargar contrato en PDF"
            >
              <FileDown className="h-4 w-4" />
              {pdfLoading ? "Generando..." : "PDF"}
            </Button>
            <Button variant="outline" onClick={() => setEmitOpen(true)}>
              <FilePlus2 className="h-4 w-4" />
              Emitir documento
            </Button>
            {contract.payment_modality === "financiado" &&
              installments.length === 0 && financing && (
                <Button
                  variant="outline"
                  onClick={() => generateSchedule.mutate()}
                  disabled={generateSchedule.isPending}
                >
                  <CalendarDays className="h-4 w-4" />
                  {generateSchedule.isPending ? "Generando..." : "Generar cronograma"}
                </Button>
              )}
            {contract.payment_modality === "financiado" &&
              installments.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setRefinanceOpen(true)}
                  title="Refinanciar cronograma (solo a solicitud del cliente)"
                >
                  <CalendarDays className="h-4 w-4" />
                  Refinanciar
                </Button>
              )}
            <Button onClick={openPaymentModal} disabled={contract.status !== "activo"}>
              <Plus className="h-4 w-4" />
              Registrar Pago
            </Button>
            {contract.status === "activo" && (
              <Button
                variant="danger"
                onClick={async () => {
                  if (
                    await confirm(
                      "¿Anular el contrato? El lote volverá a estar disponible. Esta acción no se puede deshacer."
                    )
                  ) {
                    cancelContract.mutate();
                  }
                }}
              >
                <XCircle className="h-4 w-4" />
                Anular
              </Button>
            )}
          </div>
        }
      />

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          label="Precio de venta"
          value={formatSoles(contract.total_price)}
          icon={<CreditCard className="h-5 w-5" />}
          accent="#0d7a44"
        />
        <StatCard
          label="Total pagado"
          value={formatSoles(contract.total_paid)}
          icon={<CreditCard className="h-5 w-5" />}
          accent="#16a34a"
        />
        <StatCard
          label="Saldo pendiente"
          value={formatSoles(contract.outstanding_balance)}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="#f59e0b"
        />
        <StatCard
          label="Deuda vencida"
          value={formatSoles(contract.overdue_amount)}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="#dc2626"
        />
      </div>

      {/* Información del contrato */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-display text-lg font-semibold text-netland-dark">
            Información del contrato
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoItem label="Propietario" value={contract.owner_name} />
            <InfoItem label="Documento" value={contract.owner_document} />
            <InfoItem label="Proyecto" value={contract.project_name} />
            <InfoItem label="Lote" value={`${contract.block_code ? `${contract.block_code} - ` : ""}${contract.lot_code}`} />
            <InfoItem label="Área" value={`${contract.lot_area_m2} m²`} />
            <InfoItem label="Precio por m²" value={formatSoles(contract.price_per_m2)} />
            <InfoItem
              label="Recargos"
              value={
                <span>
                  {[
                    contract.esquina_surcharge
                      ? `Esquina: +${formatSoles(contract.esquina_surcharge)}`
                      : null,
                    contract.frente_parque_surcharge
                      ? `Frente a parque: +${formatSoles(contract.frente_parque_surcharge)}`
                      : null,
                    contract.frente_a_pista_surcharge
                      ? `Frente a pista: +${formatSoles(contract.frente_a_pista_surcharge)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Sin recargos"}
                </span>
              }
            />
            <InfoItem label="Modalidad" value={PAYMENT_MODALITIES[contract.payment_modality]} />
            <InfoItem label="Fecha de contrato" value={formatDate(contract.contract_date)} />
            <InfoItem label="Estado" value={<Badge color={CONTRACT_STATUS_COLORS[contract.status]}>{CONTRACT_STATUS[contract.status]}</Badge>} />
            <InfoItem label="Estado de cobranza" value={<Badge color={COLLECTION_STATUS_COLORS[contract.collection_status]}>{COLLECTION_STATUS[contract.collection_status].toUpperCase()}</Badge>} />
          </dl>

          {contract.co_owners.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-netland-muted">
                <UserCheck className="h-4 w-4" />
                Copropietarios
              </h3>
              <ul className="space-y-1 text-sm">
                {contract.co_owners.map((co, idx) => (
                  <li key={idx} className="flex items-center justify-between border-b border-netland-light/50 py-1">
                    <span>{co.name}</span>
                    <span className="font-medium text-netland-muted">
                      {co.percentage}% · {co.role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Financiamiento */}
        {contract.payment_modality === "contado" && contract.cash_payment ? (
          <Card>
            <h2 className="mb-4 font-display text-lg font-semibold text-netland-dark">
              Pago al contado
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <InfoItem label="Total" value={formatSoles(contract.cash_payment.total_amount)} />
              <InfoItem label="Pagado" value={formatSoles(contract.cash_payment.amount_paid)} />
              <InfoItem label="Saldo" value={formatSoles(contract.cash_payment.balance)} />
              <InfoItem label="Estado" value={<Badge color={contract.cash_payment.status === "pagado" ? "#16a34a" : "#f59e0b"}>{contract.cash_payment.status.toUpperCase()}</Badge>} />
            </dl>
          </Card>
        ) : (
          <Card>
            <h2 className="mb-4 font-display text-lg font-semibold text-netland-dark">
              Financiamiento
            </h2>
            {financing ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                <InfoItem label="Precio total" value={formatSoles(financing.total_price)} />
                <InfoItem label="Cuota inicial" value={formatSoles(financing.initial_payment)} />
                <InfoItem label="Monto financiado" value={formatSoles(financing.financed_amount)} />
                <InfoItem label="N° cuotas" value={String(financing.number_of_installments)} />
                <InfoItem label="Monto cuota" value={formatSoles(financing.installment_amount)} />
                <InfoItem label="Frecuencia" value={financing.frequency} />
                <InfoItem label="1° vencimiento" value={formatDate(financing.first_installment_date)} />
                <InfoItem label="Último vencimiento" value={formatDate(financing.last_installment_date)} />
                <InfoItem label="Tasa interés" value={`${financing.interest_rate}%`} />
                <InfoItem label="Interés total" value={formatSoles(financing.total_interest)} />
                <InfoItem label="Progreso" value={`${paidCount} / ${financing.number_of_installments} cuotas`} />
                <InfoItem
                  label="Próximo vencimiento"
                  value={formatDate(financing.next_due_date)}
                />
              </dl>
            ) : (
              <p className="text-sm text-netland-muted">
                No se registró un plan de financiamiento para este contrato.
              </p>
            )}
          </Card>
        )}
      </div>

      {/* Pagos del Pago Inicial */}
      {contract.payment_modality === "financiado" && initialPaymentVouchers.length > 0 && (
        <Card className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-netland-primary" />
              <h2 className="font-display text-lg font-semibold text-netland-dark">
                Vouchers del Pago Inicial
              </h2>
            </div>
            <div className="rounded-lg bg-green-50 px-3 py-1.5">
              <span className="text-sm font-semibold text-green-700">
                Total pagado: {formatSoles(totalInitialPaid)}
              </span>
            </div>
          </div>
          
          <p className="mb-4 text-sm text-netland-muted">
            Vouchers subidos durante el registro de la venta como parte del pago inicial de{" "}
            <span className="font-semibold text-netland-primary">
              {formatSoles(financing?.initial_payment || 0)}
            </span>
          </p>

          {initialPaymentVouchers.length === 0 ? (
            <EmptyState
              title="Sin vouchers"
              description="No se subieron vouchers al crear este contrato."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {initialPaymentVouchers.map((voucher) => (
                <div
                  key={voucher.id}
                  className="rounded-lg border border-netland-light bg-white overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Imagen del voucher */}
                  {voucher.receipt_url && (
                    <div className="relative h-48 bg-netland-background/60">
                      <img
                        src={voucher.receipt_url}
                        alt={`Voucher ${formatSoles(voucher.amount)}`}
                        className="h-full w-full object-contain cursor-pointer"
                        onClick={() => window.open(voucher.receipt_url!, "_blank")}
                      />
                    </div>
                  )}
                  
                  {/* Información del voucher */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-netland-muted">Monto</span>
                      <span className="text-lg font-semibold text-netland-primary">
                        {formatSoles(voucher.amount)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-netland-muted">Fecha</span>
                      <span className="font-medium text-netland-dark">
                        {formatDate(voucher.payment_date)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-netland-muted">Método</span>
                      <span className="font-medium text-netland-dark uppercase text-xs">
                        {voucher.payment_method}
                      </span>
                    </div>

                    {voucher.transaction_number && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-netland-muted">Transacción</span>
                        <span className="font-medium text-netland-dark text-xs">
                          {voucher.transaction_number}
                        </span>
                      </div>
                    )}

                    {voucher.bank_name && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-netland-muted">Banco</span>
                        <span className="font-medium text-netland-dark text-xs">
                          {voucher.bank_name}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-netland-light">
                      <Link
                        to={`/admin/pagos/${voucher.id}`}
                        className="text-xs font-medium text-netland-primary hover:underline"
                      >
                        Ver detalle completo →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Cronograma */}
      {contract.payment_modality === "financiado" && (
        <Card className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-netland-dark">
              Cronograma de cuotas
            </h2>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={downloadSchedulePdf}
                disabled={schedulePdfLoading || installments.length === 0}
                title="Descargar cronograma de pagos en PDF"
              >
                <FileDown className="h-4 w-4" />
                {schedulePdfLoading ? "Generando..." : "Cronograma PDF"}
              </Button>
              <div className="flex gap-2 text-xs font-medium">
                <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">{paidCount} pagadas</span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{pendingCount} pendientes</span>
                {overdueCount > 0 && (
                  <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">{overdueCount} vencidas</span>
                )}
              </div>
            </div>
          </div>

          {todayOverdueRows.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                <AlertTriangle className="h-4 w-4" />
                {todayOverdueRows.length}{" "}
                {todayOverdueRows.length === 1 ? "cuota vencida" : "cuotas vencidas"}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-red-700">
                <span>
                  Atraso máximo:{" "}
                  <strong>
                    {todayOverdueMaxDays} {todayOverdueMaxDays === 1 ? "día" : "días"}
                  </strong>
                </span>
                <span>
                  Mora acumulada: <strong>{formatSoles(todayOverdueInterestTotal)}</strong>
                </span>
                <span>
                  Tasa: <strong>{formatSoles(dailyRate)}/día</strong>
                </span>
              </div>
            </div>
          )}

          {installments.length === 0 ? (
            <EmptyState
              title="Sin cronograma"
              description="Genera el cronograma de cuotas para este contrato."
            />
          ) : (
            <>
              <Table
                headers={[
                  "Cuota",
                  "Vencimiento",
                  "Monto programado",
                  "Pagado",
                  "Saldo",
                  "Estado",
                  "Atraso / Mora",
                ]}
              >
              {scheduleRows.map((inst) => (
                <tr
                  key={inst.id}
                  className={`transition-colors hover:bg-netland-light/30 ${
                    inst.id === nextToPayId ? "bg-amber-50/60" : ""
                  }`}
                >
                  <td className="px-5 py-2.5 font-semibold">
                    {String(inst.installment_number).padStart(2, "0")}
                  </td>
                  <td className="px-5 py-2.5 text-sm">{formatDate(inst.due_date)}</td>
                  <td className="px-5 py-2.5">{formatSoles(inst.scheduled_amount)}</td>
                  <td className="px-5 py-2.5">{formatSoles(inst.paid_amount)}</td>
                  <td className="px-5 py-2.5 font-medium">
                    {formatSoles(inst.saldo_capital)}
                  </td>
                  <td className="px-5 py-2.5">
                    <Badge color={INSTALLMENT_STATUS_COLORS[inst.status]}>
                      {INSTALLMENT_STATUS[inst.status]}
                    </Badge>
                  </td>
                  <td className="px-5 py-2.5 text-xs font-medium">
                    <span
                      className={
                        todayOverdueByInstallment.has(inst.id)
                          ? "text-red-600"
                          : "text-netland-muted"
                      }
                    >
                      {lateBadge(inst.id)}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-netland-light bg-netland-light/20 font-semibold text-netland-dark">
                <td className="px-5 py-3" colSpan={2}>
                  Totales
                </td>
                <td className="px-5 py-3">{formatSoles(totalScheduled)}</td>
                <td className="px-5 py-3 text-netland-primary">{formatSoles(totalPaidSchedule)}</td>
                <td className="px-5 py-3">{formatSoles(totalBalance)}</td>
                <td className="px-5 py-3" />
                <td className="px-5 py-3" />
              </tr>
            </Table>
            <p className="mt-3 text-xs text-netland-muted">
              * La columna <span className="font-semibold">Saldo</span> muestra el
              capital pendiente sobre el monto financiado total después de cada cuota.
            </p>
            </>
          )}
        </Card>
      )}

      {/* Historial de pagos */}
      <Card>
        <h2 className="mb-4 font-display text-lg font-semibold text-netland-dark">
          Historial de pagos
        </h2>
        {!payments || payments.length === 0 ? (
          <EmptyState
            title="Sin pagos"
            description="No hay pagos registrados para este contrato."
          />
        ) : (
          <Table
            headers={[
              "Fecha",
              "Monto",
              "Medio",
              "Transacción",
              "Estado",
              "Acciones",
            ]}
          >
            {payments.map((p) => (
              <tr
                key={p.id}
                className={`hover:bg-netland-light/30 ${p.is_cancelled ? "opacity-50" : ""}`}
              >
                <td className="px-5 py-2.5 text-sm">{formatDate(p.payment_date)}</td>
                <td className="px-5 py-2.5 font-semibold text-netland-primary">
                  {formatSoles(p.amount)}
                </td>
                <td className="px-5 py-2.5 text-xs uppercase">{p.payment_method}</td>
                <td className="px-5 py-2.5 text-sm">{p.transaction_number || "—"}</td>
                <td className="px-5 py-2.5">
                  {p.is_cancelled ? (
                    <Badge color="#dc2626">Anulado</Badge>
                  ) : (
                    <Badge color="#16a34a">Registrado</Badge>
                  )}
                </td>
                <td className="px-5 py-2.5">
                  <Link
                    to={`/admin/pagos/${p.id}`}
                    className="text-sm font-medium text-netland-primary hover:underline"
                  >
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Documentos emitidos */}
      <Card className="mt-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-netland-dark">
          Documentos emitidos
        </h2>
        {!documents || documents.length === 0 ? (
          <EmptyState
            title="Sin documentos"
            description="Emite proformas, boletas o facturas desde este contrato."
          />
        ) : (
          <Table headers={["Tipo", "Documento", "Descripción", "Tamaño", "Fecha", "Acciones"]}>
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-netland-light/30">
                <td className="px-5 py-2.5">
                  <Badge color="#0891b2">{DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type}</Badge>
                </td>
                <td className="px-5 py-2.5 font-semibold text-netland-dark">{doc.document_name}</td>
                <td className="px-5 py-2.5 text-sm text-netland-muted">{doc.description || "—"}</td>
                <td className="px-5 py-2.5 text-sm">{doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : "—"}</td>
                <td className="px-5 py-2.5 text-sm">{formatDate(doc.uploaded_at)}</td>
                <td className="px-5 py-2.5">
                  {doc.file_url && (
                    <Button
                      variant="outline"
                      className="!px-2.5 !py-1.5"
                      title="Abrir documento"
                      onClick={() => window.open(doc.file_url!, "_blank")}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Modal de registro de pago */}
      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title={`Registrar pago · ${contract.contract_number}`}
        wide
      >
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Fecha de Pago">
            <Input
              type="date"
              value={paymentForm.payment_date}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, payment_date: e.target.value })
              }
            />
          </Field>
          <Field label="Monto recibido del cliente (S/)">
            <Input
              type="number"
              step="0.01"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              placeholder="0.00"
            />
          </Field>

          <Field label="Método de Pago">
            <Select
              value={paymentForm.payment_method}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, payment_method: e.target.value })
              }
            >
              {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="N° de Transacción">
            <Input
              value={paymentForm.transaction_number}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, transaction_number: e.target.value })
              }
              placeholder="Opcional"
            />
          </Field>

          <Field label="Banco">
            <Input
              value={paymentForm.bank_name}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, bank_name: e.target.value })
              }
              placeholder="Opcional"
            />
          </Field>

          <Field label="Observaciones" className="sm:col-span-2">
            <Input
              value={paymentForm.notes}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, notes: e.target.value })
              }
              placeholder="Opcional"
            />
          </Field>

          {contract.payment_modality === "financiado" && allocations.length > 0 && (
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-semibold text-netland-dark">
                Distribución del pago
              </p>
              <p className="mb-3 text-xs text-netland-muted">
                {moraMode
                  ? "Marca las cuotas por cobrar (se pagan en orden, desde la más atrasada). Las vencidas se cobran completas: cuota + mora. Si solo se pagará la más antigua, deja las demás sin marcar."
                  : "Marca las cuotas a las que se aplicará el pago. Si no marcas ninguna, se aplicará automáticamente a la cuota pendiente más antigua."}
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-netland-light p-3">
                {allocations.map((alloc) => (
                  <label
                    key={alloc.installment_id}
                    className="flex items-center gap-3 rounded-lg border border-netland-light/60 bg-netland-light/10 px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={alloc.checked}
                      onChange={() => toggleAllocation(alloc.installment_id)}
                      className="h-4 w-4 rounded border-netland-light accent-netland-primary"
                    />
                    <span className="w-20 text-sm font-medium">
                      Cuota {String(alloc.installment_number).padStart(2, "0")} / {totalInstallments}
                    </span>
                    <span className="w-28 text-xs text-netland-muted">Saldo: {formatSoles(alloc.balance)}</span>
                    {lateOf(alloc.due_date).days > 0 && (
                      <span className="text-xs font-semibold text-amber-600">
                        Atraso {lateOf(alloc.due_date).days}d · +{formatSoles(lateOf(alloc.due_date).interest)}
                      </span>
                    )}
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={alloc.amount}
                      onChange={(e) =>
                        setAllocations((prev) =>
                          prev.map((a) =>
                            a.installment_id === alloc.installment_id
                              ? { ...a, amount: e.target.value }
                              : a
                          )
                        )
                      }
                      disabled={!alloc.checked || (moraMode && lateOf(alloc.due_date).days > 0)}
                      className="w-32 rounded-lg border border-netland-light px-3 py-1.5 text-sm focus:border-netland-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-netland-light/40 disabled:opacity-50"
                    />
                  </label>
                ))}
              </div>
              {moraMode && checkedSummary && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-900">
                      Total por las cuotas marcadas
                    </span>
                    <span className="font-bold text-netland-primary">
                      {formatSoles(checkedTotal)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-amber-700">
                    Saldo {formatSoles(checkedSummary.balance)} · Mora{" "}
                    {formatSoles(checkedSummary.mora)}.
                    {paymentAmountNum >= checkedTotal - 0.005
                      ? " Este monto alcanza para cubrirlas."
                      : ` Falta ${formatSoles(checkedTotal - paymentAmountNum)} para cubrirlas.`}
                  </p>
                </div>
              )}
            </div>
          )}

          {contract.payment_modality === "financiado" && hasLateInterest && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 sm:col-span-2">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-800">
                    Interés por mora
                  </span>
                  <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    {formatSoles(dailyRate)}/día
                  </span>
                </div>
                <span className="text-xs font-semibold text-amber-700">
                  Total mora: {formatSoles(overdueInterestTotal)}
                </span>
              </div>

              <div className="mb-3 overflow-hidden rounded-lg border border-amber-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-amber-100/70 text-left text-[11px] uppercase tracking-wide text-amber-800">
                      <th className="px-3 py-2">Cuota</th>
                      <th className="px-3 py-2">Vencimiento</th>
                      <th className="px-3 py-2 text-right">Días de atraso</th>
                      <th className="px-3 py-2 text-right">Mora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueRows.map((r) => (
                      <tr
                        key={r.installment.id}
                        className="border-t border-amber-100"
                      >
                        <td className="px-3 py-2 font-semibold text-netland-dark">
                          {String(r.installment.installment_number).padStart(2, "0")}
                        </td>
                        <td className="px-3 py-2 text-neutral-600">
                          {formatDate(r.installment.due_date)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-red-600">
                          {r.days} {r.days === 1 ? "día" : "días"}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-amber-700">
                          {formatSoles(r.interest)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-amber-200 bg-amber-50/70 font-semibold text-amber-900">
                      <td className="px-3 py-2" colSpan={3}>
                        Total interés por mora
                      </td>
                      <td className="px-3 py-2 text-right font-bold">
                        {formatSoles(overdueInterestTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="mb-3 text-xs text-amber-700">
                Atraso máximo registrado:{" "}
                <span className="font-semibold">
                  {overdueMaxDays} {overdueMaxDays === 1 ? "día" : "días"}
                </span>
                . Las cuotas vencidas se cobran completas (cuota + mora) y en orden
                desde la más antigua: marca en la distribución cuáles vas a cobrar. Si
                solo se pagará la más atrasada, deja las demás sin marcar.
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setExonerateInterest(false)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    !exonerateInterest
                      ? "border-amber-400 bg-amber-200 text-amber-900"
                      : "border-amber-200 bg-white text-amber-600 hover:bg-amber-100"
                  }`}
                >
                  <CheckCircle className="h-4 w-4" />
                  Cobrar mora
                </button>
                <button
                  type="button"
                  onClick={() => setExonerateInterest(true)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    exonerateInterest
                      ? "border-amber-400 bg-amber-200 text-amber-900"
                      : "border-amber-200 bg-white text-amber-600 hover:bg-amber-100"
                  }`}
                >
                  <XCircle className="h-4 w-4" />
                  Exonerar mora
                </button>
              </div>
              <div className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-amber-800">Aplicado a las cuotas</span>
                  <span className="font-semibold text-netland-dark">
                    {formatSoles(summaryApplied)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-amber-800">
                    Interés de mora{exonerateInterest ? " (exonerado)" : ""}
                  </span>
                  <span className="font-semibold text-amber-700">
                    {exonerateInterest ? "—" : formatSoles(summaryMora)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-amber-100 pt-1">
                  <span className="font-bold text-amber-900">Total a cobrar</span>
                  <span className="text-base font-bold text-netland-primary">
                    {formatSoles(summaryTotal)}
                  </span>
                </div>
              </div>
              {dueSimulation?.blocked && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Monto recibido {formatSoles(paymentAmountNum)}: la cuota{" "}
                  {String(dueSimulation.blocked.installment_number).padStart(2, "0")}{" "}
                  vencida exige pagar cuota {formatSoles(dueSimulation.blocked.balance)}{" "}
                  + mora {formatSoles(dueSimulation.blocked.interest)} ={" "}
                  {formatSoles(
                    dueSimulation.blocked.balance + dueSimulation.blocked.interest
                  )}{" "}
                  para continuar el pago.
                </div>
              )}
              <p className="mt-2 text-xs text-amber-700">
                {exonerateInterest
                  ? "La mora se exonera: solo se cobra el monto de las cuotas."
                  : "El interés de mora se suma al monto recibido. Las cuotas vencidas marcadas se cobran completas: cuota + mora."}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 sm:col-span-2">
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitPayment} disabled={savePayment.isPending}>
              {savePayment.isPending ? "Registrando..." : "Registrar pago"}
            </Button>
          </div>
        </div>
      </Modal>

      <LateInterestConfirmDialog
        open={moraConfirmOpen}
        onClose={() => setMoraConfirmOpen(false)}
        onConfirm={handleMoraConfirm}
        rows={dialogRows}
        cuotaAmount={summaryApplied}
        totalToCollect={summaryTotal}
        dailyRate={dailyRate}
        confirming={savePayment.isPending}
      />

      {/* Modal de emisión de documento */}
      <Modal
        open={emitOpen}
        onClose={() => setEmitOpen(false)}
        title={`Emitir documento · ${contract.contract_number}`}
      >
        <div className="space-y-4 p-6">
          <Field label="Tipo de documento">
            <Select
              value={emitForm.document_type}
              onChange={(e) => setEmitForm({ ...emitForm, document_type: e.target.value })}
            >
              <option value="proforma">Proforma</option>
              <option value="boleta">Boleta</option>
              <option value="factura">Factura</option>
            </Select>
          </Field>
          <Field label="Descripción (opcional)">
            <Input
              value={emitForm.description}
              onChange={(e) => setEmitForm({ ...emitForm, description: e.target.value })}
              placeholder="Ej: Cuota inicial 30%"
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEmitOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => emitDocument.mutate(emitForm)} disabled={emitDocument.isPending}>
              {emitDocument.isPending ? "Emitiendo..." : "Emitir y descargar"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de refinanciamiento del cronograma */}
      <Modal
        open={refinanceOpen}
        onClose={() => setRefinanceOpen(false)}
        title={`Refinanciar cronograma · ${contract.contract_number}`}
      >
        <div className="space-y-4 p-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Se redistribuirá el saldo pendiente de{" "}
            <strong>{formatSoles(totalBalance)}</strong> en las cuotas nuevas. Las
            cuotas ya pagadas se mantienen intactas. Esta acción solo se realiza a
            solicitud explícita del cliente y no se puede deshacer.
          </div>
          <Field label="Fecha de inicio del nuevo cronograma">
            <Input
              type="date"
              value={refinanceForm.start_date}
              onChange={(e) =>
                setRefinanceForm({ ...refinanceForm, start_date: e.target.value })
              }
            />
          </Field>
          <Field label="Número de cuotas">
            <Input
              type="number"
              min="1"
              value={refinanceForm.number_of_installments}
              onChange={(e) =>
                setRefinanceForm({
                  ...refinanceForm,
                  number_of_installments: e.target.value,
                })
              }
              placeholder={`Ej: ${Math.max(pendingCount, 1)}`}
            />
          </Field>
          {refinancePreview && (
            <div className="rounded-lg border border-netland-light bg-netland-light/50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-netland-muted">Cuota estimada</span>
                <span className="font-bold text-netland-primary">
                  {formatSoles(refinancePreview.per)}
                </span>
              </div>
              {refinanceNum > 1 && (
                <div className="mt-1 flex items-center justify-between text-xs text-netland-muted">
                  <span>Última cuota (absorbe la diferencia del redondeo)</span>
                  <span className="font-semibold text-netland-dark">
                    {formatSoles(refinancePreview.last)}
                  </span>
                </div>
              )}
              <p className="mt-2 border-t border-netland-light pt-2 text-xs text-netland-muted">
                Saldo a refinanciar: {formatSoles(totalBalance)} repartido en{" "}
                {refinanceNum} cuota(s) desde el {refinanceForm.start_date}.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRefinanceOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={submitRefinance}
              disabled={refinanceContract.isPending}
            >
              {refinanceContract.isPending ? "Refinanciando..." : "Refinanciar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-netland-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-netland-dark">{value}</dd>
    </div>
  );
}