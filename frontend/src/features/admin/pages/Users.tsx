import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, UserRoundCheck } from "lucide-react";
import { api } from "../../../lib/api";
import { ROLE_LABELS, ROLE_COLORS } from "../../../lib/constants";
import type { Advisor, User } from "../../../types";
import { PageHeader, Button, Card, Field, Input, Select, Table, Badge } from "../ui";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useAuth } from "../AuthContext";

const roleColors: Record<string, string> = ROLE_COLORS;
const PRIVILEGED_ROLES = ["SUPER_ADMIN", "ADMIN"];

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  is_active: boolean;
  advisor_id: string;
  user_quota: string;
}

const emptyForm: UserForm = {
  name: "",
  email: "",
  password: "",
  role: "ASESOR",
  is_active: true,
  advisor_id: "",
  user_quota: "",
};

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();
  const { user: me } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const isSuperAdmin = me?.role?.toUpperCase() === "SUPER_ADMIN";
  const myId = me?.id;

  const { data: users = [] } = useQuery({
    queryKey: ["users-admin"],
    queryFn: ({ signal }) => api.get<User[]>("/users", true, signal),
  });

  const { data: availableAdvisors } = useQuery({
    queryKey: ["available-advisors"],
    queryFn: ({ signal }) => api.get<Advisor[]>("/users/available-advisors", true, signal),
    enabled: modalOpen && !editing && form.role === "ASESOR",
  });

  // Cuota del admin que está logueado.
  const quotaStats = useMemo(() => {
    const quota = me?.user_quota ?? 0;
    const created = users.filter((u) => u.created_by === myId).length;
    return { quota, created, remaining: Math.max(0, quota - created) };
  }, [me, users, myId]);

  const allowedRoles = useMemo(() => {
    const all = Object.keys(ROLE_LABELS);
    return isSuperAdmin ? all : all.filter((r) => !PRIVILEGED_ROLES.includes(r));
  }, [isSuperAdmin]);

  const canManage = (user: User) =>
    isSuperAdmin || (user.created_by != null && user.created_by === myId);

  const canCreate = isSuperAdmin || (quotaStats.quota > 0 && quotaStats.remaining > 0);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editing) {
        const payload: Record<string, unknown> = { role: form.role, is_active: form.is_active };
        if (form.name) payload.name = form.name;
        if (form.email) payload.email = form.email;
        if (form.password) payload.password = form.password;
        if (isSuperAdmin && form.role === "ADMIN" && form.user_quota !== "") {
          payload.user_quota = Number(form.user_quota);
        }
        return api.put(`/users/${editing.id}`, payload, true);
      }
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        is_active: form.is_active,
        advisor_id: form.role === "ASESOR" && form.advisor_id ? Number(form.advisor_id) : null,
      };
      return api.post("/users", payload, true);
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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      is_active: user.is_active,
      advisor_id: "",
      user_quota: user.user_quota != null ? String(user.user_quota) : "",
    });
    setModalOpen(true);
  };

  const showQuotaField = isSuperAdmin && editing?.role === "ADMIN";

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Administradores y asesores con acceso al panel."
        action={
          <Button onClick={openCreate} disabled={!canCreate}>
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        }
      />

      {!isSuperAdmin && (
        <Card className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-netland-dark">Creación de usuarios</p>
              <p className="mt-1 text-sm text-netland-muted">
                {quotaStats.quota > 0
                  ? `Puedes crear ${quotaStats.remaining} de ${quotaStats.quota} usuarios.`
                  : "Aún no tienes cuota asignada para crear usuarios. Solicita al super administrador que la configure."}
              </p>
            </div>
            <Badge color={quotaStats.remaining > 0 ? "#16a34a" : "#dc2626"}>
              {quotaStats.quota > 0 ? `${quotaStats.remaining}/${quotaStats.quota} disponibles` : "Sin cuota"}
            </Badge>
          </div>
        </Card>
      )}

      {users.length === 0 ? (
        <Card>
          <EmptyState title="Sin usuarios" description="Crea usuarios para el equipo." />
        </Card>
      ) : (
        <Table
          headers={["Nombre", "Correo", "Rol", "Asesor vinculado", "Cuota de usuarios", "Estado", "Acciones"]}
        >
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
              <td className="px-5 py-3 text-sm text-netland-muted">
                {user.role === "ADMIN" ? (user.user_quota != null ? user.user_quota : "—") : "—"}
              </td>
              <td className="px-5 py-3">
                <Badge color={user.is_active ? "#16a34a" : "#dc2626"}>
                  {user.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </td>
              <td className="px-5 py-3">
                {canManage(user) && user.id !== myId && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="!px-2.5 !py-1.5" onClick={() => openEdit(user)}>
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
                )}
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
            <Select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value, user_quota: e.target.value === "ADMIN" ? form.user_quota : "" })}
            >
              {allowedRoles.map((key) => (
                <option key={key} value={key}>
                  {ROLE_LABELS[key] ?? key}
                </option>
              ))}
            </Select>
            {!isSuperAdmin && (
              <p className="mt-1 text-xs text-netland-muted">
                Los roles de administración son exclusivos del super administrador.
              </p>
            )}
          </Field>
          {showQuotaField && (
            <Field
              label="Cuota de usuarios"
              hint="Cantidad máxima de usuarios que este administrador podrá crear."
            >
              <Input
                type="number"
                min="0"
                step="1"
                value={form.user_quota}
                onChange={(e) => setForm({ ...form, user_quota: e.target.value })}
                placeholder="Ej: 10"
              />
            </Field>
          )}
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