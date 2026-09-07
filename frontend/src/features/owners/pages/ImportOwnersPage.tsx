import { useState } from "react";
import {
  Upload,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Repeat,
} from "lucide-react";
import { authStorage } from "../../../lib/api";
import { API_URL } from "../../../lib/constants";
import { PageHeader, Button, Card, Field, Select, Badge, Table } from "../../admin/ui";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { useToast } from "../../../components/ui/Toast";

interface ImportPreview {
  batch_id: number;
  file_name: string;
  total_rows: number;
  valid_rows: number;
  import_type: string;
  columns: string[];
  mapping: Record<string, string>;
  preview_rows: Array<Record<string, string>>;
  errors: Array<{ row: number; message: string }>;
}

interface ImportResult {
  batch_id: number;
  import_type: string;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
  warnings: string[];
}

const OWNER_FIELDS: Array<{ value: string; label: string }> = [
  { value: "document_number", label: "Documento (obligatorio)" },
  { value: "document_type", label: "Tipo de documento" },
  { value: "first_name", label: "Nombres" },
  { value: "paternal_surname", label: "Apellido paterno" },
  { value: "maternal_surname", label: "Apellido materno" },
  { value: "business_name", label: "Razón social" },
  { value: "phone", label: "Teléfono" },
  { value: "email", label: "Correo" },
  { value: "address", label: "Dirección" },
  { value: "district", label: "Distrito" },
  { value: "province", label: "Provincia" },
  { value: "department", label: "Departamento" },
  { value: "birth_date", label: "Fecha de nacimiento" },
];

async function uploadFile(path: string, file: File): Promise<ImportPreview> {
  const form = new FormData();
  form.append("file", file);
  const token = authStorage.getToken();
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.detail || "Error al subir el archivo");
  }
  return body;
}

