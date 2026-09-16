import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Video, Info, Upload, Plus, X } from "lucide-react";
import { api } from "../../../lib/api";
import { useToast } from "../../../components/ui/Toast";
import { Skeleton } from "../../../components/ui/Skeleton";
import { FileUploader } from "../../../components/ui/FileUploader";
import { useAuth } from "../AuthContext";
import { DangerZone } from "./DangerZone";

interface SiteConfig {
  [key: string]: string;
}

const VIDEO_ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

const DEFAULT_COMPANY: SiteConfig = {
  company_ruc: "20610742468",
  company_razon_social: "NETLAND CORPORACION INMOBILIARIA S.A.C.",
  company_address:
    "Urb. Magisterial Mza. B Lote. 3, (cerca al Grifo Primax) - San Vicente de Cañete, Cañete, Lima, Perú",
  company_bank_accounts: "",
};

const PERUVIAN_BANKS = [
  "Banco de Crédito del Perú (BCP)",
  "Banco de la Nación",
  "Interbank",
  "BBVA Perú",
  "Scotiabank Perú",
  "Mi Banco",
  "Banbif",
  "Banco Pichincha",
  "Banco Falabella",
  "Caja Arequipa",
  "Caja Cusco",
  "Caja Huancayo",
  "Caja Ica",
  "Caja Trujillo",
  "Caja Piura",
  "Caja Tacna",
  "Banco Interamericano de Finanzas (BIF)",
];

interface BankAccount {
  bank: string;
  number: string;
}

function parseAccounts(text: string): BankAccount[] {
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const idx = line.indexOf(" - ");
      if (idx === -1) return { bank: line.trim(), number: "" };
      return { bank: line.slice(0, idx).trim(), number: line.slice(idx + 3).trim() };
    });
}

function serializeAccounts(accounts: BankAccount[]): string {
  return accounts
    .filter((a) => a.bank && a.number)
    .map((a) => `${a.bank} - ${a.number}`)
    .join("\n");
}

function extractVideoId(url: string): string | null {
  const match = url.match(VIDEO_ID_REGEX);
  return match ? match[1] : null;
}

