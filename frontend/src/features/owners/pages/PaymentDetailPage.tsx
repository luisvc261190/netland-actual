import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, XCircle, Download, ReceiptText, FilePlus2 } from "lucide-react";
import { api, authStorage } from "../../../lib/api";
import { API_URL } from "../../../lib/constants";
import {
  PageHeader,
  Button,
  Card,
  Table,
  StatCard,
  Field,
  Select,
  Input,
  Badge,
} from "../../admin/ui";
import { useToast } from "../../../components/ui/Toast";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Modal } from "../../../components/ui/Modal";
import type { PaymentDetail } from "../types";
import {
  PAYMENT_METHODS,
  formatSoles,
  formatDate,
} from "../constants";

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  proforma: "Proforma",
  boleta: "Boleta",
  factura: "Factura",
};

interface EmittedDocument {
  id: number;
  document_name: string;
  document_type: string;
  description?: string | null;
  file_url?: string | null;
  file_size?: number | null;
  uploaded_at: string;
  payment_id?: number | null;
}

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const paymentId = Number(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [emitOpen, setEmitOpen] = useState(false);
  const [emitForm, setEmitForm] = useState({
    document_type: "boleta",
    description: "",
  });

  const { data: payment, isLoading } = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: ({ signal }) => api.get<PaymentDetail>(`/payments/${paymentId}`, true, signal),
    enabled: !!paymentId,
  });

  const { data: emittedDocs } = useQuery({
    queryKey: ["contract-documents", payment?.contract_id],
    queryFn: ({ signal }) =>
      api.get<EmittedDocument[]>(`/contracts/${payment!.contract_id}/documents`, true, signal),
    enabled: !!payment?.contract_id,
  });

  const paymentDocs = (emittedDocs || []).filter((d) => d.payment_id === paymentId);

  const cancelMutation = useMutation({
    mutationFn: () =>
      api.post(`/payments/${paymentId}/cancel`, { cancellation_reason: reason }, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment"] });
      queryClient.invalidateQueries({ queryKey: ["collections-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["collections-items"] });
      toast("Pago anulado correctamente");
      setCancelOpen(false);
      setReason("");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const emitMutation = useMutation({
    mutationFn: async (payload: { document_type: string; description?: string }) => {
      const token = authStorage.getToken();
      const response = await fetch(`${API_URL}/payments/${paymentId}/emit-document`, {
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
      setEmitOpen(false);
      setEmitForm({ document_type: "boleta", description: "" });
      toast("Documento emitido correctamente");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Detalle del pago" subtitle="Cargando..." />
        <Card>
          <div className="py-12">
            <CoreSpinLoader />
          </div>
        </Card>
      </div>
    );
  }

  if (!payment) {
    return (
      <Card>
        <EmptyState
          title="Pago no encontrado"
          description="El pago solicitado no existe."
        />
      </Card>
    );
  }

  const totalApplied = payment.allocations.reduce((s, a) => s + a.allocated_amount, 0);
  const moraAmount = payment.late_interest_amount || 0;
  const moraDays = payment.late_interest_days || 0;
  const moraWaived = !!payment.late_interest_waived;
  const hasMora = moraAmount > 0;

  return (
    <div>
      <PageHeader
        title={`Pago #${payment.id}`}
        subtitle={`${payment.contract_number} · ${payment.payer_name}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            {!payment.is_cancelled && (
              <Button variant="outline" onClick={() => setEmitOpen(true)}>
                <FilePlus2 className="h-4 w-4" />
                Emitir boleta / factura
              </Button>
            )}
            {!payment.is_cancelled && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                <XCircle className="h-4 w-4" />
                Anular pago
              </Button>
            )}
          </div>
        }
      />

      {/* Resumen */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monto cobrado"
          value={formatSoles(payment.amount)}
          icon={<ReceiptText className="h-5 w-5" />}
          accent="#0d7a44"
        />
        <StatCard
          label="Fecha"
          value={formatDate(payment.payment_date)}
          icon={<ReceiptText className="h-5 w-5" />}
          accent="#3b82f6"
        />
        <StatCard
          label="Método"
          value={PAYMENT_METHODS[payment.payment_method as keyof typeof PAYMENT_METHODS] || payment.payment_method}
          icon={<ReceiptText className="h-5 w-5" />}
          accent="#8b5cf6"
        />
        <StatCard
          label="Estado"
          value={payment.is_cancelled ? "Anulado" : "Registrado"}
          icon={<ReceiptText className="h-5 w-5" />}
          accent={payment.is_cancelled ? "#dc2626" : "#16a34a"}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold text-netland-dark">
            Datos del pago
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoItem label="Propietario" value={payment.payer_name} />
            <InfoItem label="Contrato" value={payment.contract_number} />
            <InfoItem label="Monto cobrado" value={formatSoles(payment.amount)} />
            <InfoItem label="Aplicado a cuotas" value={formatSoles(totalApplied)} />
            <InfoItem label="Fecha de pago" value={formatDate(payment.payment_date)} />
            <InfoItem label="Método" value={PAYMENT_METHODS[payment.payment_method as keyof typeof PAYMENT_METHODS] || payment.payment_method} />
            <InfoItem label="Transacción" value={payment.transaction_number || "—"} />
            <InfoItem label="Banco" value={payment.bank_name || "—"} />
            <InfoItem label="Observaciones" value={payment.notes || "—"} />
            {moraWaived || hasMora ? (
              <>
                <InfoItem
                  label="Días de atraso (máx.)"
                  value={
                    moraWaived
                      ? `${moraDays} ${moraDays === 1 ? "día" : "días"} (exonerado)`
                      : `${moraDays} ${moraDays === 1 ? "día" : "días"}`
                  }
                />
                <InfoItem
                  label="Interés de mora"
                  value={
                    moraWaived
                      ? "Exonerado"
                      : formatSoles(moraAmount)
                  }
                />
              </>
            ) : (
              <InfoItem label="Interés de mora" value="Sin atraso" />
            )}
          </dl>

          {hasMora && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    Interés de mora cobrado
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700">
                    {moraDays} {moraDays === 1 ? "día" : "días"} de atraso · incluido en
                    el monto cobrado
                  </p>
                </div>
                <span className="text-lg font-bold text-amber-700">
                  {formatSoles(moraAmount)}
                </span>
              </div>
            </div>
          )}
          {moraWaived && moraDays > 0 && !hasMora && (
            <div className="mt-4 rounded-xl border border-netland-muted/20 bg-netland-light/40 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-netland-dark">
                    Mora exonerada
                  </p>
                  <p className="mt-0.5 text-xs text-netland-muted">
                    {moraDays} {moraDays === 1 ? "día" : "días"} de atraso sin cargo de
                    recargo
                  </p>
                </div>
                <span className="text-lg font-bold text-netland-muted">S/ 0.00</span>
              </div>
            </div>
          )}
          {!moraWaived &&
            !hasMora &&
            payment.allocations.some((a) => a.due_date < payment.payment_date) && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-900">
                  Pago registrado sin interés de mora
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Este pago se registró sin cargo de mora, aunque al pagar ya había
                  cuotas vencidas. Los pagos nuevos calculan la mora automáticamente.
                </p>
              </div>
            )}

          {payment.receipt_url && (
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => window.open(payment.receipt_url!, "_blank")}
              >
                <Download className="h-4 w-4" />
                Ver comprobante
              </Button>
            </div>
          )}

          {payment.is_cancelled && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">Pago anulado</p>
              <p className="mt-1 text-sm text-red-600">
                {payment.cancellation_reason || "Sin motivo registrado"}
              </p>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold text-netland-dark">
            Aplicación del pago
          </h2>
          {payment.allocations.length === 0 ? (
            <p className="text-sm text-netland-muted">
              No se aplicó a cuotas específicas (pago al contado o distribución automática).
            </p>
          ) : (
            <Table
              headers={["Cuota", "Vencimiento", "Días atraso", "Interés", "Monto aplicado"]}
            >
              {payment.allocations.map((alloc) => (
                  <tr key={alloc.installment_id} className="hover:bg-netland-light/30">
                    <td className="px-5 py-2.5 font-semibold">
                      {String(alloc.installment_number).padStart(2, "0")}
                    </td>
                    <td className="px-5 py-2.5 text-sm">{formatDate(alloc.due_date)}</td>
                    <td className="px-5 py-2.5 text-sm">
                      {alloc.late_days > 0
                        ? payment.late_interest_waived
                          ? `${alloc.late_days} (exonerado)`
                          : alloc.late_days
                        : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-sm">
                      {alloc.late_interest > 0
                        ? payment.late_interest_waived
                          ? "Exonerado"
                          : formatSoles(alloc.late_interest)
                        : "—"}
                    </td>
                    <td className="px-5 py-2.5 font-medium text-netland-primary">
                      {formatSoles(alloc.allocated_amount)}
                    </td>
                  </tr>
                ))}
              <tr className="border-t-2 border-netland-light bg-netland-light/40 font-semibold text-netland-dark">
                <td className="px-5 py-2.5" colSpan={2}>
                  Total aplicado a cuotas
                </td>
                <td className="px-5 py-2.5 text-sm">
                  {moraWaived || hasMora
                    ? `${moraDays} ${moraDays === 1 ? "día" : "días"}`
                    : "—"}
                </td>
                <td className="px-5 py-2.5 text-sm">
                  {hasMora ? formatSoles(moraAmount) : moraWaived ? "Exonerado" : "—"}
                </td>
                <td className="px-5 py-2.5">{formatSoles(totalApplied)}</td>
              </tr>
              {hasMora && (
                <tr className="bg-amber-50 font-bold text-amber-900">
                  <td className="px-5 py-2.5" colSpan={4}>
                    Monto cobrado (cuotas + mora)
                  </td>
                  <td className="px-5 py-2.5">{formatSoles(payment.amount)}</td>
                </tr>
              )}
            </Table>
          )}
        </Card>
      </div>

      <div className="mb-6 text-sm">
        <Link
          to={`/admin/contratos/${payment.contract_id}`}
          className="font-medium text-netland-primary hover:underline"
        >
          ← Volver al contrato {payment.contract_number}
        </Link>
      </div>

      {/* Comprobantes emitidos de este pago */}
      <Card className="mb-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-netland-dark">
          Comprobantes de este pago
        </h2>
        {paymentDocs.length === 0 ? (
          <p className="text-sm text-netland-muted">
            Aún no se emitieron boletas ni facturas para este pago. Usa el botón{" "}
            <span className="font-medium">Emitir boleta / factura</span> para generar el
            comprobante.
          </p>
        ) : (
          <Table headers={["Tipo", "Documento", "Descripción", "Fecha", "Acciones"]}>
            {paymentDocs.map((doc) => (
              <tr key={doc.id} className="hover:bg-netland-light/30">
                <td className="px-5 py-2.5">
                  <Badge color="#0891b2">
                    {DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                  </Badge>
                </td>
                <td className="px-5 py-2.5 font-semibold text-netland-dark">
                  {doc.document_name}
                </td>
                <td className="px-5 py-2.5 text-sm text-netland-muted">
                  {doc.description || "—"}
                </td>
                <td className="px-5 py-2.5 text-sm">{formatDate(doc.uploaded_at)}</td>
                <td className="px-5 py-2.5">
                  {doc.file_url && (
                    <Button
                      variant="outline"
                      className="!px-2.5 !py-1.5"
                      title="Abrir documento"
                      onClick={() => window.open(doc.file_url!, "_blank")}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Modal de anulación */}
      {cancelOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setCancelOpen(false)}
        >
          <div
            className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-semibold text-netland-dark">
              Anular pago
            </h3>
            <p className="mt-1 text-sm text-netland-muted">
              Al anular el pago se revertirán las cuotas y saldos afectados.
              {` Monto: ${formatSoles(payment.amount)}`}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo de la anulación (mínimo 10 caracteres)"
              rows={4}
              className="mt-4 w-full rounded-xl border border-netland-light px-4 py-3 text-sm focus:border-netland-primary focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCancelOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={reason.trim().length < 10 || cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                {cancelMutation.isPending ? "Anulando..." : "Confirmar anulación"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de emisión de boleta/factura */}
      <Modal
        open={emitOpen}
        onClose={() => setEmitOpen(false)}
        title={`Emitir comprobante · Pago #${payment.id}`}
      >
        <div className="space-y-4 p-6">
          <div className="rounded-xl border border-netland-light bg-netland-light/30 px-4 py-3 text-sm text-netland-dark">
            Se emitirá el comprobante del{" "}
            <span className="font-semibold">Pago #{payment.id}</span> por{" "}
            <span className="font-semibold">{formatSoles(payment.amount)}</span> con las
            cuotas y mora de ese pago.
          </div>
          <Field label="Tipo de documento">
            <Select
              value={emitForm.document_type}
              onChange={(e) => setEmitForm({ ...emitForm, document_type: e.target.value })}
            >
              <option value="boleta">Boleta</option>
              <option value="factura">Factura</option>
            </Select>
          </Field>
          <Field label="Descripción (opcional)">
            <Input
              value={emitForm.description}
              onChange={(e) => setEmitForm({ ...emitForm, description: e.target.value })}
              placeholder={`Ej: Comprobante del Pago #${payment.id}`}
            />
          </Field>
          {emitMutation.isError && (
            <p className="text-sm text-red-600">
              {emitMutation.error instanceof Error
                ? emitMutation.error.message
                : "Error al emitir el documento"}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEmitOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => emitMutation.mutate(emitForm)}
              disabled={emitMutation.isPending}
            >
              {emitMutation.isPending
                ? "Emitiendo..."
                : `Emitir y descargar · ${DOCUMENT_TYPE_LABELS[emitForm.document_type] ?? emitForm.document_type}`}
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