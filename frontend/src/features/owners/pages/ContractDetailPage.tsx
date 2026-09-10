import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft,
  Plus,
  CalendarDays,
  CreditCard,
  XCircle,
  UserCheck,
  AlertTriangle,
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
} from "../constants";

interface AllocRow {
  installment_id: number;
  installment_number: number;
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
  const [emitOpen, setEmitOpen] = useState(false);
  const [emitForm, setEmitForm] = useState({ document_type: "proforma", description: "" });
  const [pdfLoading, setPdfLoading] = useState(false);
  const [schedulePdfLoading, setSchedulePdfLoading] = useState(false);

  // Detalle del contrato
  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => api.get<ContractDetail>(`/contracts/${contractId}`, true),
    enabled: !!contractId,
  });

  const { data: documents } = useQuery({
    queryKey: ["contract-documents", contractId],
    queryFn: () => api.get<ContractDocument[]>(`/contracts/${contractId}/documents`, true),
    enabled: !!contractId,
  });

  const { data: financing } = useQuery({
    queryKey: ["contract-financing", contractId],
    queryFn: () =>
      api.get<FinancingPlanDetail>(`/contracts/${contractId}/financing`, true),
    enabled: !!contractId && contract?.payment_modality === "financiado",
  });

  const { data: schedule } = useQuery({
    queryKey: ["contract-schedule", contractId],
    queryFn: () =>
      api.get<Installment[]>(`/contracts/${contractId}/schedule`, true),
    enabled: !!contractId && contract?.payment_modality === "financiado",
  });

  const { data: payments } = useQuery({
    queryKey: ["contract-payments", contractId],
    queryFn: () =>
      api.get<Array<Payment & { created_at: string }>>(
        `/payments/history/${contractId}`,
        true
      ),
    enabled: !!contractId,
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
        balance: i.balance,
        amount: i.balance.toString(),
        checked: false,
      }))
    );
    setPaymentOpen(true);
  };

  const submitPayment = async () => {
    if (!contract) return;
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast("El monto debe ser mayor a 0", "error");
      return;
    }

    const checkedAllocs = allocations.filter((a) => a.checked);
    let allocPayload: Array<{ installment_id: number; amount: number }> | null = null;
    const warnings: string[] = [];
    const paymentAmount = parseFloat(paymentForm.amount);

    if (checkedAllocs.length > 0) {
      const effectiveAmount = (a: AllocRow) =>
        Math.min(parseFloat(a.amount) || 0, paymentAmount);

      allocPayload = checkedAllocs.map((a) => ({
        installment_id: a.installment_id,
        amount: effectiveAmount(a),
      }));
      const totalAllocated = allocPayload.reduce((sum, a) => sum + a.amount, 0);

      if (totalAllocated > paymentAmount) {
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
      const surplus = paymentAmount - totalAllocated;
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
        if (paymentAmount > 0 && paymentAmount < oldestPending.balance) {
          warnings.push(
            `Pago parcial:\n· Cuota ${oldestPending.installment_number}: falta ${formatSoles(oldestPending.balance - paymentAmount)} para completarla`
          );
        }
        if (paymentAmount > oldestPending.balance) {
          warnings.push(
            `Pago en exceso:\n· Cuota ${oldestPending.installment_number}: sobra ${formatSoles(paymentAmount - oldestPending.balance)}` +
              "\nEl excedente se aplicará automáticamente a la siguiente cuota pendiente."
          );
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
      amount: parseFloat(paymentForm.amount),
      payment_method: paymentForm.payment_method,
      transaction_number: paymentForm.transaction_number || null,
      bank_name: paymentForm.bank_name || null,
      notes: paymentForm.notes || null,
      allocations: allocPayload,
    };

    savePayment.mutate(payload);
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
          <Field label="Monto (S/)">
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
                Marca las cuotas a las que se aplicará el pago. Si no marcas ninguna,
                se aplicará automáticamente a la cuota pendiente más antigua.
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
                      onChange={(e) =>
                        setAllocations((prev) =>
                          prev.map((a) =>
                            a.installment_id === alloc.installment_id
                              ? { ...a, checked: e.target.checked }
                              : a
                          )
                        )
                      }
                      className="h-4 w-4 rounded border-netland-light accent-netland-primary"
                    />
                    <span className="w-20 text-sm font-medium">
                      Cuota {String(alloc.installment_number).padStart(2, "0")} / {totalInstallments}
                    </span>
                    <span className="w-28 text-xs text-netland-muted">Saldo: {formatSoles(alloc.balance)}</span>
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
                      disabled={!alloc.checked}
                      className="w-32 rounded-lg border border-netland-light px-3 py-1.5 text-sm focus:border-netland-primary focus:outline-none"
                    />
                  </label>
                ))}
              </div>
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