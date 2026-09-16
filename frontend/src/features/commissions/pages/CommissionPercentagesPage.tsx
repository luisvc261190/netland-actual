import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Power, RotateCcw, Trash2 } from "lucide-react";
import { api } from "../../../lib/api";
import type { Advisor, AdvisorCommission, Project } from "../../../types";
import { PageHeader, Button, Card, Field, Input, Select, Table, Badge } from "../../admin/ui";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { EmptyState } from "../../../components/ui/EmptyState";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";

interface ConfigFormState {
  advisor_id: number | "";
  project_id: number | "";
  commission_percent: string;
  is_active: boolean;
}

const emptyForm: ConfigFormState = {
  advisor_id: "",
  project_id: "",
  commission_percent: "",
  is_active: true,
};

export default function CommissionPercentagesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdvisorCommission | null>(null);
  const [form, setForm] = useState<ConfigFormState>(emptyForm);
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const { data: advisors } = useQuery({
    queryKey: ["advisors-admin"],
    queryFn: ({ signal }) => api.get<Advisor[]>("/advisors", true, signal),
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-admin"],
    queryFn: ({ signal }) => api.get<Project[]>("/projects", true, signal),
  });

  const { data: configs, isLoading } = useQuery({
    queryKey: ["commission-configs", includeDeleted],
    queryFn: ({ signal }) =>
      api.get<AdvisorCommission[]>(`/commissions/configs?include_deleted=${includeDeleted}`, true, signal),
  });

  const rows = configs || [];

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        advisor_id: form.advisor_id,
        project_id: form.project_id,
        commission_percent: Number(form.commission_percent),
        is_active: form.is_active,
      };
      return editing
        ? api.put(`/commissions/configs/${editing.id}`, payload, true)
        : api.post("/commissions/configs", payload, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-configs"] });
      queryClient.invalidateQueries({ queryKey: ["commission-configs-active"] });
      toast(editing ? "Porcentaje actualizado." : "Porcentaje configurado.");
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/commissions/configs/${id}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-configs"] });
      queryClient.invalidateQueries({ queryKey: ["commission-configs-active"] });
      toast("Configuración eliminada.");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.put(`/commissions/configs/${id}`, { is_active }, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-configs"] });
      queryClient.invalidateQueries({ queryKey: ["commission-configs-active"] });
      toast("Estado actualizado.");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => api.post(`/commissions/configs/${id}/reactivate`, {}, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-configs"] });
      queryClient.invalidateQueries({ queryKey: ["commission-configs-active"] });
      toast("Configuración restaurada.");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (config: AdvisorCommission) => {
    setEditing(config);
    setForm({
      advisor_id: config.advisor_id,
      project_id: config.project_id,
      commission_percent: String(config.commission_percent),
      is_active: config.is_active,
    });
    setModalOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Porcentajes de comisión"
        subtitle="Configura el porcentaje de comisión que gana cada asesor por proyecto."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo porcentaje
          </Button>
        }
      />

      <Card className="mb-6">
        <label className="flex items-center gap-2 text-sm font-medium text-netland-dark">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
            className="h-4 w-4 accent-netland-primary"
          />
          Mostrar configuraciones eliminadas
        </label>
      </Card>

      {isLoading ? (
        <Card><div className="py-8"><CoreSpinLoader /></div></Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin porcentajes configurados"
            description="Configura el porcentaje de comisión por asesor y proyecto. Luego se usará automáticamente al crear comisiones."
          />
        </Card>
      ) : (
        <Table headers={["Asesor", "Proyecto", "Porcentaje", "Estado", "Acciones"]}>
          {rows.map((config) => (
            <tr key={config.id} className={`hover:bg-netland-light/30 ${config.deleted_at ? "opacity-50" : ""}`}>
              <td className="px-5 py-3 font-semibold text-netland-dark">{config.advisor_name}</td>
              <td className="px-5 py-3 text-netland-muted">{config.project_name}</td>
              <td className="px-5 py-3">
                <span className="font-display text-lg font-semibold text-netland-primary">
                  {config.commission_percent}%
                </span>
              </td>
              <td className="px-5 py-3">
                {config.deleted_at ? (
                  <Badge color="#9ca3af">ELIMINADO</Badge>
                ) : config.is_active ? (
                  <Badge color="#16a34a">ACTIVO</Badge>
                ) : (
                  <Badge color="#f59e0b">INACTIVO</Badge>
                )}
              </td>
              <td className="px-5 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {!config.deleted_at && (
                    <>
                      <Button variant="outline" className="!px-2 !py-1" title="Editar" onClick={() => openEdit(config)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        className="!px-2 !py-1"
                        title={config.is_active ? "Desactivar" : "Activar"}
                        onClick={() => toggleMutation.mutate({ id: config.id, is_active: !config.is_active })}
                      >
                        <Power className={`h-3.5 w-3.5 ${config.is_active ? "text-amber-500" : "text-green-600"}`} />
                      </Button>
                      <Button
                        variant="danger"
                        className="!px-2 !py-1"
                        title="Eliminar"
                        onClick={() => deleteMutation.mutate(config.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {config.deleted_at && (
                    <Button
                      variant="outline"
                      className="!px-2 !py-1"
                      title="Restaurar"
                      onClick={() => reactivateMutation.mutate(config.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? "Editar porcentaje" : "Nuevo porcentaje de comisión"}
      >
        <div className="space-y-4 p-6">
          <Field label="Asesor">
            <Select
              value={form.advisor_id}
              onChange={(e) => setForm({ ...form, advisor_id: e.target.value ? Number(e.target.value) : "" })}
              disabled={!!editing}
            >
              <option value="">Selecciona un asesor</option>
              {advisors?.map((a) => (
                <option key={a.id} value={a.id}>{a.name} {a.is_external ? "(externo)" : ""}</option>
              ))}
            </Select>
          </Field>

          <Field label="Proyecto">
            <Select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value ? Number(e.target.value) : "" })}
              disabled={!!editing}
            >
              <option value="">Selecciona un proyecto</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>{p.short_name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Porcentaje de comisión (%)" hint="Ejm: 3.5 significa 3.5% del monto de la venta.">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.commission_percent}
              onChange={(e) => setForm({ ...form, commission_percent: e.target.value })}
              placeholder="Ej: 3.5"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 accent-netland-primary"
            />
            Configuración activa
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.advisor_id || !form.project_id || form.commission_percent === ""}
            >
              {editing ? "Guardar cambios" : "Configurar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}