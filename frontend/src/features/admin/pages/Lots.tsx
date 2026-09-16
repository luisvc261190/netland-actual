import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { api } from "../../../lib/api";
import type { Block, Lot, Project } from "../../../types";
import { LOT_STATUS_COLORS, LOT_STATUS_LABELS, formatSoles } from "../../../lib/constants";
import { PageHeader, Button, Card, Field, Input, Select, Table } from "../ui";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useAuth } from "../AuthContext";

interface LotFormState {
  block_id: string;
  code: string;
  lot_number: string;
  area_m2: string;
  price: string;
  promo_price: string;
  status: string;
  notes: string;
}

const emptyForm: LotFormState = {
  block_id: "",
  code: "",
  lot_number: "",
  area_m2: "",
  price: "",
  promo_price: "",
  status: "available",
  notes: "",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

type PageItem = number | "ellipsis-left" | "ellipsis-right";

function getPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: PageItem[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("ellipsis-left");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push("ellipsis-right");
  items.push(total);
  return items;
}

export default function AdminLots() {
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();
  const { user } = useAuth();
  const canManageLots = ["SUPER_ADMIN", "ADMIN"].includes(
    (user?.role ?? "").toUpperCase()
  );
  const [projectId, setProjectId] = useState<number | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lot | null>(null);
  const [form, setForm] = useState<LotFormState>(emptyForm);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [search, setSearch] = useState("");

  const { data: projects } = useQuery({
    queryKey: ["projects-admin"],
    queryFn: ({ signal }) => api.get<Project[]>("/projects", false, signal),
  });

  const selectedProject = projectId || projects?.[0]?.id;

  const {
    data: lots,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-lots", selectedProject],
    queryFn: ({ signal }) => api.get<Lot[]>(`/projects/${selectedProject}/lots`, false, signal),
    enabled: !!selectedProject,
  });

  const filteredLots = useMemo(() => {
    if (!lots) return [];
    const term = search.trim().toLowerCase();
    if (!term) return lots;
    return lots.filter((lot) => {
      const haystack = [
        lot.code,
        lot.block_code,
        lot.lot_number?.toString(),
        lot.area_m2?.toString(),
        lot.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [lots, search]);

  const totalLots = filteredLots.length;
  const totalPages = Math.max(1, Math.ceil(totalLots / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLots = filteredLots.slice(startIndex, startIndex + pageSize);

  const { data: blocks } = useQuery({
    queryKey: ["admin-blocks", selectedProject],
    queryFn: ({ signal }) => api.get<Block[]>(`/projects/${selectedProject}/blocks`, false, signal),
    enabled: !!selectedProject,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editing
        ? api.put(`/projects/lots/${editing.id}`, payload, true)
        : api.post("/projects/lots", { project_id: selectedProject, ...payload }, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lots"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast(editing ? "Lote actualizado." : "Lote creado.");
      setModalOpen(false);
    },
    onError: (e) => toast(e.message, "error"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/projects/lots/${id}/status`, { status }, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lots"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast("Estado actualizado.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/projects/lots/${id}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lots"] });
      toast("Lote eliminado.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (lot: Lot) => {
    setEditing(lot);
    setForm({
      block_id: lot.block_id?.toString() ?? "",
      code: lot.code,
      lot_number: lot.lot_number?.toString() ?? "",
      area_m2: lot.area_m2?.toString() ?? "",
      price: lot.price?.toString() ?? "",
      promo_price: lot.promo_price?.toString() ?? "",
      status: lot.status,
      notes: lot.notes ?? "",
    });
    setModalOpen(true);
  };

  const submit = () => {
    const payload: Record<string, unknown> = {
      block_id: form.block_id ? Number(form.block_id) : null,
      code: form.code,
      lot_number: form.lot_number ? Number(form.lot_number) : null,
      area_m2: form.area_m2 ? Number(form.area_m2) : null,
      price: form.price ? Number(form.price) : null,
      promo_price: form.promo_price ? Number(form.promo_price) : null,
      status: form.status,
      notes: form.notes,
    };
    if (!payload.code) {
      toast("El código del lote es obligatorio.", "error");
      return;
    }
    saveMutation.mutate(payload);
  };

  return (
    <div>
      <PageHeader
        title="Lotes"
        subtitle="Administra manzanas y lotes de cada proyecto."
        action={
          canManageLots ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo lote
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xs flex-1">
          <Field label="Proyecto">
            <Select
              value={selectedProject ?? ""}
              onChange={(e) => {
                setProjectId(e.target.value ? Number(e.target.value) : "");
                setPage(1);
              }}
            >
              <option value="">Seleccionar proyecto...</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.short_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="min-w-64 flex-1">
          <Field label="Buscar lote">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-netland-muted" />
              <Input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por código, manzana, número..."
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
                  title="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </Field>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <div className="py-8">
            <CoreSpinLoader />
          </div>
        </Card>
      ) : isError ? (
        <Card>
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <EmptyState
              title="No se pudieron cargar los lotes"
              description="Ocurrió un error al consultar el proyecto. Intenta nuevamente."
            />
            <Button
              variant="outline"
              onClick={() => refetch()}
            >
              Reintentar
            </Button>
          </div>
        </Card>
      ) : (lots?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            title="Sin lotes en este proyecto"
            description="Crea manzanas y lotes desde este módulo."
          />
        </Card>
      ) : filteredLots.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin resultados"
            description={`No se encontraron lotes que coincidan con «${search}».`}
          />
        </Card>
      ) : (
        <>
          <Table headers={["Código", "Manzana", "N° lote", "Área", "Precio", "Promoción", "Estado", "Acciones"]}>
          {paginatedLots.map((lot) => (
            <tr key={lot.id} className="hover:bg-netland-light/30">
              <td className="px-5 py-3 font-semibold text-netland-dark">{lot.code}</td>
              <td className="px-5 py-3">{lot.block_code ?? "—"}</td>
              <td className="px-5 py-3">{lot.lot_number ?? "—"}</td>
              <td className="px-5 py-3">{lot.area_m2 ? `${lot.area_m2} m²` : "—"}</td>
              <td className="px-5 py-3">{formatSoles(lot.price)}</td>
              <td className="px-5 py-3 font-medium text-netland-accent">
                {formatSoles(lot.promo_price)}
              </td>
              <td className="px-5 py-3">
                <Select
                  value={lot.status}
                  onChange={(e) =>
                    statusMutation.mutate({ id: lot.id, status: e.target.value })
                  }
                  className="!w-auto !px-2 !py-1 text-xs font-semibold"
                  style={{
                    color: LOT_STATUS_COLORS[lot.status],
                    borderColor: LOT_STATUS_COLORS[lot.status] + "55",
                  }}
                >
                  {Object.entries(LOT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </td>
              <td className="px-5 py-3">
                {canManageLots && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="!px-2.5 !py-1.5" onClick={() => openEdit(lot)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="danger"
                      className="!px-2.5 !py-1.5"
                      onClick={async () => {
                        if (
                          await confirm(
                            `¿Eliminar el lote ${lot.code}?`
                          )
                        ) {
                          deleteMutation.mutate(lot.id);
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-netland-muted">
            Mostrando{" "}
            <span className="font-semibold text-netland-dark">
              {totalLots === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + pageSize, totalLots)}
            </span>{" "}
            de <span className="font-semibold text-netland-dark">{totalLots}</span> lotes
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="!w-auto !px-2 !py-1.5 text-xs"
              aria-label="Lotes por página"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} por página
                </option>
              ))}
            </Select>

            <Button
              variant="outline"
              className="!px-2.5 !py-1.5"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {getPageItems(currentPage, totalPages).map((item) =>
              typeof item === "number" ? (
                <button
                  key={item}
                  onClick={() => setPage(item)}
                  aria-current={item === currentPage ? "page" : undefined}
                  className={`h-8 min-w-8 rounded-sm px-2 text-sm font-semibold transition-colors ${
                    item === currentPage
                      ? "bg-netland-primary text-white"
                      : "border border-netland-light bg-white text-netland-dark hover:border-netland-primary hover:text-netland-primary"
                  }`}
                >
                  {item}
                </button>
              ) : (
                <span key={item} className="px-1 text-sm text-netland-muted">
                  …
                </span>
              ),
            )}

            <Button
              variant="outline"
              className="!px-2.5 !py-1.5"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Editar lote ${editing.code}` : "Nuevo lote"}
        wide
      >
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Código del lote">
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MZ A - LT 05" />
          </Field>
          <Field label="Número de lote">
            <Input type="number" value={form.lot_number} onChange={(e) => setForm({ ...form, lot_number: e.target.value })} />
          </Field>
          <Field label="Manzana">
            <Select value={form.block_id} onChange={(e) => setForm({ ...form, block_id: e.target.value })}>
              <option value="">Sin manzana</option>
              {(blocks ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(LOT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Área (m²)">
            <Input type="number" value={form.area_m2} onChange={(e) => setForm({ ...form, area_m2: e.target.value })} />
          </Field>
          <Field label="Precio (S/)">
            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Precio promocional (S/)">
            <Input type="number" value={form.promo_price} onChange={(e) => setForm({ ...form, promo_price: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observaciones">
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-3 sm:col-span-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saveMutation.isPending}>
              {editing ? "Guardar cambios" : "Crear lote"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}