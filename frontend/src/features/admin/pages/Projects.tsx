import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Pencil,
  Plus,
  Trash2,
  Image,
  FileText,
  FileSpreadsheet,
  FileDown,
  Upload,
  MapPin,
  Boxes,
  CheckCircle2,
} from "lucide-react";
import { api } from "../../../lib/api";
import { API_URL } from "../../../lib/constants";
import type { Project } from "../../../types";
import { PageHeader, Button, Card, Badge } from "../ui";
import { useToast } from "../../../components/ui/Toast";
import { Skeleton } from "../../../components/ui/Skeleton";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUploader } from "../../../components/ui/FileUploader";

const PROJECT_TYPE_LABELS: Record<string, string> = {
  lotes: "Lotes",
  condominio_campestre: "Condominio Campestre",
  urbanizacion: "Urbanización",
};

function ProjectTypeBadge({ projectType }: { projectType: string }) {
  return (
    <span className="rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-netland-primary backdrop-blur-sm">
      {PROJECT_TYPE_LABELS[projectType] ?? "Proyecto"}
    </span>
  );
}

function ProjectStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-netland-light/60 px-2.5 py-1.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-netland-primary shadow-sm">
        {icon}
      </span>
      <div className="leading-tight">
        <p className="text-base font-bold text-netland-dark">{value}</p>
        <p className="text-[10px] font-medium uppercase tracking-wide text-netland-muted">
          {label}
        </p>
      </div>
    </div>
  );
}

