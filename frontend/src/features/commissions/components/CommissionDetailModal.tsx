import type { ReactNode } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Badge } from "../../admin/ui";
import {
  COMMISSION_PAYMENT_METHOD_LABELS,
  COMMISSION_STATUS_COLORS,
  COMMISSION_STATUS_LABELS,
  formatMoney,
} from "../constants";
import type { CommissionPayment } from "../../../types";

interface Props {
  record: CommissionPayment | null;
  onClose: () => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-netland-muted">{label}</p>
      <p className="mt-0.5 text-sm text-netland-dark">{value || "—"}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 border-b border-netland-light/60 pb-1 text-xs font-semibold uppercase tracking-wider text-netland-muted">
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export default function CommissionDetailModal({ record, onClose }: Props) {
  if (!record) return null;

  const isComision = record.payment_type === "comision";
  const isAnulado = record.payment_status === "anulado";
  const notesLines = (record.notes || "").split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <Modal
      open={!!record}
      onClose={onClose}
      title={isComision ? "Detalle de comisión" : "Detalle de mensualidad"}
      wide
    >
      <div className="space-y-5 p-6">
        {/* Cabecera */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-lg font-semibold text-netland-dark">{record.advisor_name}</p>
            <Badge color={COMMISSION_STATUS_COLORS[record.payment_status] ?? "#6b7280"}>
              {COMMISSION_STATUS_LABELS[record.payment_status] ?? record.payment_status}
            </Badge>
            <span
              title={record.origin === "auto" ? "Generada automáticamente al registrar la venta" : "Registrada manualmente"}
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                record.origin === "auto" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              {record.origin === "auto" ? "Auto" : "Manual"}
            </span>
          </div>
          <p className="mt-1 text-sm text-netland-muted">{record.concept}</p>
        </div>

        {/* Resumen de montos */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-netland-muted">Monto total</p>
            <p className="mt-1 font-display text-xl font-semibold text-netland-dark">{formatMoney(record.amount)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-netland-muted">Pagado</p>
            <p className="mt-1 font-display text-xl font-semibold text-green-600">{formatMoney(record.amount_paid)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-netland-muted">Saldo pendiente</p>
            <p className={`mt-1 font-display text-xl font-semibold ${record.balance > 0 ? "text-amber-600" : "text-netland-dark"}`}>
              {formatMoney(record.balance)}
            </p>
          </div>
        </div>

        {/* Asesor */}
        <Section title="Asesor">
          <DetailItem label="Documento" value={`${record.document_type} ${record.document_number}`} />
          <DetailItem label="Banco" value={record.bank_name} />
          <DetailItem label="Cuenta / N°" value={record.account_number} />
          <DetailItem label="Período" value={record.payment_period} />
        </Section>

        {/* Comisión */}
        {isComision && (
          <Section title="Comisión">
            <DetailItem label="Contrato" value={record.contract_number} />
            <DetailItem label="Proyecto" value={record.project_name} />
            <DetailItem label="Monto base" value={formatMoney(record.base_amount)} />
            <DetailItem label="Porcentaje" value={record.percent_applied != null ? `${record.percent_applied}%` : null} />
          </Section>
        )}

        {/* Pago */}
        <Section title="Registro de pago">
          <DetailItem label="Estado" value={COMMISSION_STATUS_LABELS[record.payment_status] ?? record.payment_status} />
          <DetailItem label="Fecha de pago" value={formatDate(record.payment_date)} />
          <DetailItem
            label="Método"
            value={record.payment_method ? (COMMISSION_PAYMENT_METHOD_LABELS[record.payment_method] ?? record.payment_method) : null}
          />
          <DetailItem label="N° de operación" value={record.transaction_number} />
          <DetailItem label="Registrado" value={formatDate(record.created_at)} />
          <DetailItem label="Actualizado" value={formatDate(record.updated_at)} />
        </Section>

        {/* Anulación */}
        {isAnulado && (
          <Section title="Anulación">
            <DetailItem label="Fecha" value={formatDate(record.cancelled_at)} />
            <DetailItem label="Motivo" value={record.cancellation_reason} />
          </Section>
        )}

        {/* Notas / historial de pagos */}
        {notesLines.length > 0 && (
          <div>
            <h3 className="mb-2 border-b border-netland-light/60 pb-1 text-xs font-semibold uppercase tracking-wider text-netland-muted">
              Notas e historial de pagos
            </h3>
            <ul className="space-y-1.5">
              {notesLines.map((line, idx) => {
                const isPaymentLine = /^Pago de S\//.test(line);
                return (
                  <li
                    key={idx}
                    className={`text-sm ${isPaymentLine ? "font-medium text-netland-dark" : "text-netland-muted"}`}
                  >
                    {isPaymentLine ? "• " : ""}
                    {line}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}