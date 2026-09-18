import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Eye, XCircle, Search, X, Download, AlertTriangle, CheckCircle } from "lucide-react";
import { api } from "../../../lib/api";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Table,
  Field,
  Select,
  Input,
  Pagination,
} from "../../admin/ui";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { Contract, Payment, Installment } from "../types";
import { PAYMENT_METHODS, formatSoles, formatDate, computeLate, simulateDuePayment, applyPrefixSelection, dueSummary, toDialogRows } from "../constants";
import { LateInterestConfirmDialog } from "../components/LateInterestConfirmDialog";

interface PaymentFormState {
  contract_id: string;
  payment_date: string;
  amount: string;
  payment_method: string;
  transaction_number: string;
  bank_name: string;
  notes: string;
}

const emptyForm: PaymentFormState = {
  contract_id: "",
  payment_date: new Date().toISOString().split("T")[0],
  amount: "",
  payment_method: "efectivo",
  transaction_number: "",
  bank_name: "",
  notes: "",
};

export default function PaymentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PaymentFormState>(emptyForm);
  const [exonerateInterest, setExonerateInterest] = useState(false);
  const [moraConfirmOpen, setMoraConfirmOpen] = useState(false);
  const moraAccepted = useRef(false);
  // null = auto (se cobran todas las vencidas); Set = selección explícita.
  const [selectedOverdue, setSelectedOverdue] = useState<Set<number> | null>(null);
  const closeCreateModal = () => {
    setModalOpen(false);
    setSelectedOverdue(null);
  };

  // Fetch payments
  const {
    data: payments,
    isLoading,
  } = useQuery({
    queryKey: ["payments", search],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      return api.get<any[]>(`/payments?${params.toString()}`, true, signal);
    },
  });

  // Fetch active contracts for dropdown
  const { data: contracts } = useQuery({
    queryKey: ["contracts-active"],
    queryFn: ({ signal }) => api.get<Contract[]>("/contracts?status=activo", true, signal),
  });

  const selectedContract = contracts?.find((c) => c.id === Number(form.contract_id));

  // Configuración del interés diario por mora
  const { data: lateConfig } = useQuery({
    queryKey: ["late-interest-config"],
    queryFn: ({ signal }) =>
      api.get<{ daily_rate: number; enabled: boolean }>(
        `/payments/late-interest-config`,
        true,
        signal
      ),
  });

  // Cronograma del contrato seleccionado para estimar la mora
  const { data: schedule } = useQuery({
    queryKey: ["contract-schedule-for-payment", form.contract_id],
    queryFn: ({ signal }) =>
      api.get<Installment[]>(`/contracts/${form.contract_id}/schedule`, true, signal),
    enabled: !!form.contract_id && selectedContract?.payment_modality === "financiado",
  });

  const dailyRate =
    lateConfig?.enabled && lateConfig.daily_rate > 0 ? lateConfig.daily_rate : 0;
  const refDate = form.payment_date || new Date().toISOString().split("T")[0];

  // Cuotas pendientes con atraso (días y mora respecto a la fecha de pago)
  const overdueRows = (schedule || [])
    .filter((i) => ["pendiente", "parcial", "vencida"].includes(i.status))
    .map((i) => {
      const late = computeLate(i.due_date, refDate, dailyRate);
      return { installment: i, days: late.days, interest: late.interest };
    })
    .filter((r) => r.days > 0)
    .sort((a, b) => (a.installment.due_date > b.installment.due_date ? 1 : -1));
  const overdueInterestTotal = overdueRows.reduce((s, r) => s + r.interest, 0);
  const overdueMaxDays = overdueRows.reduce((s, r) => Math.max(s, r.days), 0);
  const hasLateInterest = overdueRows.length > 0 && dailyRate > 0;

  // Modo cobro de mora: hay cuotas vencidas y NO se exonera el recargo. Las
  // cuotas vencidas se cobran completas (cuota + mora) en orden desde la más
  // antigua: por defecto se cobran todas, o solo las que el cajero marque.
  const paymentAmountNum = parseFloat(form.amount) || 0;
  const moraMode =
    selectedContract?.payment_modality === "financiado" && hasLateInterest && !exonerateInterest;

  const pendingCuotas = (schedule || [])
    .filter((i) => ["pendiente", "parcial", "vencida"].includes(i.status))
    .map((i) => ({
      id: i.id,
      installment_number: i.installment_number,
      due_date: i.due_date,
      balance: i.balance,
    }));

  const overdueChecked = (id: number): boolean =>
    selectedOverdue ? selectedOverdue.has(id) : true;

  const toggleOverdue = (id: number) => {
    const current =
      selectedOverdue ?? new Set(overdueRows.map((r) => r.installment.id));
    const target = overdueRows.find((r) => r.installment.id === id);
    if (!target) return;
    const next = applyPrefixSelection(
      current,
      id,
      overdueRows.map((r) => r.installment),
      !current.has(id)
    );
    setSelectedOverdue(next);
  };

  // Si no hay selección explícita, se cobran todas las vencidas (auto).
  const settleOnlyIds =
    moraMode && selectedOverdue && selectedOverdue.size > 0 ? selectedOverdue : undefined;

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

  // Total exigido por las cuotas marcadas (saldo + mora) para saber cuánto cobrar.
  const checkedIds =
    selectedOverdue ?? new Set(overdueRows.map((r) => r.installment.id));
  const checkedOverdueSummary = overdueRows
    .filter((r) => checkedIds.has(r.installment.id))
    .reduce(
      (acc, r) => ({
        balance: acc.balance + r.installment.balance,
        mora: acc.mora + r.interest,
      }),
      { balance: 0, mora: 0 }
    );
  const checkedOverdueTotal = checkedOverdueSummary.balance + checkedOverdueSummary.mora;

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (payload: any) => api.post("/payments", payload, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["collections-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["collections-items"] });
      toast("Pago registrado correctamente");
      closeCreateModal();
      setForm(emptyForm);
      moraAccepted.current = false;
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api.post(`/payments/${id}/cancel`, { cancellation_reason: reason }, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["collections-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["collections-items"] });
      toast("Pago anulado correctamente");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const filteredPayments = payments || [];
  const totalPayments = filteredPayments.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedPayments = filteredPayments.slice(startIndex, startIndex + pageSize);

  const openCreate = () => {
    setForm(emptyForm);
    setExonerateInterest(false);
    moraAccepted.current = false;
    setSelectedOverdue(null);
    setModalOpen(true);
  };

  const submit = () => {
    if (!form.contract_id) {
      toast("Selecciona un contrato", "error");
      return;
    }
    const received = parseFloat(form.amount);
    if (!received || received <= 0) {
      toast("El monto recibido debe ser mayor a 0", "error");
      return;
    }

    // Get payer_id from contract
    const selectedContract = contracts?.find((c) => c.id === Number(form.contract_id));
    if (!selectedContract) {
      toast("Contrato no encontrado", "error");
      return;
    }

    let finalAmount = received;
    let allocPayload: Array<{ installment_id: number; amount: number }> | null = null;

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
    }

    const payload = {
      contract_id: Number(form.contract_id),
      payer_id: selectedContract.owner_id,
      payment_date: form.payment_date,
      amount: finalAmount,
      payment_method: form.payment_method,
      transaction_number: form.transaction_number || null,
      bank_name: form.bank_name || null,
      notes: form.notes || null,
      allocations: allocPayload,
      exonerate_late_interest: exonerateInterest,
    };

    saveMutation.mutate(payload);
  };

  const handleMoraConfirm = () => {
    setMoraConfirmOpen(false);
    moraAccepted.current = true;
    submit();
  };

  const handleCancel = async (payment: Payment) => {
    const reason = prompt("Ingresa el motivo de la anulación (mínimo 10 caracteres):");
    if (!reason || reason.trim().length < 10) {
      toast("El motivo debe tener al menos 10 caracteres", "error");
      return;
    }
    if (await confirm(`¿Anular el pago de ${formatSoles(payment.amount)}?`)) {
      cancelMutation.mutate({ id: payment.id, reason: reason.trim() });
    }
  };

  return (
    <div>
      <PageHeader
        title="Pagos"
        subtitle="Registra y gestiona los pagos de contratos."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Registrar Pago
          </Button>
        }
      />

      {/* Search Filter */}
      <Card className="mb-6">
        <Field label="Buscar pago">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-netland-muted" />
            <Input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por contrato, propietario, transacción, banco..."
              className="!pl-9 !pr-10"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-netland-muted transition-colors hover:text-netland-dark"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </Field>
      </Card>

      {/* Payments Table */}
      {isLoading ? (
        <Card>
          <div className="py-8">
            <CoreSpinLoader />
          </div>
        </Card>
      ) : totalPayments === 0 ? (
        <Card>
          <EmptyState
            title="Sin pagos"
            description={
              search
                ? `No se encontraron pagos que coincidan con «${search}».`
                : "Registra el primer pago para comenzar."
            }
          />
        </Card>
      ) : (
        <>
          <Table
            headers={[
              "N° Contrato",
              "Propietario",
              "Fecha",
              "Monto",
              "Método",
              "Transacción",
              "Banco",
              "Estado",
              "Acciones",
            ]}
          >
            {paginatedPayments.map((payment) => (
              <tr
                key={payment.id}
                className={`hover:bg-netland-light/30 ${
                  payment.is_cancelled ? "opacity-50" : ""
                }`}
              >
                <td className="px-5 py-3 font-semibold text-netland-dark">
                  {payment.contract_number}
                </td>
                <td className="px-5 py-3 text-sm">{payment.payer_name}</td>
                <td className="px-5 py-3 text-sm">{formatDate(payment.payment_date)}</td>
                <td className="px-5 py-3 font-semibold text-netland-primary">
                  {formatSoles(payment.amount)}
                </td>
                <td className="px-5 py-3 text-xs uppercase">{payment.payment_method}</td>
                <td className="px-5 py-3 text-sm">{payment.transaction_number || "—"}</td>
                <td className="px-5 py-3 text-sm">{payment.bank_name || "—"}</td>
                <td className="px-5 py-3">
                  {payment.is_cancelled ? (
                    <Badge color="#dc2626">Anulado</Badge>
                  ) : (
                    <Badge color="#16a34a">Registrado</Badge>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="!px-2.5 !py-1.5"
                      onClick={() => navigate(`/admin/pagos/${payment.id}`)}
                      title="Ver detalle"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {!payment.is_cancelled && (
                      <Button
                        variant="danger"
                        className="!px-2.5 !py-1.5"
                        onClick={() => handleCancel(payment)}
                        title="Anular pago"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {payment.receipt_url && (
                      <Button
                        variant="outline"
                        className="!px-2.5 !py-1.5"
                        onClick={() => window.open(payment.receipt_url!, "_blank")}
                        title="Ver recibo"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalPayments}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            unitLabel="pagos"
          />
        </>
      )}

      {/* Form Modal */}
      <Modal
        open={modalOpen}
        onClose={closeCreateModal}
        title="Registrar Pago"
        wide
      >
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Contrato" className="sm:col-span-2">
            <Select
              value={form.contract_id}
              onChange={(e) => setForm({ ...form, contract_id: e.target.value })}
            >
              <option value="">Seleccionar contrato...</option>
              {contracts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contract_number} - {formatSoles(c.total_price)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Fecha de Pago">
            <Input
              type="date"
              value={form.payment_date}
              onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
            />
          </Field>

          <Field label="Monto recibido del cliente (S/)">
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
          </Field>

          <Field label="Método de Pago">
            <Select
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
            >
              {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Número de Transacción">
            <Input
              value={form.transaction_number}
              onChange={(e) => setForm({ ...form, transaction_number: e.target.value })}
              placeholder="Opcional"
            />
          </Field>

          <Field label="Banco">
            <Input
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              placeholder="Opcional"
            />
          </Field>

          <Field label="Observaciones" className="sm:col-span-2">
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Opcional"
            />
          </Field>

          {hasLateInterest && (
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
                      <th className="px-3 py-2">Pagar</th>
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
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={overdueChecked(r.installment.id)}
                            onChange={() => toggleOverdue(r.installment.id)}
                            className="h-4 w-4 rounded border-amber-300 accent-amber-600"
                          />
                        </td>
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
                      <td className="px-3 py-2" colSpan={4}>
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
                desde la más antigua. Usa el checkbox si solo se cobrará la más
                atrasada: desmarca las demás.
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
              {moraMode && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-900">
                      Total por las cuotas marcadas
                    </span>
                    <span className="font-bold text-netland-primary">
                      {formatSoles(checkedOverdueTotal)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-amber-700">
                    Saldo {formatSoles(checkedOverdueSummary.balance)} · Mora{" "}
                    {formatSoles(checkedOverdueSummary.mora)}.
                    {paymentAmountNum >= checkedOverdueTotal - 0.005
                      ? " Este monto alcanza para cubrirlas."
                      : ` Falta ${formatSoles(
                          checkedOverdueTotal - paymentAmountNum
                        )} para cubrirlas.`}
                  </p>
                </div>
              )}
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
            <Button variant="outline" onClick={closeCreateModal}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Registrando..." : "Registrar pago"}
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
        confirming={saveMutation.isPending}
      />
    </div>
  );
}
