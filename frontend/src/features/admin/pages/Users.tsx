import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertCircle, Pencil, Plus, Trash2, UserRoundCheck } from "lucide-react";
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  is_active: boolean;
  advisor_id: string;
  user_quota: string;
}

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  advisor_id?: string;
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

const emptyErrors: FieldErrors = {};

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-start gap-1 text-xs text-red-600">
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
      {msg}
    </p>
  );
}

function validateForm(form: UserForm, editing: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) {
    errors.name = "El nombre es obligatorio.";
  } else if (form.name.trim().length < 2) {
    errors.name = "El nombre debe tener al menos 2 caracteres.";
  }
  if (!form.email.trim()) {
    errors.email = "El correo es obligatorio.";
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errors.email = "Ingresa un correo electrónico válido (ej: nombre@dominio.com).";
  }
  if (!editing && !form.password) {
    errors.password = "La contraseña es obligatoria.";
  } else if (form.password && form.password.length < 8) {
    errors.password = "La contraseña debe tener al menos 8 caracteres.";
  }
  return errors;
}

const serverErrorToField = (msg: string): FieldErrors => {
  const lower = msg.toLowerCase();
  if (lower.includes("correo") || lower.includes("@")) return { email: msg };
  if (lower.includes("contrase") || lower.includes("clave") || lower.includes("password"))
    return { password: msg };
  if (lower.includes("nombre") || lower.includes("«name»")) return { name: msg };
  if (lower.includes("rol")) return { role: msg };
  if (lower.includes("asesor") || lower.includes("perfil")) return { advisor_id: msg };
  return {};
};

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();
  const { user: me } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(emptyErrors);

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
      const clientErrors = validateForm(form, Boolean(editing));
      if (Object.keys(clientErrors).length > 0) {
        setFieldErrors(clientErrors);
        throw new Error(
          Object.values(clientErrors)[0] ?? "Revisa los campos marcados en rojo.",
        );
      }
      if (editing) {
        const payload: Record<string, unknown> = { role: form.role, is_active: form.is_active };
        if (form.name) payload.name = form.name;
        if (form.email) payload.email = form.email.trim().toLowerCase();
        if (form.password) payload.password = form.password;
        if (isSuperAdmin && form.role === "ADMIN" && form.user_quota !== "") {
          payload.user_quota = Number(form.user_quota);
        }
        return api.put(`/users/${editing.id}`, payload, true);
      }
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
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
      setFieldErrors(emptyErrors);
      toast(editing ? "Usuario actualizado." : "Usuario creado.");
      setModalOpen(false);
    },
    onError: (e) => {
      const mapped = serverErrorToField(e.message ?? "");
      if (Object.keys(mapped).length > 0) {
        setFieldErrors(mapped);
        return;
      }
      setFieldErrors(emptyErrors);
      toast(e.message ?? "Ocurrió un error al guardar el usuario.", "error");
    },
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
    setFieldErrors(emptyErrors);
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
    setFieldErrors(emptyErrors);
    setModalOpen(true);
  };

  const clearFieldError = (key: keyof FieldErrors) => {
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
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
            <Input
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                clearFieldError("name");
              }}
            />
            <FieldError msg={fieldErrors.name} />
          </Field>
          <Field label="Correo">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => {
                setForm({ ...form, email: e.target.value });
                clearFieldError("email");
              }}
            />
            <p className="mt-1 text-xs text-netland-muted">
              Será la credencial de inicio de sesión y debe ser único en el sistema.
            </p>
            <FieldError msg={fieldErrors.email} />
          </Field>
          <Field label={editing ? "Contraseña (dejar vacío para no cambiar)" : "Contraseña"}>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => {
                setForm({ ...form, password: e.target.value });
                clearFieldError("password");
              }}
            />
            <p className="mt-1 text-xs text-netland-muted">Mínimo 8 caracteres.</p>
            <FieldError msg={fieldErrors.password} />
          </Field>
          <Field label="Rol">
            <Select
              value={form.role}
              onChange={(e) => {
                setForm({ ...form, role: e.target.value, user_quota: e.target.value === "ADMIN" ? form.user_quota : "" });
                clearFieldError("role");
              }}
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
            <FieldError msg={fieldErrors.role} />
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
                onChange={(e) => {
                  setForm({ ...form, advisor_id: e.target.value });
                  clearFieldError("advisor_id");
                }}
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
              <FieldError msg={fieldErrors.advisor_id} />
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