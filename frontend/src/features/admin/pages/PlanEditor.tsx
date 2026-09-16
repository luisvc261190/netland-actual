import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { 
  ArrowLeft, 
  Move, 
  Save, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Filter,
  Grid3x3,
  FileImage,
  Eye,
  EyeOff,
  Upload,
  Layers
} from "lucide-react";
import { api } from "../../../lib/api";
import type { Block, Lot, Project } from "../../../types";
import { LOT_STATUS_COLORS, LOT_STATUS_LABELS } from "../../../lib/constants";
import { PageHeader, Button, Card, Field, Input } from "../ui";
import { useToast } from "../../../components/ui/Toast";
import { Skeleton } from "../../../components/ui/Skeleton";
import { FileUploader } from "../../../components/ui/FileUploader";

const SVG_W = 1200;
const SVG_H = 800;

export default function PlanEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Estados principales
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  const [dragging, setDragging] = useState<{
    id: number;
    startX: number;
    startY: number;
    lotX: number;
    lotY: number;
  } | null>(null);
  
  // Nuevos estados para características avanzadas
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBlock, setFilterBlock] = useState<string>("all");
  const [planImageUrl, setPlanImageUrl] = useState<string>("");
  const [showPlanImage, setShowPlanImage] = useState(true);
  const [viewMode, setViewMode] = useState<"plan" | "list">("plan");
  const [isMouseOverSVG, setIsMouseOverSVG] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: ({ signal }) => api.get<Project>(`/projects/${projectId}`, false, signal),
    enabled: !!projectId,
  });

  const { data: lots = [], isLoading } = useQuery({
    queryKey: ["admin-plan-lots", projectId],
    queryFn: ({ signal }) => api.get<Lot[]>(`/projects/${projectId}/lots`, false, signal),
    enabled: !!projectId,
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ["admin-blocks", projectId],
    queryFn: ({ signal }) => api.get<Block[]>(`/projects/${projectId}/blocks`, false, signal),
    enabled: !!projectId,
  });

  // Función para optimizar URLs de Cloudinary
  const optimizeCloudinaryUrl = (url: string): string => {
    if (!url) return url;
    
    // Si la URL es de Cloudinary y no tiene transformaciones, agregarlas
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
      // Verificar si ya tiene transformaciones
      const urlParts = url.split('/upload/');
      if (urlParts.length === 2) {
        // Si ya tiene transformaciones, no agregar más
        const afterUpload = urlParts[1];
        if (afterUpload.includes('q_') || afterUpload.includes('dpr_')) {
          return url;
        }
        // Agregar transformaciones de alta calidad
        return `${urlParts[0]}/upload/q_auto:best,f_auto,dpr_2.0,fl_progressive/${urlParts[1]}`;
      }
    }
    return url;
  };

  // Cargar imagen del plano desde el proyecto  
  useEffect(() => {
    // La imagen del plano se puede subir desde el módulo de galería
    // Por ahora usamos una URL configurable manualmente
  }, [project]);

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put(`/projects/lots/${id}`, data, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plan-lots"] });
      toast("Lote actualizado correctamente", "success");
    },
    onError: (e) => toast(e.message, "error"),
  });

  // Filtrar lotes
  const filteredLots = lots.filter((lot) => {
    if (filterStatus !== "all" && lot.status !== filterStatus) return false;
    if (filterBlock !== "all" && lot.block_code !== filterBlock) return false;
    return true;
  });

  const selected = lots.find((l) => l.id === selectedLotId) ?? null;

  const updateSelected = (patch: Partial<Lot>) => {
    if (!selected) return;
    saveMutation.mutate({
      id: selected.id,
      data: {
        ...patch,
        x: patch.x ?? selected.x,
        y: patch.y ?? selected.y,
        width: patch.width ?? selected.width,
        height: patch.height ?? selected.height,
      },
    });
  };

  // Funciones de zoom
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Funciones de panning
  const handlePanStart = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle mouse o Alt+click
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  const handlePanMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  const handleSvgMouseDown = (e: React.MouseEvent, lot: Lot) => {
    if (isPanning) return; // No seleccionar si estamos haciendo pan
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = (SVG_W * zoom) / rect.width;
    const scaleY = (SVG_H * zoom) / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setSelectedLotId(lot.id);
    setDragging({
      id: lot.id,
      startX: x,
      startY: y,
      lotX: Number(lot.x ?? 0),
      lotY: Number(lot.y ?? 0),
    });
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    if (isPanning) return;
    if (!dragging) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = (SVG_W * zoom) / rect.width;
    const scaleY = (SVG_H * zoom) / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const deltaX = x - dragging.startX;
    const deltaY = y - dragging.startY;
    const newX = Math.max(0, Math.min(SVG_W - 50, dragging.lotX + deltaX));
    const newY = Math.max(0, Math.min(SVG_H - 50, dragging.lotY + deltaY));
    
    // Actualizar visualmente (optimista)
    const lot = lots.find(l => l.id === dragging.id);
    if (lot) {
      lot.x = newX;
      lot.y = newY;
    }
  };

  const handleSvgMouseUp = () => {
    if (dragging && selectedLotId) {
      const lot = lots.find(l => l.id === dragging.id);
      if (lot) {
        // Guardar la nueva posición
        updateSelected({ x: lot.x, y: lot.y });
      }
    }
    setDragging(null);
  };

  if (isLoading || !project) return <Skeleton className="h-96 rounded-lg" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Plano Interactivo — ${project.short_name}`}
        subtitle="Editor profesional de planos con zoom, filtros y vista del PDF original"
        action={
          <Link to="/admin/lotes">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Volver a lotes
            </Button>
          </Link>
        }
      />

      {/* Barra de herramientas */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Controles de vista */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={viewMode === "plan" ? "primary" : "outline"}
              onClick={() => setViewMode("plan")}
              className="text-xs px-3 py-2"
            >
              <Layers className="h-4 w-4" />
              Vista Plano
            </Button>
            <Button
              variant={viewMode === "list" ? "primary" : "outline"}
              onClick={() => setViewMode("list")}
              className="text-xs px-3 py-2"
            >
              <Grid3x3 className="h-4 w-4" />
              Vista Lista
            </Button>
            
            <div className="h-6 w-px bg-netland-light mx-2" />
            
            {/* Controles de zoom */}
            <Button variant="outline" onClick={handleZoomOut} className="text-xs px-3 py-2">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-netland-dark min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="outline" onClick={handleZoomIn} className="text-xs px-3 py-2">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleResetView} className="text-xs px-3 py-2">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Controles de visualización */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPlanImage(!showPlanImage)}
              className="text-xs px-3 py-2"
            >
              {showPlanImage ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              PDF Fondo
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowGrid(!showGrid)}
              className="text-xs px-3 py-2"
            >
              <Grid3x3 className="h-4 w-4" />
              {showGrid ? "Ocultar" : "Mostrar"} Grid
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowLabels(!showLabels)}
              className="text-xs px-3 py-2"
            >
              <FileImage className="h-4 w-4" />
              Etiquetas
            </Button>
          </div>
        </div>
      </Card>

      {viewMode === "plan" ? (
        /* Vista de plano */
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Área del plano */}
          <div className="lg:col-span-3">
            <Card>
              {/* Info de ayuda */}
              <div className="mb-4 rounded-lg bg-netland-light/50 p-4">
                <div className="flex items-start gap-3">
                  <Move className="h-5 w-5 text-netland-primary mt-0.5 shrink-0" />
                  <div className="text-sm text-netland-dark space-y-1">
                    <p><strong>Arrastra</strong> los lotes para posicionarlos</p>
                    <p><strong>Alt + Arrastra</strong> para mover todo el plano</p>
                    <p><strong>Scroll</strong> para hacer zoom (o usa los botones)</p>
                  </div>
                </div>
              </div>

              {/* Filtros */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-netland-muted" />
                  <span className="text-sm font-medium text-netland-dark">Filtros:</span>
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-md border border-netland-light bg-white px-3 py-1.5 text-sm"
                >
                  <option value="all">Todos los estados</option>
                  {Object.entries(LOT_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <select
                  value={filterBlock}
                  onChange={(e) => setFilterBlock(e.target.value)}
                  className="rounded-md border border-netland-light bg-white px-3 py-1.5 text-sm"
                >
                  <option value="all">Todas las manzanas</option>
                  {blocks.map((block) => (
                    <option key={block.id} value={block.code}>MZ {block.code}</option>
                  ))}
                </select>
                <span className="ml-auto text-xs text-netland-muted">
                  Mostrando {filteredLots.length} de {lots.length} lotes
                </span>
              </div>

              {/* Leyenda de colores */}
              <div className="mb-4 flex flex-wrap gap-3 text-xs">
                {Object.entries(LOT_STATUS_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <div
                      className="h-3 w-3 rounded-sm border border-white"
                      style={{ backgroundColor: LOT_STATUS_COLORS[key] }}
                    />
                    <span className="font-medium text-netland-dark">{label}</span>
                  </div>
                ))}
              </div>

              {/* Contenedor del SVG con scroll */}
              <div
                className="overflow-auto rounded-lg border-2 border-netland-light bg-netland-background"
                style={{ maxHeight: "70vh" }}
                onMouseDown={handlePanStart}
                onMouseMove={handlePanMove}
                onMouseUp={handlePanEnd}
                onMouseLeave={handlePanEnd}
              >
                <div
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px)`,
                    transition: isPanning ? "none" : "transform 0.1s",
                    cursor: isPanning ? "grabbing" : "default",
                  }}
                >
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    className="w-full h-auto"
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: "0 0",
                      minWidth: `${SVG_W}px`,
                      minHeight: `${SVG_H}px`,
                    }}
                    onMouseEnter={() => setIsMouseOverSVG(true)}
                    onWheel={(e) => {
                      // Solo hacer zoom si el mouse está sobre el SVG
                      if (isMouseOverSVG) {
                        e.stopPropagation();
                        const delta = e.deltaY > 0 ? -0.1 : 0.1;
                        setZoom((z) => Math.max(0.5, Math.min(3, z + delta)));
                      }
                    }}
                    onMouseMove={handleSvgMouseMove}
                    onMouseUp={handleSvgMouseUp}
                    onMouseLeave={() => {
                      handleSvgMouseUp();
                      setIsMouseOverSVG(false);
                    }}
                  >
                    {/* Fondo */}
                    <rect width={SVG_W} height={SVG_H} fill="#f8f8f5" />

                    {/* Imagen del plano PDF como fondo */}
                    {showPlanImage && planImageUrl && (
                      <image
                        href={planImageUrl}
                        x="0"
                        y="0"
                        width={SVG_W}
                        height={SVG_H}
                        preserveAspectRatio="xMidYMid slice"
                        opacity="0.7"
                      />
                    )}

                    {/* Grid de referencia */}
                    {showGrid && (
                      <g opacity="0.15">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <line
                            key={`v-${i}`}
                            x1={(i * SVG_W) / 12}
                            y1="0"
                            x2={(i * SVG_W) / 12}
                            y2={SVG_H}
                            stroke="#666"
                            strokeWidth="1"
                          />
                        ))}
                        {Array.from({ length: 8 }).map((_, i) => (
                          <line
                            key={`h-${i}`}
                            x1="0"
                            y1={(i * SVG_H) / 8}
                            x2={SVG_W}
                            y2={(i * SVG_H) / 8}
                            stroke="#666"
                            strokeWidth="1"
                          />
                        ))}
                      </g>
                    )}

                    {/* Lotes */}
                    {filteredLots.map((lot, index) => {
                      const pos = {
                        x: Number(lot.x) || 0,
                        y: Number(lot.y) || 0,
                        w: Number(lot.width) || 100,
                        h: Number(lot.height) || 70,
                      };
                      
                      // Si no tiene posición asignada, usar layout automático
                      if (!lot.x && !lot.y) {
                        const cols = 8;
                        pos.x = (index % cols) * (SVG_W / cols) + 20;
                        pos.y = Math.floor(index / cols) * 100 + 20;
                        pos.w = SVG_W / cols - 40;
                        pos.h = 80;
                      }

                      const isSelected = lot.id === selectedLotId;
                      const color = LOT_STATUS_COLORS[lot.status];

                      return (
                        <g
                          key={lot.id}
                          transform={`translate(${pos.x}, ${pos.y})`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleSvgMouseDown(e, lot);
                          }}
                          className="cursor-grab active:cursor-grabbing transition-all"
                          style={{ opacity: dragging?.id === lot.id ? 0.7 : 1 }}
                        >
                          {/* Rectángulo del lote */}
                          <rect
                            width={pos.w}
                            height={pos.h}
                            rx="6"
                            fill={color}
                            fillOpacity={0.85}
                            stroke={isSelected ? "#f5a623" : "#ffffff"}
                            strokeWidth={isSelected ? 4 : 2}
                            className="transition-all"
                          />
                          
                          {/* Código del lote */}
                          {showLabels && (
                            <>
                              <text
                                x={pos.w / 2}
                                y={pos.h / 2 - 5}
                                textAnchor="middle"
                                fontSize="16"
                                fontWeight="700"
                                fill="#ffffff"
                                style={{ pointerEvents: "none" }}
                              >
                                {lot.code}
                              </text>
                              {/* Área */}
                              {lot.area_m2 && (
                                <text
                                  x={pos.w / 2}
                                  y={pos.h / 2 + 15}
                                  textAnchor="middle"
                                  fontSize="12"
                                  fontWeight="500"
                                  fill="#ffffff"
                                  fillOpacity="0.9"
                                  style={{ pointerEvents: "none" }}
                                >
                                  {lot.area_m2}m²
                                </text>
                              )}
                            </>
                          )}

                          {/* Indicador de selección */}
                          {isSelected && (
                            <circle
                              cx={pos.w / 2}
                              cy={-10}
                              r="6"
                              fill="#f5a623"
                              className="animate-pulse"
                            />
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </Card>
          </div>

          {/* Panel lateral de información y edición */}
          <div className="space-y-4">
            {/* Información del lote seleccionado */}
            <Card>
              <h3 className="mb-4 font-display text-lg font-semibold text-netland-dark flex items-center gap-2">
                <FileImage className="h-5 w-5 text-netland-primary" />
                {selected ? `Lote ${selected.code}` : "Seleccionar Lote"}
              </h3>
              {!selected ? (
                <div className="rounded-lg bg-netland-light/50 p-4 text-center">
                  <p className="text-sm text-netland-muted">
                    Haz clic en un lote del plano para ver sus detalles y editarlo
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Estado */}
                  <div>
                    <div className="mb-1 text-xs font-medium text-netland-muted uppercase tracking-wider">
                      Estado
                    </div>
                    <div
                      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold text-white"
                      style={{ backgroundColor: LOT_STATUS_COLORS[selected.status] }}
                    >
                      {LOT_STATUS_LABELS[selected.status]}
                    </div>
                  </div>

                  {/* Info básica */}
                  {selected.block_code && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-netland-muted uppercase tracking-wider">
                        Manzana
                      </div>
                      <div className="text-sm font-semibold text-netland-dark">
                        MZ {selected.block_code}
                      </div>
                    </div>
                  )}
                  
                  {selected.area_m2 && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-netland-muted uppercase tracking-wider">
                        Área
                      </div>
                      <div className="text-sm font-semibold text-netland-dark">
                        {selected.area_m2} m²
                      </div>
                    </div>
                  )}

                  <div className="border-t border-netland-light pt-4">
                    <h4 className="mb-3 text-sm font-semibold text-netland-dark">
                      Posición en el plano
                    </h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="X">
                          <Input
                            type="number"
                            value={selected.x ?? ""}
                            onChange={(e) => updateSelected({ x: Number(e.target.value) })}
                            placeholder="0"
                          />
                        </Field>
                        <Field label="Y">
                          <Input
                            type="number"
                            value={selected.y ?? ""}
                            onChange={(e) => updateSelected({ y: Number(e.target.value) })}
                            placeholder="0"
                          />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Ancho">
                          <Input
                            type="number"
                            value={selected.width ?? ""}
                            onChange={(e) => updateSelected({ width: Number(e.target.value) })}
                            placeholder="100"
                          />
                        </Field>
                        <Field label="Alto">
                          <Input
                            type="number"
                            value={selected.height ?? ""}
                            onChange={(e) => updateSelected({ height: Number(e.target.value) })}
                            placeholder="70"
                          />
                        </Field>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full text-xs px-3 py-2"
                    onClick={() => {
                      updateSelected({
                        x: selected.x,
                        y: selected.y,
                        width: selected.width,
                        height: selected.height,
                      });
                    }}
                  >
                    <Save className="h-4 w-4" />
                    Guardar Posición
                  </Button>
                </div>
              )}
            </Card>

            {/* Manzanas */}
            <Card>
              <h3 className="mb-3 font-display text-lg font-semibold text-netland-dark">
                Manzanas
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {blocks.length === 0 ? (
                  <p className="text-sm text-netland-muted">No hay manzanas registradas</p>
                ) : (
                  blocks.map((block) => (
                    <div
                      key={block.id}
                      className="flex items-center justify-between rounded-lg bg-netland-light/60 px-3 py-2 text-sm"
                    >
                      <span className="font-semibold text-netland-dark">
                        MZ {block.code}
                      </span>
                      <span className="text-xs text-netland-muted">
                        {block.lots_count} lotes
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Subir imagen del plano */}
            <Card>
              <h3 className="mb-3 font-display text-lg font-semibold text-netland-dark flex items-center gap-2">
                <Upload className="h-5 w-5 text-netland-primary" />
                Imagen del Plano
              </h3>
              <div className="space-y-3">
                {/* Opción 1: Subir desde PC */}
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-netland-muted">
                    Subir desde PC
                  </label>
                  <FileUploader
                    accept=".pdf,.jpg,.jpeg,.png"
                    folder="plans"
                    maxSizeMB={20}
                    hint="PDF, JPG o PNG hasta 20MB"
                    preview={true}
                    currentUrl={planImageUrl}
                    onUploadComplete={(url) => {
                      const optimizedUrl = optimizeCloudinaryUrl(url);
                      setPlanImageUrl(optimizedUrl);
                      setShowPlanImage(true);
                      toast("Plano cargado correctamente", "success");
                    }}
                  />
                </div>

                {/* Separador */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-netland-light"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-netland-muted">O</span>
                  </div>
                </div>

                {/* Opción 2: URL manual */}
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-netland-muted">
                    Pegar URL de Cloudinary
                  </label>
                  <Input
                    type="text"
                    value={planImageUrl}
                    onChange={(e) => {
                      const url = e.target.value;
                      const optimizedUrl = optimizeCloudinaryUrl(url);
                      setPlanImageUrl(optimizedUrl);
                    }}
                    placeholder="https://res.cloudinary.com/..."
                  />
                  <p className="mt-1 text-xs text-netland-muted">
                    URL directa de la imagen del plano en Cloudinary
                  </p>
                </div>

                {/* Preview y controles */}
                {planImageUrl && (
                  <div className="space-y-2 rounded-lg border border-netland-light bg-netland-light/20 p-3">
                    <div className="flex items-center gap-2">
                      <FileImage className="h-4 w-4 text-netland-primary" />
                      <span className="text-xs font-medium text-netland-dark">
                        Plano cargado
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full text-xs px-3 py-2"
                      onClick={() => setShowPlanImage(!showPlanImage)}
                    >
                      {showPlanImage ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {showPlanImage ? "Ocultar" : "Mostrar"} Imagen
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* Vista de lista */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-netland-light bg-netland-light/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-netland-dark">
                    Código
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-netland-dark">
                    Manzana
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-netland-dark">
                    Área
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-netland-dark">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-netland-dark">
                    Posición
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-netland-dark">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-netland-light">
                {filteredLots.map((lot) => (
                  <tr
                    key={lot.id}
                    className={`hover:bg-netland-light/20 transition-colors ${
                      selectedLotId === lot.id ? "bg-netland-accent/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-netland-dark">
                      {lot.code}
                    </td>
                    <td className="px-4 py-3 text-sm text-netland-dark">
                      {lot.block_code ? `MZ ${lot.block_code}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-netland-dark">
                      {lot.area_m2 ? `${lot.area_m2} m²` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: LOT_STATUS_COLORS[lot.status] }}
                      >
                        {LOT_STATUS_LABELS[lot.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-netland-muted">
                      {lot.x !== null && lot.y !== null
                        ? `X:${lot.x} Y:${lot.y}`
                        : "Sin posición"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        className="text-xs px-3 py-1.5"
                        onClick={() => {
                          setSelectedLotId(lot.id);
                          setViewMode("plan");
                        }}
                      >
                        <Eye className="h-3 w-3" />
                        Ver en plano
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}