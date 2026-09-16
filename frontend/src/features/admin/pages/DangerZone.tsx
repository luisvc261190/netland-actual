import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useToast } from "../../../components/ui/Toast";
import { Modal } from "../../../components/ui/Modal";
import { api } from "../../../lib/api";

const CONFIRM_TEXT = "BORRAR TODO";

interface DeletedRow {
  tabla: string;
  eliminados: number;
}

interface ResetResult {
  message: string;
  deleted_rows: number;
  deleted_tables: DeletedRow[];
}

export function DangerZone() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const resetMutation = useMutation({
    mutationFn: () => api.post<ResetResult>("/admin/reset-business-data", {}, true),
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      setOpen(false);
      setInput("");
      toast(data.message, "success");
    },
    onError: (error: Error) => {
      toast(error.message, "error");
    },
  });

  const cleanedInput = input.trim().toUpperCase();
  const canConfirm = cleanedInput === CONFIRM_TEXT;

  const closeModal = () => {
    setOpen(false);
    setInput("");
  };

  return (
    <div className="rounded-xl border-2 border-red-200 bg-red-50/60 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-red-900">Zona de peligro — Restablecer datos</h2>
          <p className="mt-1 text-sm text-red-700">
            Elimina <strong>todos</strong> los datos de negocio del sistema para poder
            recrearlos desde cero. Esta acción es{" "}
            <strong>irreversible</strong>.
          </p>
          <p className="mt-2 text-sm text-red-600">
            Se eliminan: propietarios, contratos, pagos, cronogramas, leads, clientes, cotizaciones,
            visitas, asesores, comisiones, anuncios, notificaciones y auditoría.
          </p>
          <p className="mt-2 text-sm font-medium text-green-700">
            Se conservan intactos: proyectos, bloques, lotes, usuarios, roles, configuración y respaldos.
          </p>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Restablecer datos
          </button>
        </div>
      </div>

      <Modal open={open} onClose={closeModal} title="Confirmación requerida">
        <div className="space-y-4 p-6">
          <p className="text-sm text-netland-muted">
            Esta acción eliminará permanentemente todos los datos de negocio del sistema. Los
            proyectos, lotes, usuarios, roles, configuración y respaldos no se verán afectados.
          </p>

          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <label className="block text-sm font-semibold text-red-800">
              Escribe <span className="font-mono">{CONFIRM_TEXT}</span> para confirmar:
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={CONFIRM_TEXT}
              className="mt-2 w-full rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-netland-light pt-4">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg border border-netland-muted/20 px-4 py-2 text-sm font-medium text-netland-dark transition-colors hover:bg-netland-light"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canConfirm || resetMutation.isPending}
              onClick={() => resetMutation.mutate()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resetMutation.isPending ? "Eliminando..." : "Eliminar todo"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}