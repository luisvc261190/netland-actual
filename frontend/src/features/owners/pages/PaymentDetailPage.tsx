import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, XCircle, Download, ReceiptText } from "lucide-react";
import { api } from "../../../lib/api";
import {
  PageHeader,
  Button,
  Card,
  Table,
  StatCard,
} from "../../admin/ui";
import { useToast } from "../../../components/ui/Toast";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { PaymentDetail } from "../types";
import {
  PAYMENT_METHODS,
  formatSoles,
  formatDate,
} from "../constants";

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const paymentId = Number(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const { data: payment, isLoading } = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => api.get<PaymentDetail>(`/payments/${paymentId}`, true),
    enabled: !!paymentId,
  });

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
          label="Monto"
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
            <InfoItem label="Monto" value={formatSoles(payment.amount)} />
            <InfoItem label="Fecha de pago" value={formatDate(payment.payment_date)} />
            <InfoItem label="Método" value={PAYMENT_METHODS[payment.payment_method as keyof typeof PAYMENT_METHODS] || payment.payment_method} />
            <InfoItem label="Transacción" value={payment.transaction_number || "—"} />
            <InfoItem label="Banco" value={payment.bank_name || "—"} />
            <InfoItem label="Observaciones" value={payment.notes || "—"} />
          </dl>

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
              headers={["Cuota", "Vencimiento", "Monto aplicado"]}
            >
              {payment.allocations.map((alloc) => (
                  <tr key={alloc.installment_id} className="hover:bg-netland-light/30">
                    <td className="px-5 py-2.5 font-semibold">
                      {String(alloc.installment_number).padStart(2, "0")}
                    </td>
                    <td className="px-5 py-2.5 text-sm">{formatDate(alloc.due_date)}</td>
                    <td className="px-5 py-2.5 font-medium text-netland-primary">
                      {formatSoles(alloc.allocated_amount)}
                    </td>
                  </tr>
                ))}
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