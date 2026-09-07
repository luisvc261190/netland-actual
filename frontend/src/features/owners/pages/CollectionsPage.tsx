import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Phone,
  Search,
  X,
} from "lucide-react";
import { api } from "../../../lib/api";
import { PageHeader, Button, Card, Badge, Table, Field, Select, Input, StatCard, Pagination } from "../../admin/ui";
import { useToast } from "../../../components/ui/Toast";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { Project } from "../../../types";
import type { CollectionDashboard, CollectionItem } from "../types";
import {
  COLLECTION_STATUS,
  COLLECTION_STATUS_COLORS,
  formatSoles,
  formatDate,
  getDaysOverdueLabel,
} from "../constants";

export default function CollectionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [projectId, setProjectId] = useState<number | "">("");
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");

  // Fetch dashboard stats
  const { data: dashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ["collections-dashboard"],
    queryFn: () => api.get<CollectionDashboard>("/collections/dashboard", true),
  });

  // Fetch projects for filter
  const { data: projects } = useQuery({
    queryKey: ["projects-admin"],
    queryFn: () => api.get<Project[]>("/projects", true),
  });

  // Fetch collection items
  const {
    data: items,
    isLoading: loadingItems,
  } = useQuery({
    queryKey: ["collections-items", projectId, status, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (projectId) params.append("project_id", projectId.toString());
      if (status) params.append("status", status);
      if (search) params.append("search", search);
      return api.get<CollectionItem[]>(`/collections/items?${params.toString()}`, true);
    },
  });

  // Update overdue mutation
  const updateOverdueMutation = useMutation({
    mutationFn: () => api.post("/collections/update-overdue", {}, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["collections-items"] });
      toast("Estados actualizados correctamente");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const filteredItems = items || [];
  const totalItems = filteredItems.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize);

  const handleWhatsApp = (phone: string, ownerName: string, contractNumber: string, overdueAmount: number) => {
    const message = `Hola ${ownerName}, le recordamos que el contrato ${contractNumber} tiene una deuda pendiente de ${formatSoles(overdueAmount)}. Por favor, póngase al día con sus pagos. Gracias.`;
    const url = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  return (
    <div>
      <PageHeader
        title="Cobranzas"
        subtitle="Gestiona la cartera de cobranza y pagos pendientes."
        action={
          <Button onClick={() => updateOverdueMutation.mutate()} disabled={updateOverdueMutation.isPending}>
            <AlertCircle className="h-4 w-4" />
            {updateOverdueMutation.isPending ? "Actualizando..." : "Actualizar Vencidos"}
          </Button>
        }
      />

      {/* Dashboard Stats */}
      {loadingDashboard ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CoreSpinLoader />
            </Card>
          ))}
        </div>
      ) : dashboard ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard
            label="Cartera Total"
            value={formatSoles(dashboard.total_portfolio)}
            icon={<DollarSign className="h-5 w-5" />}
            accent="#0d7a44"
          />
          <StatCard
            label="Total Cobrado"
            value={formatSoles(dashboard.total_collected)}
            icon={<CheckCircle className="h-5 w-5" />}
            accent="#16a34a"
          />
          <StatCard
            label="Total Pendiente"
            value={formatSoles(dashboard.total_pending)}
            icon={<Clock className="h-5 w-5" />}
            accent="#f59e0b"
          />
          <StatCard
            label="Total Vencido"
            value={formatSoles(dashboard.total_overdue)}
            icon={<AlertCircle className="h-5 w-5" />}
            accent="#dc2626"
          />
          <StatCard
            label="Cobranzas Hoy"
            value={formatSoles(dashboard.collections_today)}
            icon={<TrendingUp className="h-5 w-5" />}
            accent="#3b82f6"
          />
          <StatCard
            label="Cobranzas del Mes"
            value={formatSoles(dashboard.collections_month)}
            icon={<TrendingUp className="h-5 w-5" />}
            accent="#8b5cf6"
          />
          <StatCard
            label="Vencimientos en 7 Días"
            value={formatSoles(dashboard.upcoming_7_days)}
            icon={<AlertCircle className="h-5 w-5" />}
            accent="#f97316"
          />
          <StatCard
            label="Contratos Activos"
            value={dashboard.active_contracts}
            icon={<FileText className="h-5 w-5" />}
            accent="#0d7a44"
          />
        </div>
      ) : null}

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Proyecto">
            <Select value={projectId} onChange={(e) => {
              setProjectId(e.target.value ? Number(e.target.value) : "");
              setPage(1);
            }}>
              <option value="">Todos los proyectos</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.short_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Estado de Cobranza">
            <Select value={status} onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}>
              <option value="">Todos los estados</option>
              {Object.entries(COLLECTION_STATUS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Buscar" className="sm:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-netland-muted" />
              <Input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por contrato, propietario, documento..."
                className="!pl-9 !pr-10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-netland-muted transition-colors hover:text-netland-dark"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </Field>
        </div>
      </Card>

      {/* Collection Items Table */}
      {loadingItems ? (
        <Card>
          <div className="py-8">
            <CoreSpinLoader />
          </div>
        </Card>
      ) : totalItems === 0 ? (
        <Card>
          <EmptyState
            title="Sin datos de cobranza"
            description="No hay contratos que coincidan con los filtros seleccionados."
          />
        </Card>
      ) : (
        <>
          <Table
            headers={[
              "Contrato",
              "Propietario",
              "Proyecto",
              "Lote",
              "Modalidad",
              "Próximo Venc.",
              "Saldo Pendiente",
              "Deuda Vencida",
              "Días Atraso",
              "Estado",
              "Acciones",
            ]}
          >
            {paginatedItems.map((item) => (
              <tr key={item.contract_id} className="hover:bg-netland-light/30">
                <td className="px-5 py-3 font-semibold text-netland-dark">
                  {item.contract_number}
                </td>
                <td className="px-5 py-3">
                  <div>
                    <p className="font-medium text-netland-dark">{item.owner_name}</p>
                    <p className="text-xs text-netland-muted">{item.owner_document}</p>
                  </div>
                </td>
                <td className="px-5 py-3 text-netland-muted">{item.project_name}</td>
                <td className="px-5 py-3 font-medium">
                  {item.block_code ? `${item.block_code} - ` : ""}
                  {item.lot_code}
                </td>
                <td className="px-5 py-3 text-xs uppercase">{item.payment_modality}</td>
                <td className="px-5 py-3 text-sm">{formatDate(item.next_due_date)}</td>
                <td className="px-5 py-3 font-semibold text-netland-primary">
                  {formatSoles(item.outstanding_balance)}
                </td>
                <td className="px-5 py-3 font-semibold text-red-600">
                  {formatSoles(item.overdue_amount)}
                </td>
                <td className="px-5 py-3">
                  {item.days_overdue > 0 ? (
                    <span className="text-red-600 font-medium">
                      {getDaysOverdueLabel(item.days_overdue)}
                    </span>
                  ) : (
                    <span className="text-green-600">Al día</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <Badge color={COLLECTION_STATUS_COLORS[item.collection_status]}>
                    {COLLECTION_STATUS[item.collection_status]}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="!px-2.5 !py-1.5"
                      onClick={() =>
                        navigate(`/admin/contratos/${item.contract_id}`)
                      }
                      title="Ver detalle"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    {item.owner_phone && item.overdue_amount > 0 && (
                      <Button
                        variant="whatsapp"
                        className="!px-2.5 !py-1.5"
                        onClick={() =>
                          handleWhatsApp(
                            item.owner_phone,
                            item.owner_name,
                            item.contract_number,
                            item.overdue_amount
                          )
                        }
                        title="Enviar recordatorio por WhatsApp"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            unitLabel="contratos"
          />
        </>
      )}
    </div>
  );
}
