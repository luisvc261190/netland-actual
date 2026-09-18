import { useEffect } from "react";
import { AlertTriangle, CheckCircle, X } from "lucide-react";
import { formatDate, formatSoles } from "../constants";

export interface LateInterestRow {
  installment_number: number;
  due_date: string;
  days: number;
  interest: number;
}

interface LateInterestConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  rows: LateInterestRow[];
  cuotaAmount: number;
  totalToCollect: number;
  dailyRate: number;
  confirming?: boolean;
}

export function LateInterestConfirmDialog({
  open,
  onClose,
  onConfirm,
  rows,
  cuotaAmount,
  totalToCollect,
  dailyRate,
  confirming = false,
}: LateInterestConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const totalInterest = rows.reduce((sum, r) => sum + r.interest, 0);
  const maxDays = rows.reduce((max, r) => Math.max(max, r.days), 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar cobro de interés de mora"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-netland-dark/50 p-4 backdrop-blur-sm"
      onClick={confirming ? undefined : onClose}
    >
      <div
        className="animate-fadeUp w-full max-w-md overflow-hidden rounded-2xl border border-netland-muted/15 bg-white shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-start gap-4 border-b border-netland-light bg-amber-50 px-6 py-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-semibold text-netland-dark">
              Cobro de interés de mora
            </h3>
            <p className="mt-0.5 text-sm text-netland-muted">
              El pago está pausado porque hay cuotas vencidas y el cliente no está
              exonerado de la mora.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            aria-label="Cerrar"
            className="rounded-md p-1 text-netland-muted transition-colors hover:bg-netland-light hover:text-netland-dark"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="max-h-[55vh] space-y-4 overflow-y-auto px-6 py-4">
          <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm">
            <span className="text-amber-800">Tasa de mora</span>
            <span className="font-semibold text-amber-900">
              {formatSoles(dailyRate)}/día
            </span>
          </div>

          {rows.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-netland-light">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-netland-light/60 text-left text-[11px] uppercase tracking-wide text-netland-muted">
                    <th className="px-3 py-2">Cuota</th>
                    <th className="px-3 py-2">Vencimiento</th>
                    <th className="px-3 py-2 text-right">Días de atraso</th>
                    <th className="px-3 py-2 text-right">Mora</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.installment_number}
                      className="border-t border-netland-light/70"
                    >
                      <td className="px-3 py-2 font-semibold text-netland-dark">
                        {String(row.installment_number).padStart(2, "0")}
                      </td>
                      <td className="px-3 py-2 text-neutral-600">
                        {formatDate(row.due_date)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-red-600">
                        {row.days} {row.days === 1 ? "día" : "días"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-700">
                        {formatSoles(row.interest)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-netland-light bg-netland-light/30 font-semibold text-netland-dark">
                    <td className="px-3 py-2" colSpan={3}>
                      Interés de mora
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-amber-700">
                      {formatSoles(totalInterest)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-amber-800">Aplicado a las cuotas</span>
              <span className="font-semibold text-netland-dark">
                {formatSoles(cuotaAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-800">Interés de mora</span>
              <span className="font-semibold text-amber-700">
                {formatSoles(totalInterest)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-amber-200 pt-1">
              <span className="font-bold text-amber-900">Total a cobrar al cliente</span>
              <span className="text-base font-bold text-netland-primary">
                {formatSoles(totalToCollect)}
              </span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-netland-muted">
            Si el cliente no pagará la mora por el atraso de{" "}
            <span className="font-semibold">
              {maxDays} {maxDays === 1 ? "día" : "días"}
            </span>
            , selecciona{" "}
            <span className="font-semibold">“Exonerar mora”</span> en el formulario
            de pago para cobrar solo el monto de las cuotas.
          </p>
        </div>

        {/* Pie */}
        <div className="flex justify-end gap-3 border-t border-netland-light px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="rounded-lg border border-netland-muted/20 px-4 py-2 text-sm font-medium text-netland-dark transition-colors hover:bg-netland-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle className="h-4 w-4" />
            {confirming ? "Registrando..." : "Cobrar mora y registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}