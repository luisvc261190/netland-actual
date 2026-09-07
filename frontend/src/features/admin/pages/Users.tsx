import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2, UserRoundCheck } from "lucide-react";
import { api } from "../../../lib/api";
import { ROLE_LABELS, ROLE_COLORS } from "../../../lib/constants";
import type { Advisor, User } from "../../../types";
import { PageHeader, Button, Card, Field, Input, Select, Table, Badge } from "../ui";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { EmptyState } from "../../../components/ui/EmptyState";

const roleColors: Record<string, string> = ROLE_COLORS;

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "ASESOR", is_active: true, advisor_id: "" });

  const { data: users } = useQuery({
    queryKey: ["users-admin"],
    queryFn: () => api.get<User[]>("/users", true),
  });

  const { data: availableAdvisors } = useQuery({
    queryKey: ["available-advisors"],
    queryFn: () => api.get<Advisor[]>("/users/available-advisors", true),
    enabled: modalOpen && !editing && form.role === "ASESOR",
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editing) {
        const payload: Record<string, unknown> = { role: form.role, is_active: form.is_active };
        if (form.name) payload.name = form.name;
        if (form.email) payload.email = form.email;
        if (form.password) payload.password = form.password;
        return api.put(`/users/${editing.id}`, payload, true);
      }
      return api.post("/users", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        is_active: form.is_active,
        advisor_id: form.role === "ASESOR" && form.advisor_id ? Number(form.advisor_id) : null,
      }, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-admin"] });
      queryClient.invalidateQueries({ queryKey: ["available-advisors"] });
      toast(editing ? "Usuario actualizado." : "Usuario creado.");
      setModalOpen(false);
    },
    onError: (e) => toast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/users/${id}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-admin"] });
      toast("Usuario eliminado.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Administradores y asesores con acceso al panel."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setForm({ name: "", email: "", password: "", role: "ASESOR", is_active: true, advisor_id: "" });
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        }
      />

      {!users || users.length === 0 ? (
        <Card>
          <EmptyState title="Sin usuarios" description="Crea usuarios para el equipo." />
        </Card>
      ) : (
        <Table headers={["Nombre", "Correo", "Rol", "Asesor vinculado", "Estado", "Acciones"]}>
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-netland-light/30">
              <td className="px-5 py-3 font-medium text-netland-dark">{user.name}</td>
              <td className="px-5 py-3 text-netland-muted">{user.email}</td>
              <td className="px-5 py-3">
                <Badge color={roleColors[user.role] ?? "#6b7280"}>{ROLE_LABELS[user.role] ?? user.role}</Badge>
              </td>
              <td className="px-5 py-3 text-sm text-netland-muted">
                {user.advisor_name ? (
                  <span className="inline-flex items-center gap-1.5 text-netland-primary">
                    <UserRoundCheck className="h-4 w-4" />
                    {user.advisor_name}
                  </span>
                ) : "—"}
              </td>
              <td className="px-5 py-3">
                <Badge color={user.is_active ? "#16a34a" : "#dc2626"}>
                  {user.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </td>
              <td className="px-5 py-3">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="!px-2.5 !py-1.5"
                    onClick={() => {
                      setEditing(user);
                      setForm({
                        name: user.name,
                        email: user.email,
                        password: "",
                        role: user.role,
                        is_active: user.is_active,
                        advisor_id: "",
                      });
                      setModalOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="danger"
                    className="!px-2.5 !py-1.5"
                    onClick={async () => {
                      if (await confirm(`¿Eliminar a ${user.name}?`)) {
                        deleteMutation.mutate(user.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar usuario" : "Nuevo usuario"}>
        <div className="space-y-4 p-6">
          <Field label="Nombre">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Correo">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label={editing ? "Contraseña (dejar vacío para no cambiar)" : "Contraseña"}>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Rol">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {!editing && form.role === "ASESOR" && (
            <Field label="Perfil de asesor">
              <Select
                value={form.advisor_id}
                onChange={(e) => setForm({ ...form, advisor_id: e.target.value })}
              >
                <option value="">Crear sin vincular por ahora</option>
                {availableAdvisors?.map((advisor) => (
                  <option key={advisor.id} value={advisor.id}>
                    {advisor.name}{advisor.email ? ` · ${advisor.email}` : ""}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-netland-muted">
                Solo aparecen perfiles de asesor que aún no tienen usuario.
              </p>
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 accent-netland-primary"
            />
            Usuario activo
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {editing ? "Guardar" : "Crear usuario"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}