import { useEffect, useState } from "react";
import { Button, Field, Input, Select, Textarea } from "../../admin/ui";
import { Modal } from "../../../components/ui/Modal";
import { COMMISSION_PAYMENT_METHODS, COMMISSION_PAYMENT_METHOD_LABELS, formatMoney } from "../constants";
import type { PayPayload } from "../types";
import type { CommissionPayment } from "../../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  record: CommissionPayment | null;
  onConfirm: (payload: PayPayload) => void;
  isSubmitting: boolean;
}

export default function PayModal({ open, onClose, record, onConfirm, isSubmitting }: Props) {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("transferencia");
  const [transactionNumber, setTransactionNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!open || !record) return;
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setMethod("transferencia");
    setTransactionNumber("");
    setNotes("");
    setAmount(String(record.balance));
  }, [open, record]);

  if (!record) return null;

  const remaining = record.balance;
  const isPartial = remaining < record.amount;

  return (
    <Modal open={open} onClose={onClose} title={isPartial ? "Registrar pago parcial" : "Registrar pago de comisión"}>
      <div className="space-y-4 p-6">
        <div className="rounded-lg bg-gray-50 p-4 text-sm space-y-1">
          <p className="font-semibold text-netland-dark">{record.advisor_name}</p>
          <p className="text-netland-muted">{record.document_type} {record.document_number}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <p className="text-lg font-bold text-netland-primary">{formatMoney(record.amount)}</p>
            {isPartial && (
              <>
                <p className="text-netland-muted">Pagado: <span className="font-semibold text-netland-dark">{formatMoney(record.amount_paid)}</span></p>
                <p className="text-netland-muted">Saldo: <span className="font-semibold text-amber-600">{formatMoney(remaining)}</span></p>
              </>
            )}
          </div>
          <p className="text-netland-muted text-xs">{record.concept}</p>
        </div>

        <Field label="Monto a pagar (S/)" hint={isPartial ? `Saldo pendiente: ${formatMoney(remaining)}. Indica un monto menor para un pago parcial.` : "Por defecto se paga el total."}>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(remaining)}
          />
        </Field>

        <Field label="Fecha de pago">
          <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        </Field>

        <Field label="Método de pago">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {COMMISSION_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{COMMISSION_PAYMENT_METHOD_LABELS[m] ?? m}</option>
            ))}
          </Select>
        </Field>

        <Field label="N° de operación / transacción">
          <Input
            value={transactionNumber}
            onChange={(e) => setTransactionNumber(e.target.value)}
            placeholder="Opcional"
          />
        </Field>

        <Field label="Nota del pago">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional..." />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onConfirm({
              amount: Number(amount) || undefined,
              payment_date: paymentDate,
              payment_method: method,
              transaction_number: transactionNumber || undefined,
              notes: notes || undefined,
            })}
            disabled={isSubmitting || !(Number(amount) > 0)}
          >
            Confirmar pago
          </Button>
        </div>
      </div>
    </Modal>
  );
}