async function downloadFile(path: string, filename: string) {
  const token = authStorage.getToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Error al descargar el archivo");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportOwnersPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleUpload = async () => {
    if (!file) {
      toast("Selecciona un archivo Excel (.xlsx, .xls o .csv)", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await uploadFile("/owners/import/preview", file);
      setPreview(res);
      setMapping(res.mapping || {});
      setStep(2);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Error al procesar el archivo", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const token = authStorage.getToken();
      const response = await fetch(`${API_URL}/owners/import/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ batch_id: preview.batch_id, mapping }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.detail || "Error al confirmar la importación");
      }
      setResult(body);
      setStep(3);
      toast("Importación completada");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Error al importar", "error");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setFile(null);
    setPreview(null);
    setResult(null);
    setMapping({});
  };

  const hasDocumentNumber = Object.values(mapping).includes("document_number");

  return (
    <div>
      <PageHeader
        title="Importar propietarios"
        subtitle="Carga masiva desde Excel en 3 pasos"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadFile("/owners/import/template", "plantilla-propietarios.xlsx")}>
              <FileSpreadsheet className="h-4 w-4" />
              Ver plantilla
            </Button>
          </div>
        }
      />

      {/* Indicador de pasos */}
      <div className="mb-6 flex items-center gap-2 text-sm font-medium">
        {[
          { n: 1, label: "Subir archivo" },
          { n: 2, label: "Mapear columnas" },
          { n: 3, label: "Resultado" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <span className="text-netland-muted">→</span>}
            <span
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 ${
                step === s.n
                  ? "bg-netland-primary text-white"
                  : step > s.n
                    ? "bg-green-50 text-green-700"
                    : "bg-netland-light text-netland-muted"
              }`}
            >
              {step > s.n ? <CheckCircle2 className="h-4 w-4" /> : null}
              {s.n}. {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* PASO 1: Subir archivo */}
      {step === 1 && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-netland-primary/10">
              <Upload className="h-8 w-8 text-netland-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-netland-dark">
                Sube tu archivo Excel
              </h2>
              <p className="mt-1 text-sm text-netland-muted">
                Formato: .xlsx, .xls o .csv. Descarga la plantilla para ver las columnas
                sugeridas.
              </p>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="max-w-sm text-sm"
            />
            {file && (
              <p className="text-sm text-netland-muted">
                Archivo seleccionado: <strong className="text-netland-dark">{file.name}</strong>
              </p>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => downloadFile("/owners/export", "propietarios.xlsx")}>
                <Download className="h-4 w-4" />
                Exportar actuales
              </Button>
              <Button disabled={loading} onClick={handleUpload}>
                {loading ? "Procesando..." : (
                  <>
                    Subir y previsualizar <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* PASO 2: Mapeo y previsualización */}
      {step === 2 && preview && (
        <div className="space-y-6">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-netland-dark">
                Mapeo de columnas
              </h2>
              <div className="flex gap-2 text-sm">
                <Badge color="#0d7a44">{preview.total_rows} filas</Badge>
                <Badge color="#16a34a">{preview.valid_rows} válidas</Badge>
                <Badge color="#dc2626">{preview.errors.length} con errores</Badge>
              </div>
            </div>
            <p className="mb-4 text-sm text-netland-muted">
              Verifica que cada columna del archivo esté asignada al campo correcto del
              sistema. Ajusta los selectores si es necesario.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {preview.columns.map((col) => (
                <Field key={col} label={col}>
                  <Select
                    value={mapping[col] || ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [col]: e.target.value }))}
                  >
                    <option value="">— No importar —</option>
                    {OWNER_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
            {!hasDocumentNumber && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Al menos una columna debe asignarse a <strong>&nbsp;Documento (obligatorio)</strong>.
              </div>
            )}
            <div className="mt-5 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" /> Subir otro archivo
              </Button>
              <Button disabled={loading || !hasDocumentNumber} onClick={handleConfirm}>
                {loading ? "Importando..." : "Confirmar importación"}
              </Button>
            </div>
          </Card>

          {preview.errors.length > 0 && (
            <Card>
              <h2 className="mb-3 font-display text-lg font-semibold text-netland-dark">
                Errores detectados
              </h2>
              <ul className="space-y-1 text-sm text-red-700">
                {preview.errors.slice(0, 50).map((err) => (
                  <li key={`${err.row}-${err.message}`} className="flex gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Fila {err.row}: {err.message}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {preview.preview_rows.length > 0 && (
            <Card>
              <h2 className="mb-4 font-display text-lg font-semibold text-netland-dark">
                Vista previa (primeras {preview.preview_rows.length} filas)
              </h2>
              <Table headers={preview.columns}>
                {preview.preview_rows.map((row, i) => (
                  <tr key={i} className="hover:bg-netland-light/30">
                    {preview.columns.map((col) => (
                      <td key={col} className="px-5 py-2.5 text-sm">
                        {formatPreviewValue(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* PASO 3: Resultado */}
      {step === 3 && result && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-semibold text-netland-dark">
                  Importación completada
                </h2>
                <p className="mt-1 text-sm text-netland-muted">
                  Archivo: {preview?.file_name} · Lote #{result.batch_id}
                </p>
              </div>
              <div className="grid w-full max-w-lg gap-3 sm:grid-cols-3">
                <ResultBox label="Importados" value={result.imported} color="#16a34a" />
                <ResultBox label="Omitidos" value={result.skipped} color="#f59e0b" />
                <ResultBox label="Con errores" value={result.failed} color="#dc2626" />
              </div>
              {result.warnings.length > 0 && (
                <div className="w-full max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
                  <p className="mb-2 text-xs font-semibold uppercase text-amber-700">Advertencias</p>
                  <ul className="space-y-1 text-sm text-amber-800">
                    {result.warnings.slice(0, 30).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="w-full max-w-2xl rounded-xl border border-red-200 bg-red-50 p-4 text-left">
                  <p className="mb-2 text-xs font-semibold uppercase text-red-700">Errores</p>
                  <ul className="space-y-1 text-sm text-red-800">
                    {result.errors.slice(0, 30).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-3">
                <Button onClick={reset}>
                  <Repeat className="h-4 w-4" /> Importar otro archivo
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {loading && step === 1 && (
        <div className="mt-6 py-12"><CoreSpinLoader /></div>
      )}
    </div>
  );
}

function formatPreviewValue(v: string | undefined): string {
  if (v == null || v === "") return "—";
  return String(v);
}

function ResultBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-netland-light p-4">
      <p className="font-display text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      <p className="text-xs uppercase tracking-wide text-netland-muted">{label}</p>
    </div>
  );
}