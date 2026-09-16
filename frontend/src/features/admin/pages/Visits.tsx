import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../../../lib/api";
import type { Visit } from "../../../types";
import { PageHeader, Button, Card, Field, Input, Textarea, Table } from "../ui";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { EmptyState } from "../../../components/ui/EmptyState";

const statusColors: Record<string, string> = {
  pending: "#eab308",
  confirmed: "#2563eb",
  completed: "#16a34a",
  cancelled: "#dc2626",
  no_show: "#6b7280",
};

export default function AdminVisits() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ lead_id: "", project_id: "", scheduled_at: "", notes: "" });

  const { data: visits } = useQuery({
    queryKey: ["visits-admin"],
    queryFn: ({ signal }) => api.get<Visit[]>("/visits", true, signal),
  });

  const { data: leads } = useQuery({
    queryKey: ["leads-all"],
    queryFn: ({ signal }) => api.get<any[]>("/leads", true, signal),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(
        "/visits",
        {
          lead_id: Number(form.lead_id),
          project_id: form.project_id ? Number(form.project_id) : null,
          scheduled_at: form.scheduled_at,
          notes: form.notes,
        },
        true
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits-admin"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast("Visita programada.");
      setModalOpen(false);
    },
    onError: (e) => toast(e.message, "error"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/visits/${id}`, { status }, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits-admin"] });
      toast("Estado de visita actualizado.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <div>
      <PageHeader
        title="Visitas"
        subtitle="Agenda de visitas guiadas a los proyectos."
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Programar visita
          </Button>
        }
      />

      {!visits || visits.length === 0 ? (
        <Card>
          <EmptyState title="Sin visitas" description="Programa visitas guiadas para tus leads." />
        </Card>
      ) : (
        <Table headers={["Cliente", "Proyecto", "Fecha", "Asesor", "Estado", "Notas"]}>
          {visits.map((visit) => (
            <tr key={visit.id} className="hover:bg-netland-light/30">
              <td className="px-5 py-3 font-medium text-netland-dark">{visit.lead_name ?? "—"}</td>
              <td className="px-5 py-3 text-netland-muted">{visit.project_name ?? "—"}</td>
              <td className="px-5 py-3 text-netland-muted">
                {visit.scheduled_at
                  ? new Date(visit.scheduled_at).toLocaleString("es-PE")
                  : "—"}
              </td>
              <td className="px-5 py-3 text-netland-muted">{visit.advisor_name ?? "—"}</td>
              <td className="px-5 py-3">
                <select
                  value={visit.status}
                  onChange={(e) => statusMutation.mutate({ id: visit.id, status: e.target.value })}
                  className="rounded-sm border px-2 py-1 text-xs font-semibold uppercase tracking-wider"
                  style={{
                    color: statusColors[visit.status],
                    borderColor: statusColors[visit.status] + "55",
                    backgroundColor: statusColors[visit.status] + "10",
                  }}
                >
                  {Object.keys(statusColors).map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-5 py-3 text-xs text-netland-muted">{visit.notes || "—"}</td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Programar visita">
        <div className="space-y-4 p-6">
          <Field label="Lead / cliente">
            <select
              value={form.lead_id}
              onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
              className="w-full rounded-sm border border-netland-light bg-netland-background px-3.5 py-2.5 text-sm outline-none focus:border-netland-primary"
            >
              <option value="">Seleccionar lead...</option>
              {(leads ?? []).map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.client?.name} {lead.client?.last_name} — {lead.client?.phone}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha y hora">
            <Input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
            />
          </Field>
          <Field label="Notas">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.lead_id}>
              Programar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}