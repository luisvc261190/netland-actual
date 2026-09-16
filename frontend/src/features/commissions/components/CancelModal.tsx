import { useState } from "react";
import { Button, Field, Textarea } from "../../admin/ui";
import { Modal } from "../../../components/ui/Modal";
import { formatMoney } from "../constants";
import type { CommissionPayment } from "../../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  record: CommissionPayment | null;
  onConfirm: (reason: string) => void;
  isSubmitting: boolean;
}

export default function CancelModal({ open, onClose, record, onConfirm, isSubmitting }: Props) {
  const [reason, setReason] = useState("");

  if (!record) return null;

  return (
    <Modal open={open} onClose={onClose} title="Anular registro de comisión">
      <div className="space-y-4 p-6">
        <div className="rounded-lg bg-gray-50 p-4 text-sm space-y-1">
          <p className="font-semibold text-netland-dark">{record.advisor_name}</p>
          <p className="text-netland-muted">{record.document_type} {record.document_number}</p>
          <p className="mt-2 text-lg font-bold text-netland-primary">{formatMoney(record.amount)}</p>
          <p className="text-netland-muted text-xs">{record.concept}</p>
        </div>

        <Field label="Motivo de anulación (requerido)" hint="Describe el motivo de la anulación para auditoría.">
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo de la anulación..."
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(reason)}
            disabled={isSubmitting || reason.trim().length < 3}
          >
            Confirmar anulación
          </Button>
        </div>
      </div>
    </Modal>
  );
}