import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search, X, Wallet, Trash2, RotateCcw, Ban, Eye } from "lucide-react";
import { api } from "../../../lib/api";
import type {
  Advisor,
  CommissionPayment,
  CommissionPaymentType,
  Project,
} from "../../../types";
import {
  PageHeader,
  Button,
  Card,
  Field,
  Input,
  Select,
  Table,
  Badge,
  Pagination,
} from "../../admin/ui";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import {
  COMMISSION_STATUS_LABELS,
  COMMISSION_STATUS_COLORS,
  formatMoney,
} from "../constants";
import type { PaymentFormPayload, PayPayload } from "../types";
import PaymentFormModal from "./PaymentFormModal";
import PayModal from "./PayModal";
import CancelModal from "./CancelModal";
import CommissionDetailModal from "./CommissionDetailModal";

interface Props {
  paymentType: CommissionPaymentType;
  title: string;
  subtitle: string;
  createLabel: string;
}

export default function CommissionPaymentList({
  paymentType,
  title,
  subtitle,
  createLabel,
}: Props) {
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();
  const queryKey = ["commission-payments", paymentType];

  // Filtros
  const [advisorId, setAdvisorId] = useState<number | "">("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modales
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CommissionPayment | null>(null);
  const [paying, setPaying] = useState<CommissionPayment | null>(null);
  const [cancelling, setCancelling] = useState<CommissionPayment | null>(null);
  const [viewing, setViewing] = useState<CommissionPayment | null>(null);

  const { data: advisors } = useQuery({
    queryKey: ["advisors-admin"],
    queryFn: ({ signal }) => api.get<Advisor[]>("/advisors", true, signal),
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-admin"],
    queryFn: ({ signal }) => api.get<Project[]>("/projects", true, signal),
  });

  const { data: items, isLoading } = useQuery({
    queryKey: [queryKey, advisorId, projectId, status, period, fromDate, toDate, search],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      params.append("payment_type", paymentType);
      if (advisorId) params.append("advisor_id", String(advisorId));
      if (projectId) params.append("project_id", String(projectId));
      if (status) params.append("payment_status", status);
      if (period) params.append("payment_period", period);
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      if (search) params.append("search", search);
      return api.get<CommissionPayment[]>(`/commissions/payments?${params}`, true, signal);
    },
  });

  const rows = items || [];
  const totalItems = rows.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedRows = rows.slice(startIndex, startIndex + pageSize);

  const summary = useMemo(() => {
    const acc = {
      pending: 0,
      pending_count: 0,
      paid: 0,
      paid_count: 0,
      cancelled: 0,
      cancelled_count: 0,
    };
    for (const r of rows) {
      if (r.payment_status === "pendiente" || r.payment_status === "parcial") {
        acc.pending += r.balance ?? 0;
        acc.pending_count++;
      } else if (r.payment_status === "pagado") {
        acc.paid += r.amount_paid ?? 0;
        acc.paid_count++;
      } else if (r.payment_status === "anulado") {
        acc.cancelled += r.amount ?? 0;
        acc.cancelled_count++;
      }
    }
    return acc;
  }, [rows]);

  // Mutaciones
  const saveMutation = useMutation({
    mutationFn: (payload: PaymentFormPayload) =>
      editing
        ? api.put(`/commissions/payments/${editing.id}`, payload, true)
        : api.post("/commissions/payments", payload, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast(editing ? "Registro actualizado." : "Registro creado.");
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PayPayload }) =>
      api.post(`/commissions/payments/${id}/pay`, payload, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast("Pago registrado exitosamente.");
      setPaying(null);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api.post(`/commissions/payments/${id}/cancel`, { cancellation_reason: reason }, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast("Registro anulado.");
      setCancelling(null);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/commissions/payments/${id}/reactivate`, {}, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast("Registro reactivado.");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/commissions/payments/${id}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast("Registro eliminado.");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: CommissionPayment) => {
    setEditing(row);
    setFormOpen(true);
  };

  const clearFilters = () => {
    setAdvisorId("");
    setProjectId("");
    setStatus("");
    setPeriod("");
    setFromDate("");
    setToDate("");
    setSearch("");
    setPage(1);
  };

  const isComision = paymentType === "comision";

  const tableHeaders = isComision
    ? ["Asesor", "Proyecto", "Concepto", "Base", "%", "Monto", "Cuenta / Banco", "Estado", "Acciones"]
    : ["Asesor", "Período", "Concepto", "Monto", "Cuenta / Banco", "Estado", "Fecha pago", "Acciones"];

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {createLabel}
          </Button>
        }
      />

      {/* Resumen rápido */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-netland-muted">Saldo por pagar</p>
            <p className="mt-2 font-display text-2xl font-semibold text-amber-500">{formatMoney(summary.pending)}</p>
            <p className="text-xs text-netland-muted">{summary.pending_count} registros</p>
          </div>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-netland-muted">Total pagado</p>
            <p className="mt-2 font-display text-2xl font-semibold text-green-600">{formatMoney(summary.paid)}</p>
            <p className="text-xs text-netland-muted">{summary.paid_count} registros</p>
          </div>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-netland-muted">Total anulado</p>
            <p className="mt-2 font-display text-2xl font-semibold text-red-500">{formatMoney(summary.cancelled)}</p>
            <p className="text-xs text-netland-muted">{summary.cancelled_count} registros</p>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Asesor">
            <Select value={advisorId} onChange={(e) => { setAdvisorId(e.target.value ? Number(e.target.value) : ""); setPage(1); }}>
              <option value="">Todos</option>
              {advisors?.map((a) => (
                <option key={a.id} value={a.id}>{a.name} {a.is_external ? "(ext)" : ""}</option>
              ))}
            </Select>
          </Field>

          {isComision && (
            <Field label="Proyecto">
              <Select value={projectId} onChange={(e) => { setProjectId(e.target.value ? Number(e.target.value) : ""); setPage(1); }}>
                <option value="">Todos</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>{p.short_name}</option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Estado">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {Object.entries(COMMISSION_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>

          {isComision ? (
            <>
              <Field label="Desde (registro)">
                <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
              </Field>
              <Field label="Hasta (registro)">
                <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
              </Field>
            </>
          ) : (
            <Field label="Período">
              <Input type="month" value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }} />
            </Field>
          )}

          <Field label="Buscar" className="sm:col-span-2 lg:col-span-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-netland-muted" />
              <Input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Nombre, documento, contrato..."
                className="!pl-9 !pr-10"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-netland-muted hover:text-netland-dark">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </Field>
        </div>

        <div className="mt-3 flex justify-end">
          <Button variant="outline" onClick={clearFilters} className="!py-1.5 text-xs">
            Limpiar filtros
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Card><div className="py-8"><CoreSpinLoader /></div></Card>
      ) : totalItems === 0 ? (
        <Card>
          <EmptyState
            title={isComision ? "Sin comisiones registradas" : "Sin mensualidades registradas"}
            description="Crea un nuevo registro para comenzar."
          />
        </Card>
      ) : (
        <>
          <Table headers={tableHeaders}>
            {paginatedRows.map((row) => (
              <tr key={row.id} className="hover:bg-netland-light/30">
                {/* Asesor */}
                <td className="px-5 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-netland-dark">{row.advisor_name}</span>
                      {row.advisor_is_external && (
                        <span className="inline-flex items-center rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700">
                          Externo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-netland-muted">{row.document_type} {row.document_number || "—"}</p>
                  </div>
                </td>

                {isComision ? (
                  <td className="px-5 py-3 text-sm text-netland-muted">{row.project_name || "—"}</td>
                ) : (
                  <td className="px-5 py-3 text-sm font-medium text-netland-dark">{row.payment_period || "—"}</td>
                )}

                <td className="px-5 py-3">
                  <p className="flex items-center gap-2 text-sm text-netland-dark line-clamp-1">
                    {row.concept}
                    <span
                      title={row.origin === "auto" ? "Generada automáticamente al registrar la venta" : "Registrada manualmente"}
                      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        row.origin === "auto"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {row.origin === "auto" ? "Auto" : "Manual"}
                    </span>
                  </p>
                </td>

                {isComision ? (
                  <>
                    <td className="px-5 py-3 text-sm text-netland-muted">{formatMoney(row.base_amount)}</td>
                    <td className="px-5 py-3 text-sm text-netland-muted">{row.percent_applied != null ? `${row.percent_applied}%` : "—"}</td>
                  </>
                ) : null}

                <td className="px-5 py-3">
                  <p className="font-semibold text-netland-primary">{formatMoney(row.amount)}</p>
                  {row.payment_status === "parcial" && (
                    <p className="text-[11px] text-netland-muted">
                      Pagado: {formatMoney(row.amount_paid)} · Saldo: <span className="font-semibold text-amber-600">{formatMoney(row.balance)}</span>
                    </p>
                  )}
                </td>

                <td className="px-5 py-3">
                  <p className="text-xs text-netland-muted">{row.bank_name || "—"}</p>
                  <p className="text-xs font-medium text-netland-dark">{row.account_number || "—"}</p>
                </td>

                <td className="px-5 py-3">
                  <Badge color={COMMISSION_STATUS_COLORS[row.payment_status] ?? "#6b7280"}>
                    {COMMISSION_STATUS_LABELS[row.payment_status] ?? row.payment_status}
                  </Badge>
                  {row.cancellation_reason && (
                    <p className="mt-1 max-w-[140px] text-[10px] leading-tight text-red-400" title={row.cancellation_reason}>
                      {row.cancellation_reason}
                    </p>
                  )}
                </td>

                {!isComision && (
                  <td className="px-5 py-3 text-sm text-netland-muted">{row.payment_date || "—"}</td>
                )}

                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="outline" className="!px-2 !py-1" title="Ver detalles" onClick={() => setViewing(row)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {(row.payment_status === "pendiente" || row.payment_status === "parcial") && (
                      <>
                        <Button variant="outline" className="!px-2 !py-1" title="Editar" onClick={() => openEdit(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" className="!px-2 !py-1" title="Registrar pago" onClick={() => setPaying(row)}>
                          <Wallet className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" className="!px-2 !py-1" title="Anular" onClick={() => setCancelling(row)}>
                          <Ban className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                        <Button
                          variant="danger"
                          className="!px-2 !py-1"
                          title="Eliminar"
                          onClick={async () => {
                            if (await confirm("¿Eliminar este registro?")) deleteMutation.mutate(row.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {row.payment_status === "pagado" && (
                      <Button variant="outline" className="!px-2 !py-1" title="Anular" onClick={() => setCancelling(row)}>
                        <Ban className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    )}
                    {row.payment_status === "anulado" && (
                      <Button variant="outline" className="!px-2 !py-1" title="Reactivar" onClick={() => reactivateMutation.mutate(row.id)}>
                        <RotateCcw className="h-3.5 w-3.5 text-green-600" />
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
            total={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            unitLabel={isComision ? "comisiones" : "mensualidades"}
          />
        </>
      )}

      {/* Modales */}
      <PaymentFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        mode={paymentType}
        editing={editing}
        onSave={(payload) => saveMutation.mutate(payload)}
        isSubmitting={saveMutation.isPending}
      />

      <PayModal
        open={!!paying}
        onClose={() => setPaying(null)}
        record={paying}
        onConfirm={(payload) => { if (paying) payMutation.mutate({ id: paying.id, payload }); }}
        isSubmitting={payMutation.isPending}
      />

      <CancelModal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        record={cancelling}
        onConfirm={(reason) => { if (cancelling) cancelMutation.mutate({ id: cancelling.id, reason }); }}
        isSubmitting={cancelMutation.isPending}
      />

      <CommissionDetailModal
        record={viewing}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}