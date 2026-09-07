import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, Search, X } from "lucide-react";
import { api } from "../../../lib/api";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Table,
  Field,
  Select,
  Input,
  Pagination,
} from "../../admin/ui";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { ClientInfo as Client } from "../../../types";
import type { OwnerWithClient } from "../types";
import ClientSelect from "../components/ClientSelect";
import {
  PERSON_TYPES,
  DOCUMENT_TYPES,
  formatSoles,
  getOwnerFullName,
} from "../constants";

interface OwnerFormState {
  client_id: string;
  person_type: "natural" | "juridica";
  document_type: string;
  document_number: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string;
  business_name: string;
  secondary_phone: string;
  address: string;
  district: string;
  province: string;
  department: string;
  birth_date: string;
  notes: string;
  is_active: boolean;
}

const emptyForm: OwnerFormState = {
  client_id: "",
  person_type: "natural",
  document_type: "DNI",
  document_number: "",
  first_name: "",
  paternal_surname: "",
  maternal_surname: "",
  business_name: "",
  secondary_phone: "",
  address: "",
  district: "",
  province: "",
  department: "",
  birth_date: "",
  notes: "",
  is_active: true,
};

export default function OwnersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OwnerWithClient | null>(null);
  const [form, setForm] = useState<OwnerFormState>(emptyForm);

  // Fetch owners
  const {
    data: owners,
    isLoading,
  } = useQuery({
    queryKey: ["owners", search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      return api.get<OwnerWithClient[]>(`/owners?${params.toString()}`, true);
    },
  });

  // Fetch clients for dropdown
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<Client[]>("/clients", true),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (payload: Partial<OwnerFormState>) =>
      editing
        ? api.put<{ id?: number }>(`/owners/${editing.id}`, payload, true)
        : api.post<{ id?: number }>("/owners", payload, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      if (editing) {
        toast("Propietario actualizado");
        setModalOpen(false);
        return;
      }
      toast("Propietario creado");
      setModalOpen(false);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/owners/${id}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      toast("Propietario eliminado");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const filteredOwners = owners || [];
  const totalOwners = filteredOwners.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedOwners = filteredOwners.slice(startIndex, startIndex + pageSize);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (owner: OwnerWithClient) => {
    setEditing(owner);
    setForm({
      client_id: owner.client_id.toString(),
      person_type: owner.person_type,
      document_type: owner.document_type,
      document_number: owner.document_number,
      first_name: owner.first_name || "",
      paternal_surname: owner.paternal_surname || "",
      maternal_surname: owner.maternal_surname || "",
      business_name: owner.business_name || "",
      secondary_phone: owner.secondary_phone || "",
      address: owner.address || "",
      district: owner.district || "",
      province: owner.province || "",
      department: owner.department || "",
      birth_date: owner.birth_date || "",
      notes: owner.notes || "",
      is_active: owner.is_active,
    });
    setModalOpen(true);
  };

  const handleClientChange = (client: Client | null) => {
    if (!client) {
      setForm((f) => ({ ...f, client_id: "" }));
      return;
    }
    setForm((f) => {
      const nameParts = (client.name || "").split(/\s+/).filter(Boolean);
      const lastParts = (client.last_name || "").split(/\s+/).filter(Boolean);

      const paternal =
        lastParts.length >= 2 ? lastParts.slice(0, lastParts.length - 1).join(" ") : "";
      const maternal = lastParts.length >= 2 ? lastParts[lastParts.length - 1] : "";

      return {
        ...f,
        client_id: String(client.id),
        first_name: nameParts.join(" "),
        paternal_surname: lastParts.length === 1 ? lastParts[0] : paternal,
        maternal_surname: lastParts.length === 1 ? "" : maternal,
        business_name: [client.name, client.last_name].filter(Boolean).join(" ").trim(),
        secondary_phone: f.secondary_phone || client.whatsapp || "",
      };
    });
  };

  const submit = () => {
    if (!form.client_id) {
      toast("Selecciona un cliente", "error");
      return;
    }
    if (!form.document_number) {
      toast("El número de documento es obligatorio", "error");
      return;
    }
    if (form.person_type === "natural" && !form.first_name) {
      toast("El nombre es obligatorio para persona natural", "error");
      return;
    }
    if (form.person_type === "juridica" && !form.business_name) {
      toast("La razón social es obligatoria para persona jurídica", "error");
      return;
    }

    const payload: any = {
      client_id: Number(form.client_id),
      person_type: form.person_type,
      document_type: form.document_type,
      document_number: form.document_number,
      secondary_phone: form.secondary_phone || null,
      address: form.address || null,
      district: form.district || null,
      province: form.province || null,
      department: form.department || null,
      birth_date: form.birth_date || null,
      notes: form.notes || null,
      is_active: form.is_active,
    };

    if (form.person_type === "natural") {
      payload.first_name = form.first_name || null;
      payload.paternal_surname = form.paternal_surname || null;
      payload.maternal_surname = form.maternal_surname || null;
    } else {
      payload.business_name = form.business_name || null;
    }

    saveMutation.mutate(payload);
  };

  return (
    <div>
      <PageHeader
        title="Propietarios"
        subtitle="Gestiona los propietarios de lotes y contratos."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo Propietario
          </Button>
        }
      />

      {/* Search Filter */}
      <Card className="mb-6">
        <Field label="Buscar propietario">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-netland-muted" />
            <Input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nombre, documento, teléfono..."
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
      </Card>

      {/* Owners Table */}
      {isLoading ? (
        <Card>
          <div className="py-8">
            <CoreSpinLoader />
          </div>
        </Card>
      ) : totalOwners === 0 ? (
        <Card>
          <EmptyState
            title="Sin propietarios"
            description={
              search
                ? `No se encontraron propietarios que coincidan con «${search}».`
                : "Crea tu primer propietario para comenzar."
            }
          />
        </Card>
      ) : (
        <>
          <Table
            headers={[
              "Propietario",
              "Tipo",
              "Documento",
              "Contacto",
              "Propiedades",
              "Deuda Total",
              "Estado",
              "Acciones",
            ]}
          >
            {paginatedOwners.map((owner) => (
              <tr key={owner.id} className="hover:bg-netland-light/30">
                <td className="px-5 py-3">
                  <p className="font-semibold text-netland-dark">
                    {getOwnerFullName(owner)}
                  </p>
                </td>
                <td className="px-5 py-3 text-xs uppercase text-netland-muted">
                  {PERSON_TYPES[owner.person_type]}
                </td>
                <td className="px-5 py-3">
                  <p className="text-sm font-medium">{owner.document_type}</p>
                  <p className="text-xs text-netland-muted">{owner.document_number}</p>
                </td>
                <td className="px-5 py-3">
                  <p className="text-sm">{owner.client_phone}</p>
                  <p className="text-xs text-netland-muted">{owner.client_email}</p>
                </td>
                <td className="px-5 py-3 text-center font-semibold text-netland-primary">
                  {owner.total_properties}
                </td>
                <td className="px-5 py-3">
                  <p className="font-semibold text-netland-dark">
                    {formatSoles(owner.total_debt)}
                  </p>
                  {owner.overdue_debt > 0 && (
                    <p className="text-xs font-medium text-red-600">
                      Vencido: {formatSoles(owner.overdue_debt)}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3">
                  <Badge color={owner.is_active ? "#16a34a" : "#9ca3af"}>
                    {owner.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="!px-2.5 !py-1.5"
                      onClick={() => navigate(`/admin/propietarios/${owner.id}`)}
                      title="Ver detalle"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      className="!px-2.5 !py-1.5"
                      onClick={() => openEdit(owner)}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="danger"
                      className="!px-2.5 !py-1.5"
                      onClick={async () => {
                        if (await confirm(`¿Eliminar al propietario ${getOwnerFullName(owner)}?`)) {
                          deleteMutation.mutate(owner.id);
                        }
                      }}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalOwners}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            unitLabel="propietarios"
          />
        </>
      )}

      {/* Form Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Editar: ${getOwnerFullName(editing)}` : "Nuevo Propietario"}
        wide
      >
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Cliente relacionado" className="sm:col-span-2">
            <ClientSelect
              clients={clients}
              value={form.client_id}
              onChange={handleClientChange}
              disabled={!!editing}
            />
            {!editing && form.client_id && (
              <span className="mt-1 block text-xs text-netland-primary">
                Datos del cliente copiados al formulario. Puedes ajustarlos si lo necesitas.
              </span>
            )}
          </Field>

          <Field label="Tipo de Persona">
            <Select
              value={form.person_type}
              onChange={(e) =>
                setForm({ ...form, person_type: e.target.value as "natural" | "juridica" })
              }
            >
              {Object.entries(PERSON_TYPES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tipo de Documento">
            <Select
              value={form.document_type}
              onChange={(e) => setForm({ ...form, document_type: e.target.value })}
            >
              {Object.entries(DOCUMENT_TYPES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Número de Documento" className="sm:col-span-2">
            <Input
              value={form.document_number}
              onChange={(e) => setForm({ ...form, document_number: e.target.value })}
              placeholder="12345678"
            />
          </Field>

          {form.person_type === "natural" ? (
            <>
              <Field label="Nombres">
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </Field>
              <Field label="Apellido Paterno">
                <Input
                  value={form.paternal_surname}
                  onChange={(e) => setForm({ ...form, paternal_surname: e.target.value })}
                />
              </Field>
              <Field label="Apellido Materno">
                <Input
                  value={form.maternal_surname}
                  onChange={(e) => setForm({ ...form, maternal_surname: e.target.value })}
                />
              </Field>
            </>
          ) : (
            <Field label="Razón Social" className="sm:col-span-2">
              <Input
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              />
            </Field>
          )}

          <Field label="Teléfono Secundario">
            <Input
              value={form.secondary_phone}
              onChange={(e) => setForm({ ...form, secondary_phone: e.target.value })}
            />
          </Field>

          <Field label="Fecha de Nacimiento">
            <Input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            />
          </Field>

          <Field label="Dirección" className="sm:col-span-2">
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>

          <Field label="Distrito">
            <Input
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
            />
          </Field>

          <Field label="Provincia">
            <Input
              value={form.province}
              onChange={(e) => setForm({ ...form, province: e.target.value })}
            />
          </Field>

          <Field label="Departamento" className="sm:col-span-2">
            <Input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
          </Field>

          <Field label="Observaciones" className="sm:col-span-2">
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-netland-light text-netland-primary focus:ring-netland-primary"
              />
              <span className="text-sm font-medium text-netland-dark">Propietario activo</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 sm:col-span-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? "Guardando..."
                : editing
                  ? "Guardar cambios"
                  : "Crear propietario"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