export default function SiteSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.toUpperCase() === "SUPER_ADMIN";
  const [uploadMethod, setUploadMethod] = useState<"youtube" | "upload">("youtube");

  const { data: config, isLoading } = useQuery<SiteConfig>({
    queryKey: ["admin-config"],
    queryFn: ({ signal }) => api.get("/config", true, signal),
  });

  const [formData, setFormData] = useState<SiteConfig>({ ...DEFAULT_COMPANY });
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [newBank, setNewBank] = useState(PERUVIAN_BANKS[0]);
  const [newAccountNumber, setNewAccountNumber] = useState("");

  useEffect(() => {
    if (config?.company_bank_accounts !== undefined) {
      setBankAccounts(parseAccounts(config.company_bank_accounts));
    }
  }, [config?.company_bank_accounts]);

  const updateMutation = useMutation({
    mutationFn: (data: SiteConfig) => api.put("/config", data, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-config"] });
      queryClient.invalidateQueries({ queryKey: ["public-config"] });
      toast("Configuración actualizada correctamente", "success");
    },
    onError: () => {
      toast("Error al actualizar la configuración", "error");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...formData,
      company_bank_accounts: serializeAccounts(bankAccounts),
    });
  };

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const addBankAccount = () => {
    if (!newAccountNumber.trim()) return;
    setBankAccounts((prev) => [...prev, { bank: newBank, number: newAccountNumber.trim() }]);
    setNewAccountNumber("");
  };

  const removeBankAccount = (index: number) => {
    setBankAccounts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoUpload = (url: string) => {
    handleChange("hero_video_url", url);
    toast("Video subido correctamente", "success");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const currentConfig = { ...config, ...formData };
  const videoId = extractVideoId(currentConfig.hero_video_url || "");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-netland-dark">Configuración del sitio</h1>
        <p className="mt-2 text-netland-muted">
          Configura el video hero principal y otros ajustes del sitio web público.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Video Hero Section */}
        <div className="rounded-xl border border-netland-light bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-netland-primary/10">
              <Video className="h-5 w-5 text-netland-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-netland-dark">Video Hero Principal</h2>
              <p className="text-sm text-netland-muted">
                Video destacado en la página de inicio
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Método de carga */}
            <div>
              <label className="mb-3 block text-sm font-semibold text-netland-dark">
                Método de carga
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setUploadMethod("youtube")}
                  className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all ${
                    uploadMethod === "youtube"
                      ? "border-netland-primary bg-netland-primary/5 text-netland-primary"
                      : "border-netland-light bg-white text-netland-muted hover:border-netland-primary/30"
                  }`}
                >
                  <Video className="mx-auto mb-2 h-5 w-5" />
                  YouTube
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMethod("upload")}
                  className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all ${
                    uploadMethod === "upload"
                      ? "border-netland-primary bg-netland-primary/5 text-netland-primary"
                      : "border-netland-light bg-white text-netland-muted hover:border-netland-primary/30"
                  }`}
                >
                  <Upload className="mx-auto mb-2 h-5 w-5" />
                  Subir video
                </button>
              </div>
            </div>

            {uploadMethod === "youtube" ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-netland-dark">
                    URL del video de YouTube
                  </label>
                  <input
                    type="url"
                    value={currentConfig.hero_video_url || ""}
                    onChange={(e) => handleChange("hero_video_url", e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full rounded-lg border border-netland-light bg-netland-background px-4 py-3 text-sm outline-none transition-colors focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20"
                  />
                  <p className="mt-2 flex items-start gap-2 text-xs text-netland-muted">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Pega la URL completa de YouTube. Ejemplo: https://www.youtube.com/watch?v=dQw4w9WgXcQ
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-semibold text-netland-dark">
                  Subir video desde tu PC
                </label>
                <FileUploader
                  accept="video/*"
                  folder="site/hero"
                  onUploadComplete={(url) => handleVideoUpload(url)}
                  maxSizeMB={100}
                  label="Arrastra tu video aquí o haz clic para seleccionar"
                  hint="Formatos: MP4, WebM, MOV. Máximo 100MB. El video se subirá a Cloudinary."
                  preview={false}
                />
                <p className="mt-2 flex items-start gap-2 text-xs text-netland-muted">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    El video se subirá a Cloudinary y se guardará la URL automáticamente. Recomendamos videos cortos (30-60 segundos) para mejor rendimiento.
                  </span>
                </p>
                {currentConfig.hero_video_url && !videoId && (
                  <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-xs font-semibold text-green-800">Video cargado desde Cloudinary</p>
                    <p className="mt-1 truncate text-xs text-green-600">{currentConfig.hero_video_url}</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-netland-dark">
                Título del video (opcional)
              </label>
              <input
                type="text"
                value={currentConfig.hero_video_title || ""}
                onChange={(e) => handleChange("hero_video_title", e.target.value)}
                placeholder="Descubre Netland"
                className="w-full rounded-lg border border-netland-light bg-netland-background px-4 py-3 text-sm outline-none transition-colors focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20"
              />
            </div>

            {/* Video Preview */}
            {videoId ? (
              <div className="rounded-lg border border-netland-light bg-netland-background p-4">
                <p className="mb-3 text-sm font-semibold text-netland-dark">Vista previa (YouTube):</p>
                <div className="aspect-video overflow-hidden rounded-lg">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}?modestbranding=1`}
                    title="Video preview"
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : currentConfig.hero_video_url && currentConfig.hero_video_url.includes("cloudinary") ? (
              <div className="rounded-lg border border-netland-light bg-netland-background p-4">
                <p className="mb-3 text-sm font-semibold text-netland-dark">Vista previa (Cloudinary):</p>
                <div className="aspect-video overflow-hidden rounded-lg bg-black">
                  <video
                    src={currentConfig.hero_video_url}
                    controls
                    className="h-full w-full"
                    preload="metadata"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Company Info Section */}
        <div className="rounded-xl border border-netland-light bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-netland-dark">Información de la empresa</h2>
            <p className="text-sm text-netland-muted">
              Razón social, RUC, dirección legal y cuentas bancarias que aparecen en el PDF de
              cotizaciones
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-netland-dark">
                  RUC
                </label>
                <input
                  type="text"
                  value={currentConfig.company_ruc || ""}
                  onChange={(e) => handleChange("company_ruc", e.target.value)}
                  placeholder="20610742468"
                  className="w-full rounded-lg border border-netland-light bg-netland-background px-4 py-3 text-sm outline-none transition-colors focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-netland-dark">
                  Razón social
                </label>
                <input
                  type="text"
                  value={currentConfig.company_razon_social || ""}
                  onChange={(e) => handleChange("company_razon_social", e.target.value)}
                  placeholder="NETLAND CORPORACION INMOBILIARIA S.A.C."
                  className="w-full rounded-lg border border-netland-light bg-netland-background px-4 py-3 text-sm outline-none transition-colors focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-netland-dark">
                Dirección legal
              </label>
              <textarea
                value={currentConfig.company_address || ""}
                onChange={(e) => handleChange("company_address", e.target.value)}
                rows={2}
                placeholder="Otr. Magisterial Mza. B Lote. 3, Urb. Magisterial..."
                className="w-full rounded-lg border border-netland-light bg-netland-background px-4 py-3 text-sm outline-none transition-colors focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-netland-dark">
                Cuentas bancarias
              </label>

              {/* Lista de cuentas existentes */}
              {bankAccounts.length > 0 && (
                <div className="mb-3 space-y-2">
                  {bankAccounts.map((acc, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-netland-light bg-netland-background px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-netland-dark">
                          {acc.bank}
                        </p>
                        <p className="truncate text-xs text-netland-muted">
                          {acc.number}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBankAccount(i)}
                        className="ml-3 shrink-0 rounded-md p-1.5 text-netland-muted transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulario para agregar cuenta */}
              <div className="flex gap-3">
                <select
                  value={newBank}
                  onChange={(e) => setNewBank(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-netland-light bg-netland-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20"
                >
                  {PERUVIAN_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBankAccount())}
                  placeholder="N.º de cuenta o CCI"
                  className="w-48 rounded-lg border border-netland-light bg-netland-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20"
                />
                <button
                  type="button"
                  onClick={addBankAccount}
                  disabled={!newAccountNumber.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-netland-light bg-white px-3 py-2.5 text-sm font-semibold text-netland-dark transition-colors hover:bg-netland-background disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </button>
              </div>

              <p className="mt-2 flex items-start gap-2 text-xs text-netland-muted">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Selecciona el banco, ingresa el número de cuenta y haz clic en Agregar. Aparecerán en el PDF de la cotización.</span>
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-netland-dark">
                Información legal (extra)
              </label>
              <textarea
                value={currentConfig.company_legal_info || ""}
                onChange={(e) => handleChange("company_legal_info", e.target.value)}
                rows={2}
                placeholder="Texto legal adicional (se muestra en el sitio público)"
                className="w-full rounded-lg border border-netland-light bg-netland-background px-4 py-3 text-sm outline-none transition-colors focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-netland-dark">
                  Horarios de atención
                </label>
                <input
                  type="text"
                  value={currentConfig.company_schedules || ""}
                  onChange={(e) => handleChange("company_schedules", e.target.value)}
                  placeholder="Lun - Vie: 9am - 6pm"
                  className="w-full rounded-lg border border-netland-light bg-netland-background px-4 py-3 text-sm outline-none transition-colors focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-netland-dark">
                  Facebook
                </label>
                <input
                  type="url"
                  value={currentConfig.company_facebook || ""}
                  onChange={(e) => handleChange("company_facebook", e.target.value)}
                  placeholder="https://facebook.com/netland"
                  className="w-full rounded-lg border border-netland-light bg-netland-background px-4 py-3 text-sm outline-none transition-colors focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-netland-dark">
                  Instagram
                </label>
                <input
                  type="url"
                  value={currentConfig.company_instagram || ""}
                  onChange={(e) => handleChange("company_instagram", e.target.value)}
                  placeholder="https://instagram.com/netland"
                  className="w-full rounded-lg border border-netland-light bg-netland-background px-4 py-3 text-sm outline-none transition-colors focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-netland-primary px-6 py-3 font-semibold text-white transition-all hover:bg-netland-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>

      {isSuperAdmin && <DangerZone />}
    </div>
  );
}
