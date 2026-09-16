import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Calendar } from "lucide-react";
import { api } from "../../../lib/api";
import type { Lead, Advisor } from "../../../types";
import {
  CAPTURED_SOURCES,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  whatsappLink,
  formatSoles,
} from "../../../lib/constants";
import { PageHeader, Card, Badge, Field, Select, Button, Textarea, Table } from "../ui";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LeadFilters, type LeadFiltersState } from "../components/LeadFilters";

const statusColors: Record<string, string> = {
  new: "#2563eb",
  contacted: "#7c3aed",
  interested: "#ea580c",
  visit_scheduled: "#0891b2",
  negotiation: "#db2777",
  reserved: "#eab308",
  sold: "#16a34a",
  discarded: "#6b7280",
};

export default function AdminLeads() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [filters, setFilters] = useState<LeadFiltersState>({
    status: "",
    advisor_id: "",
    date_from: "",
    date_to: "",
    search: "",
  });

  const handleFilterChange = (key: keyof LeadFiltersState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: "",
      advisor_id: "",
      date_from: "",
      date_to: "",
      search: "",
    });
  };

  const hasActiveFilters = Boolean(
    filters.status || filters.advisor_id || filters.date_from || filters.date_to || filters.search
  );

  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [reassignAdvisorId, setReassignAdvisorId] = useState<number | "">("");

  // Cargar asesores
  const { data: advisors } = useQuery({
    queryKey: ["advisors"],
    queryFn: ({ signal }) => api.get<Advisor[]>("/advisors", true, signal),
  });

  // Cargar leads con filtros
  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads", filters],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      params.set("exclude_source", CAPTURED_SOURCES.join(","));
      
      if (filters.status) params.set("status", filters.status);
      if (filters.advisor_id) params.set("advisor_id", filters.advisor_id);
      if (filters.date_from) params.set("date_from", filters.date_from);
      if (filters.date_to) params.set("date_to", filters.date_to);
      if (filters.search) params.set("search", filters.search);
      
      return api.get<Lead[]>(`/leads?${params.toString()}`, true, signal);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/leads/${id}`, { status }, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-lots"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast("Estado del lead actualizado", "success");
      setSelected(null);
    },
    onError: (e) => toast(e.message, "error"),
  });

  const followUpMutation = useMutation({
    mutationFn: ({ id, follow_up }: { id: number; follow_up: string }) =>
      api.patch(`/leads/${id}`, { follow_up }, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast("Seguimiento registrado", "success");
      setFollowUp("");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const reassignMutation = useMutation({
    mutationFn: ({ id, advisor_id }: { id: number; advisor_id: number }) =>
      api.patch(`/leads/${id}`, { advisor_id }, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast("Lead reasignado correctamente", "success");
      setReassignAdvisorId("");
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <div>
      <PageHeader
        title="Leads web"
        subtitle="Clientes que llegan desde los formularios del sitio público. Los leads se asignan automáticamente a los asesores disponibles."
        action={
          <LeadFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
            advisors={advisors}
            showAdvisorFilter={true}
            isOpen={showFilters}
            onToggle={() => setShowFilters(!showFilters)}
          />
        }
      />

      {/* Tabla de leads */}
      {isLoading ? (
        <Card>
          <div className="py-8">
            <CoreSpinLoader />
          </div>
        </Card>
      ) : !leads || leads.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin leads"
            description={
              hasActiveFilters
                ? "No se encontraron leads con los filtros aplicados."
                : "Los formularios del sitio y de los lotes generarán leads aquí."
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="mb-4 text-sm text-netland-muted">
            Mostrando {leads.length} lead{leads.length !== 1 ? "s" : ""}
          </div>
          <Table
            headers={[
              "Cliente",
              "Contacto",
              "Proyecto / Lote",
              "Presupuesto",
              "Asesor",
              "Estado",
              "Acciones",
            ]}
          >
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-netland-light/30">
                <td className="px-5 py-3">
                  <p className="font-semibold text-netland-dark">
                    {lead.client?.name} {lead.client?.last_name}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-netland-muted">
                    <Calendar className="h-3 w-3" />
                    {new Date(lead.created_at ?? "").toLocaleDateString("es-PE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </td>
                <td className="px-5 py-3">
                  <p className="text-netland-muted">{lead.client?.phone}</p>
                  {lead.client?.whatsapp && (
                    <a
                      href={whatsappLink(
                        `Hola ${lead.client?.name}, te escribimos de Netland por tu consulta.`,
                        lead.client?.whatsapp || lead.client?.phone
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:underline"
                    >
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp
                    </a>
                  )}
                </td>
                <td className="px-5 py-3">
                  <p className="text-netland-dark">{lead.project_name ?? "—"}</p>
                  {lead.lot_code && (
                    <p className="text-xs text-netland-muted">Lote: {lead.lot_code}</p>
                  )}
                </td>
                <td className="px-5 py-3">
                  {lead.budget ? (
                    <span className="font-medium">{formatSoles(lead.budget)}</span>
                  ) : (
                    <span className="text-netland-muted">—</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {lead.advisor_name ? (
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-netland-primary/10 text-xs font-bold text-netland-primary">
                        {lead.advisor_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{lead.advisor_name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-netland-muted">Sin asignar</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <Badge color={statusColors[lead.status] ?? "#6b7280"}>
                    {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <Button
                    variant="outline"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => {
                      setSelected(lead);
                      setFollowUp(lead.follow_up ?? "");
                      setReassignAdvisorId(lead.advisor_id || "");
                    }}
                  >
                    Gestionar
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* Modal de gestión */}
      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setReassignAdvisorId("");
        }}
        title="Gestionar lead"
      >
        {selected && (
          <div className="space-y-6 p-6">
            {/* Información del cliente */}
            <div>
              <h3 className="mb-3 font-semibold text-netland-dark">Cliente</h3>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Nombre:</span> {selected.client?.name}{" "}
                  {selected.client?.last_name}
                </p>
                <p>
                  <span className="font-medium">Teléfono:</span> {selected.client?.phone}
                </p>
                {selected.client?.email && (
                  <p>
                    <span className="font-medium">Email:</span> {selected.client?.email}
                  </p>
                )}
                <p>
                  <span className="font-medium">Proyecto:</span> {selected.project_name ?? "—"}
                </p>
                {selected.message && (
                  <p>
                    <span className="font-medium">Mensaje:</span> {selected.message}
                  </p>
                )}
              </div>
            </div>

            {/* Reasignar asesor */}
            <div>
              <Field label="Asesor asignado">
                <div className="flex gap-2">
                  <Select
                    value={reassignAdvisorId}
                    onChange={(e) =>
                      setReassignAdvisorId(e.target.value ? Number(e.target.value) : "")
                    }
                    className="flex-1"
                  >
                    <option value="">Sin asignar</option>
                    {advisors?.map((advisor) => (
                      <option key={advisor.id} value={advisor.id}>
                        {advisor.name}
                      </option>
                    ))}
                  </Select>
                  {reassignAdvisorId !== (selected.advisor_id || "") && (
                    <Button
                      onClick={() =>
                        reassignAdvisorId &&
                        reassignMutation.mutate({
                          id: selected.id,
                          advisor_id: Number(reassignAdvisorId),
                        })
                      }
                      disabled={!reassignAdvisorId || reassignMutation.isPending}
                    >
                      Reasignar
                    </Button>
                  )}
                </div>
              </Field>
            </div>

            {/* Cambiar estado */}
            <Field label="Estado del lead">
              <Select
                value={selected.status}
                onChange={(e) =>
                  statusMutation.mutate({ id: selected.id, status: e.target.value })
                }
                disabled={statusMutation.isPending}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Seguimiento */}
            <Field label="Notas de seguimiento">
              <Textarea
                rows={4}
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                placeholder="Agrega notas sobre el seguimiento..."
              />
              <div className="mt-2 flex justify-end">
                <Button
                  onClick={() =>
                    followUpMutation.mutate({ id: selected.id, follow_up: followUp })
                  }
                  disabled={!followUp || followUpMutation.isPending}
                >
                  Guardar seguimiento
                </Button>
              </div>
            </Field>

            {/* Acciones rápidas */}
            <div className="flex gap-3 border-t border-netland-light pt-4">
              <a
                href={whatsappLink(
                  `Hola ${selected.client?.name}, te escribimos de Netland por tu consulta.`,
                  selected.client?.whatsapp || selected.client?.phone
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp !py-2 !text-xs"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
