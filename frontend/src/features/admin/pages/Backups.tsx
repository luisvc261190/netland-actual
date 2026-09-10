import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  CloudUpload,
  Database,
  Download,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { api, authStorage } from "../../../lib/api";
import { API_URL } from "../../../lib/constants";
import type { Backup } from "../../../types";
import { Badge, Button, Card, PageHeader, StatCard, Table } from "../ui";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";

interface BackupDetail extends Backup {
  url: string;
}

interface RestoreResult {
  restored_tables: Record<string, number>;
  total_rows: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function uploadRestore(file: File): Promise<RestoreResult> {
  const token = authStorage.getToken();
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_URL}/backups/restore`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || "Error al restaurar el respaldo.");
  }
  return body as RestoreResult;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

export default function AdminBackups() {
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);

  const { data: backups } = useQuery({
    queryKey: ["backups-admin"],
    queryFn: () => api.get<Backup[]>("/backups", true),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<BackupDetail>("/backups", {}, true),
    onSuccess: (backup) => {
      queryClient.invalidateQueries({ queryKey: ["backups-admin"] });
      toast(`Respaldo "${backup.filename}" generado.`);
    },
    onError: (e) => toast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/backups/${id}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backups-admin"] });
      toast("Respaldo eliminado.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const latest = backups?.[0];
  const totalRows = backups?.reduce((sum, b) => sum + b.total_rows, 0) ?? 0;

  const handleDownload = async (id: number) => {
    try {
      const detail = await api.get<BackupDetail>(`/backups/${id}`, true);
      window.open(detail.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const handleRestoreFile = async (file: File) => {
    const approved = await confirm({
      title: "Restaurar respaldo",
      message:
        "Se reemplazarán TODOS los datos actuales del sistema por los contenidos en el respaldo seleccionado. Esta acción no se puede deshacer.",
      confirmText: "Restaurar",
      cancelText: "Cancelar",
      danger: true,
    });
    if (!approved) return;

    setRestoring(true);
    try {
      const result = await uploadRestore(file);
      queryClient.invalidateQueries({ queryKey: ["backups-admin"] });
      toast(
        `Restauración exitosa: ${result.total_rows} filas en ${Object.keys(result.restored_tables).length} tablas.`
      );
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <PageHeader
        title="Backups"
        subtitle="Respaldo y restauración de toda la base de datos (solo Super Administrador)."
        action={
          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleRestoreFile(file);
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={restoring}
            >
              {restoring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              Restaurar respaldo
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Generar respaldo
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Respaldos almacenados"
          value={backups?.length ?? "—"}
          icon={<Database className="h-5 w-5" />}
        />
        <StatCard
          label="Último respaldo"
          value={
            latest
              ? new Date(latest.created_at).toLocaleDateString("es-PE")
              : "—"
          }
          icon={<Database className="h-5 w-5" />}
          accent="#0d9488"
        />
        <StatCard
          label="Filas respaldadas (total)"
          value={totalRows.toLocaleString("es-PE")}
          icon={<Database className="h-5 w-5" />}
          accent="#4f46e5"
        />
      </div>

      {!backups || backups.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin respaldos"
            description="Genera tu primer respaldo para proteger la información del sistema."
          />
        </Card>
      ) : (
        <Table
          headers={["Archivo", "Fecha", "Tamaño", "Tablas", "Filas", "Estado", "Acciones"]}
        >
          {backups.map((backup) => (
            <tr key={backup.id} className="hover:bg-netland-light/30">
              <td className="px-5 py-3 font-medium text-netland-dark">{backup.filename}</td>
              <td className="px-5 py-3 text-netland-muted">
                {new Date(backup.created_at).toLocaleString("es-PE")}
              </td>
              <td className="px-5 py-3 text-netland-muted">{formatSize(backup.size_bytes)}</td>
              <td className="px-5 py-3 text-netland-muted">{backup.tables_count}</td>
              <td className="px-5 py-3 text-netland-muted">{backup.total_rows}</td>
              <td className="px-5 py-3">
                <Badge color={backup.status === "completed" ? "#16a34a" : "#d97706"}>
                  {backup.status}
                </Badge>
              </td>
              <td className="px-5 py-3">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="!px-2.5 !py-1.5"
                    onClick={() => handleDownload(backup.id)}
                    aria-label="Descargar respaldo"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="danger"
                    className="!px-2.5 !py-1.5"
                    onClick={async () => {
                      if (await confirm(`¿Eliminar el respaldo "${backup.filename}"?`)) {
                        deleteMutation.mutate(backup.id);
                      }
                    }}
                    aria-label="Eliminar respaldo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}