export default function AdminProjects() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast, confirm } = useToast();
  const [showExcelImport, setShowExcelImport] = useState<number | null>(null);
  const [showPlanUpload, setShowPlanUpload] = useState<number | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects-admin"],
    queryFn: () => api.get<Project[]>("/projects"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/projects/${id}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects-admin"] });
      toast("Proyecto eliminado.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, plan_pdf_url }: { id: number; plan_pdf_url: string }) =>
      api.put(`/projects/${id}`, { plan_pdf_url }, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects-admin"] });
      toast("PDF del plano actualizado correctamente");
      setShowPlanUpload(null);
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <div>
      <PageHeader
        title="Proyectos"
        subtitle="Administra los desarrollos inmobiliarios."
        action={
          <Link to="/admin/proyectos/nuevo">
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo proyecto
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : !projects || projects.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin proyectos"
            description="Crea tu primer proyecto inmobiliario."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <article
              key={project.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-netland-light bg-white shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-netland-primary hover:shadow-lift"
            >
              {/* Portada */}
              <button
                type="button"
                onClick={() => navigate(`/admin/proyectos/${project.id}/editar`)}
                className="relative block h-64 w-full overflow-hidden text-left sm:h-62"
                title="Editar proyecto"
              >
                <div
                  className="h-full w-full"
                  style={{
                    backgroundColor: project.color_primary,
                    backgroundImage: project.hero_image
                      ? `url(${project.hero_image})`
                      : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                </div>
                <div className="absolute left-3 top-3">
                  <ProjectTypeBadge projectType={project.project_type} />
                </div>
                <div className="absolute right-3 top-3">
                  <Badge color={project.is_published ? "#16a34a" : "#94a3b8"}>
                    {project.is_published ? "Publicado" : "Oculto"}
                  </Badge>
                </div>
                {project.logo_url && (
                  <img
                    src={project.logo_url}
                    alt={`Logo ${project.short_name}`}
                    className="absolute bottom-3 left-3 h-9 w-9 rounded-md border border-white/40 object-cover shadow-sm"
                  />
                )}
              </button>

              {/* Cuerpo */}
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <Link
                    to={`/admin/proyectos/${project.id}/editar`}
                    className="font-display text-lg font-bold text-netland-dark transition-colors hover:text-netland-primary"
                  >
                    {project.short_name}
                  </Link>
                  <span className="shrink-0 text-xs text-netland-muted">/{project.slug}</span>
                </div>

                <p className="mb-3 flex items-center gap-1.5 text-xs text-netland-muted">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-netland-accent" />
                  <span className="line-clamp-1">{project.location || "Sin ubicación"}</span>
                </p>

                {/* Estadísticas */}
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <ProjectStat label="Lotes" value={project.lots_count} icon={<Boxes className="h-3.5 w-3.5" />} />
                  <ProjectStat
                    label="Disponibles"
                    value={project.available_count}
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1.5 border-t border-netland-light bg-netland-light/30 px-4 py-3">
                <IconLink to={`/admin/proyectos/${project.id}/editar`} title="Editar proyecto">
                  <Pencil className="h-4 w-4" />
                </IconLink>
                <IconLink to={`/admin/proyectos/${project.id}/galeria`} title="Gestionar galería">
                  <Image className="h-4 w-4" />
                </IconLink>
                <IconLink to={`/admin/proyectos/${project.id}/documentos`} title="Gestionar documentos">
                  <FileText className="h-4 w-4" />
                </IconLink>
                <IconButton
                  title="Importar lotes desde Excel"
                  onClick={() => setShowExcelImport(project.id)}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                </IconButton>
                <IconButton
                  title={project.plan_pdf_url ? "Plano PDF cargado" : "Subir PDF del plano"}
                  onClick={() => setShowPlanUpload(project.id)}
                >
                  <Upload className="h-4 w-4" />
                  {project.plan_pdf_url && (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-green-500" />
                  )}
                </IconButton>
                <div className="ml-auto">
                  <IconButton
                    title="Eliminar proyecto"
                    danger
                    onClick={async () => {
                      if (await confirm(`¿Eliminar el proyecto ${project.short_name}?`)) {
                        deleteMutation.mutate(project.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal de Importar Excel */}
      {showExcelImport && (
        <ExcelImportModal
          projectId={showExcelImport}
          onClose={() => setShowExcelImport(null)}
          onSuccess={() => {
            setShowExcelImport(null);
            queryClient.invalidateQueries({ queryKey: ["projects-admin"] });
            toast("Lotes importados correctamente desde Excel");
          }}
        />
      )}

      {/* Modal de Gestionar Plano PDF */}
      {showPlanUpload && (
        <PlanPDFModal
          project={projects?.find(p => p.id === showPlanUpload)!}
          onClose={() => setShowPlanUpload(null)}
          onUpload={(url) => {
            updatePlanMutation.mutate({ id: showPlanUpload, plan_pdf_url: url });
          }}
        />
      )}
    </div>
  );
}

// Botón de acción con icono que navega a otra ruta
function IconLink({
  to,
  title,
  children,
}: {
  to: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      title={title}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-netland-light bg-white text-netland-muted transition-colors hover:border-netland-primary hover:text-netland-primary"
    >
      {children}
    </Link>
  );
}

// Botón de acción con icono (acciones inline)
function IconButton({
  title,
  onClick,
  danger = false,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`relative flex h-9 w-9 items-center justify-center rounded-md border bg-white transition-colors ${
        danger
          ? "border-netland-light text-netland-muted hover:border-red-500 hover:text-red-600"
          : "border-netland-light text-netland-muted hover:border-netland-primary hover:text-netland-primary"
      }`}
    >
      {children}
    </button>
  );
}

// Modal de Importación de Excel
function ExcelImportModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const response = await fetch(`${API_URL}/templates/lots.xlsx`);
      if (!response.ok) {
        throw new Error("No se pudo generar la plantilla");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "plantilla-lotes.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast("No se pudo descargar la plantilla. Intenta de nuevo.", "error");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("netland_token");
      if (!token) {
        toast("Sesión expirada. Por favor inicia sesión nuevamente.", "error");
        return;
      }

      const response = await fetch(`${API_URL}/projects/${projectId}/import-excel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(errorData.detail || "Error al importar Excel");
      }

      const data = await response.json();
      
      // Mostrar resultados detallados
      let message = "";
      if (data.imported > 0) {
        message = `✓ ${data.imported} lotes importados correctamente`;
      }
      
      if (data.warnings && data.warnings.length > 0) {
        console.warn("Advertencias de importación:", data.warnings);
        if (message) {
          message += ` (${data.warnings.length} advertencias en consola)`;
        } else {
          message = `⚠ ${data.warnings.length} advertencias encontradas. Ver consola para detalles.`;
        }
      }
      
      if (data.errors && data.errors.length > 0) {
        console.error("Errores de importación:", data.errors);
        if (data.imported === 0) {
          toast(`✗ ${data.errors.length} errores encontrados. Ver consola para detalles.`, "error");
        } else {
          toast(message + ` (${data.errors.length} errores en consola)`, "success");
        }
      } else if (message) {
        toast(message, "success");
      }
      
      if (data.imported > 0) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error al importar:", error);
      toast(error.message || "Error al importar archivo Excel", "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-netland-dark">
              Importar Lotes desde Excel
            </h2>
            <p className="mt-1 text-sm text-netland-muted">
              Sube un archivo Excel con los datos de los lotes del proyecto
            </p>
          </div>
          <Button variant="outline" className="!px-3 !py-2" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border-2 border-dashed border-netland-light bg-netland-light/30 p-6">
            <h3 className="mb-3 font-semibold text-netland-dark">Formato del Excel:</h3>
            <ul className="space-y-2 text-sm text-netland-muted">
              <li>• <strong>Columnas:</strong> MANZANA, LOTE, MZLOTE, AREA M2</li>
              <li>• <strong>MANZANA:</strong> Código de la manzana (ej: A, B, 1, 2)</li>
              <li>• <strong>LOTE:</strong> Número del lote</li>
              <li>• <strong>MZLOTE:</strong> Código completo del lote (ej: A-01, B-10) - REQUERIDO</li>
              <li>• <strong>AREA M2:</strong> Área en metros cuadrados</li>
              <li>• (Opcional) <strong>ESTADO:</strong> disponible, reservado, vendido, separado, no disponible</li>
              <li>• <strong>Formato:</strong> .xlsx, .xls o .csv</li>
            </ul>
            <p className="mt-3 text-xs text-netland-muted">
              El precio m² se ingresa al crear la cotización; aquí solo se registran los datos del lote.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-netland-dark">
              Archivo Excel
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                }
              }}
              className="w-full rounded-lg border border-netland-light px-4 py-3 text-sm outline-none focus:border-netland-primary disabled:opacity-50"
            />
          </div>

          {importing && (
            <div className="flex items-center justify-center gap-3 rounded-lg bg-netland-light/50 p-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-netland-primary border-t-transparent" />
              <span className="text-sm font-medium text-netland-dark">Importando lotes...</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate || importing}
            >
              <FileDown className="h-4 w-4" />
              {downloadingTemplate ? "Descargando..." : "Descargar Plantilla"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Modal de Gestión de Plano PDF
function PlanPDFModal({
  project,
  onClose,
  onUpload,
}: {
  project: Project;
  onClose: () => void;
  onUpload: (url: string) => void;
}) {
  const { toast } = useToast();
  const currentPlanUrl = project.plan_pdf_url || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-netland-dark">
              Plano PDF - {project.short_name}
            </h2>
            <p className="mt-1 text-sm text-netland-muted">
              Sube el PDF del plano del proyecto para descargarlo cuando lo necesites
            </p>
          </div>
          <Button variant="outline" className="!px-3 !py-2" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="space-y-6">
          {/* Archivo actual */}
          {currentPlanUrl && (
            <div className="rounded-lg border border-netland-light bg-netland-light/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-netland-primary" />
                  <div>
                    <p className="font-semibold text-netland-dark">Plano actual</p>
                    <p className="text-xs text-netland-muted">PDF del plano del proyecto</p>
                  </div>
                </div>
                <a
                  href={currentPlanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  <Button variant="outline" className="!px-3 !py-2">
                    <FileDown className="h-4 w-4" />
                    Descargar
                  </Button>
                </a>
              </div>
            </div>
          )}

          {/* Subir nuevo */}
          <div>
            <label className="mb-2 block text-sm font-medium text-netland-dark">
              {currentPlanUrl ? "Reemplazar plano PDF" : "Subir plano PDF"}
            </label>
            <FileUploader
              accept=".pdf"
              folder="plans"
              maxSizeMB={50}
              hint="PDF hasta 50MB"
              preview={false}
              onUploadComplete={(url) => {
                onUpload(url);
                toast("PDF del plano subido correctamente", "success");
              }}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cerrar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}