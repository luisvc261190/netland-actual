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

interface ImportResultData {
  batch_id: number;
  import_type: string;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
  warnings: string[];
}

interface ImportTypeConfig {
  key: string;
  label: string;
  description: string;
  fields: Array<{ value: string; label: string }>;
  required: string[];
  template: string;
  hasExport?: boolean;
  exportUrl?: string;
}

const IMPORT_TYPES: ImportTypeConfig[] = [
  {
    key: "contracts",
    label: "Ventas / Contratos",
    description: "Registra contratos de compraventa (una venta = un contrato).",
    template: "/contracts/import/template",
    hasExport: true,
    exportUrl: "/contracts/export",
    required: ["document_number", "contract_number", "project", "lot_code", "total_price"],
    fields: [
      { value: "document_number", label: "Documento del propietario (obligatorio)" },
      { value: "document_type", label: "Tipo de documento" },
      { value: "contract_number", label: "Número de contrato (obligatorio)" },
      { value: "project", label: "Proyecto (obligatorio)" },
      { value: "block_code", label: "Manzana / Bloque" },
      { value: "lot_code", label: "Lote (obligatorio)" },
      { value: "contract_date", label: "Fecha de contrato" },
      { value: "start_date", label: "Fecha de inicio" },
      { value: "area_m2", label: "Área m² (obligatorio)" },
      { value: "price_per_m2", label: "Precio por m²" },
      { value: "total_price", label: "Precio total (obligatorio)" },
      { value: "modality", label: "Modalidad (financiado/contado)" },
    ],
  },
  {
    key: "clients",
    label: "Clientes",
    description: "Carga clientes potenciales y de base.",
    template: "/clients/import/template",
    hasExport: true,
    exportUrl: "/clients/export",
    required: ["name"],
    fields: [
      { value: "name", label: "Nombres / Razón social (obligatorio)" },
      { value: "last_name", label: "Apellidos" },
      { value: "phone", label: "Teléfono" },
      { value: "whatsapp", label: "WhatsApp" },
      { value: "email", label: "Correo" },
      { value: "notes", label: "Notas" },
    ],
  },
  {
    key: "financings",
    label: "Financiamiento",
    description: "Crea planes de financiamiento con cronograma para contratos financiados.",
    template: "/financings/import/template",
    required: ["contract_number", "financed_amount", "number_of_installments", "installment_amount"],
    fields: [
      { value: "contract_number", label: "Número de contrato (obligatorio)" },
      { value: "total_price", label: "Precio total" },
      { value: "initial_payment", label: "Cuota inicial / Entrada" },
      { value: "financed_amount", label: "Monto financiado (obligatorio)" },
      { value: "number_of_installments", label: "N° de cuotas (obligatorio)" },
      { value: "installment_amount", label: "Monto de cuota (obligatorio)" },
      { value: "frequency", label: "Frecuencia" },
      { value: "first_installment_date", label: "Fecha inicio cuotas (obligatorio)" },
      { value: "last_installment_date", label: "Fecha final" },
      { value: "interest_rate", label: "Tasa de interés (%)" },
    ],
  },
  {
    key: "installments",
    label: "Cuotas",
    description: "Carga cuotas puntuales para planes existentes.",
    template: "/installments/import/template",
    required: ["contract_number", "installment_number", "due_date", "amount"],
    fields: [
      { value: "contract_number", label: "Número de contrato (obligatorio)" },
      { value: "installment_number", label: "N° de cuota (obligatorio)" },
      { value: "due_date", label: "Fecha de vencimiento (obligatorio)" },
      { value: "amount", label: "Monto (obligatorio)" },
    ],
  },
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

export default function DataImportPage() {
  const { toast } = useToast();
  const [typeKey, setTypeKey] = useState(IMPORT_TYPES[0].key);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResultData | null>(null);

  const config = IMPORT_TYPES.find((t) => t.key === typeKey) ?? IMPORT_TYPES[0];

  const resetState = () => {
    setStep(1);
    setFile(null);
    setPreview(null);
    setResult(null);
    setMapping({});
  };

  const switchType = (key: string) => {
    setTypeKey(key);
    resetState();
  };

  const handleUpload = async () => {
    if (!file) {
      toast("Selecciona un archivo Excel (.xlsx, .xls o .csv)", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await uploadFile(`/${config.key}/import/preview`, file);
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
      const response = await fetch(`${API_URL}/${config.key}/import/confirm`, {
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

  const hasRequired = config.required.every((field) =>
    Object.values(mapping).includes(field)
  );

  return (
    <div>
      <PageHeader
        title="Importación de datos"
        subtitle="Carga masiva de ventas, clientes, financiamiento y cuotas desde Excel."
        action={
          <Button variant="outline" onClick={() => downloadFile(config.template, `plantilla-${config.key}.xlsx`)}>
            <FileSpreadsheet className="h-4 w-4" />
            Ver plantilla
          </Button>
        }
      />

      {/* Selector de tipo */}
      <div className="mb-6 flex flex-wrap gap-2">
        {IMPORT_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchType(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              typeKey === t.key
                ? "bg-netland-primary text-white"
                : "bg-netland-light text-netland-muted hover:text-netland-dark"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mb-6 text-sm text-netland-muted">{config.description}</p>

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
              {config.hasExport && config.exportUrl && (
                <Button variant="outline" onClick={() => downloadFile(config.exportUrl!, `${config.key}.xlsx`)}>
                  <Download className="h-4 w-4" />
                  Exportar actuales
                </Button>
              )}
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
                    {config.fields.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
            {!hasRequired && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Deben asignarse las columnas obligatorias:
                <strong>
                  {" "}
                  {config.required
                    .map((r) => config.fields.find((f) => f.value === r)?.label)
                    .join(", ")}
                </strong>
              </div>
            )}
            <div className="mt-5 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" /> Subir otro archivo
              </Button>
              <Button disabled={loading || !hasRequired} onClick={handleConfirm}>
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
                <Button onClick={resetState}>
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