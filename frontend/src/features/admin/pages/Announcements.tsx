import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BadgePercent, Eye, EyeOff, Image as ImageIcon, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../../../lib/api";
import type { Announcement } from "../../../types";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table, Textarea } from "../ui";
import { Modal } from "../../../components/ui/Modal";
import { FileUploader } from "../../../components/ui/FileUploader";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";

interface FormState {
  title: string;
  description: string;
  kind: "announcement" | "promotion";
  media_type: "image" | "video";
  image_url: string;
  button_phone: string;
  start_date: string;
  end_date: string;
}

const emptyForm: FormState = {
  title: "",
  description: "",
  kind: "promotion",
  media_type: "image",
  image_url: "",
  button_phone: "",
  start_date: "",
  end_date: "",
};

function formatDate(value: string | null): string {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export default function AdminAnnouncements() {
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: announcements } = useQuery({
    queryKey: ["announcements-admin"],
    queryFn: () => api.get<Announcement[]>("/announcements", true),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        description: form.description,
        kind: form.kind,
        media_type: form.media_type,
        image_url: form.image_url,
        button_phone: form.button_phone,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      return editing
        ? api.put(`/announcements/${editing.id}`, payload, true)
        : api.post("/announcements", payload, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements-admin"] });
      queryClient.invalidateQueries({ queryKey: ["announcements-active"] });
      toast(editing ? "Anuncio actualizado." : "Anuncio creado.");
      setModalOpen(false);
    },
    onError: (e) => toast(e.message, "error"),
  });

  const toggleMutation = useMutation({
    mutationFn: (announcement: Announcement) =>
      api.put(`/announcements/${announcement.id}`, { is_active: !announcement.is_active }, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements-admin"] });
      queryClient.invalidateQueries({ queryKey: ["announcements-active"] });
    },
    onError: (e) => toast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/announcements/${id}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements-admin"] });
      queryClient.invalidateQueries({ queryKey: ["announcements-active"] });
      toast("Anuncio eliminado.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (announcement: Announcement) => {
    setEditing(announcement);
    setForm({
      title: announcement.title,
      description: announcement.description,
      kind: announcement.kind ?? "promotion",
      media_type: announcement.media_type ?? "image",
      image_url: announcement.image_url,
      button_phone: announcement.button_phone,
      start_date: announcement.start_date ?? "",
      end_date: announcement.end_date ?? "",
    });
    setModalOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Anuncios"
        subtitle="Pop-ups que se muestran en la web pública: promociones, rifas y eventos."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo anuncio
          </Button>
        }
      />

      {!announcements || announcements.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin anuncios"
            description="Crea un anuncio para mostrarlo como pop-up al abrir la web pública."
          />
        </Card>
      ) : (
        <Table headers={["Tipo", "Anuncio", "Vigencia", "Frecuencia", "Estado", "Acciones"]}>
          {announcements.map((announcement) => (
            <tr key={announcement.id} className="hover:bg-netland-light/30">
              <td className="px-5 py-3">
                <Badge color={announcement.kind === "promotion" ? "#e8a317" : "#1e40af"}>
                  {announcement.kind === "promotion" ? (
                    <><BadgePercent className="h-3 w-3" /> Promoción</>
                  ) : (
                    <><Megaphone className="h-3 w-3" /> Anuncio</>
                  )}
                </Badge>
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  {announcement.image_url ? (
                    <img
                      src={announcement.image_url}
                      alt={announcement.title}
                      className="h-12 w-16 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-16 items-center justify-center rounded-md bg-netland-light">
                      <ImageIcon className="h-5 w-5 text-netland-muted" />
                    </span>
                  )}
                  <div>
                    <p className="font-semibold text-netland-dark">{announcement.title}</p>
                    {announcement.description && (
                      <p className="max-w-xs truncate text-xs text-netland-muted">
                        {announcement.description}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-5 py-3 text-sm text-netland-muted">
                {announcement.start_date || announcement.end_date
                  ? `${formatDate(announcement.start_date) || "…"} → ${formatDate(announcement.end_date) || "…"}`
                  : "Siempre visible"}
              </td>
              <td className="px-5 py-3">
                <Badge color={announcement.once_per_session ? "#1e40af" : "#0d7a44"}>
                  {announcement.once_per_session ? "Una vez por sesión" : "Cada visita"}
                </Badge>
              </td>
              <td className="px-5 py-3">
                <Badge color={announcement.is_active ? "#16a34a" : "#9ca3af"}>
                  {announcement.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </td>
              <td className="px-5 py-3">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="!px-2.5 !py-1.5"
                    onClick={() => toggleMutation.mutate(announcement)}
                    title={announcement.is_active ? "Desactivar" : "Activar"}
                  >
                    {announcement.is_active ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="!px-2.5 !py-1.5"
                    onClick={() => openEdit(announcement)}
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="danger"
                    className="!px-2.5 !py-1.5"
                    onClick={async () => {
                      if (await confirm(`¿Eliminar el anuncio "${announcement.title}"?`)) {
                        deleteMutation.mutate(announcement.id);
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
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar anuncio" : "Nuevo anuncio"}
        wide
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="grid gap-4 p-6 sm:grid-cols-2"
        >
          <Field label="Título" className="sm:col-span-2">
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ej: ¡Gran rifa de este mes!"
              required
            />
          </Field>
          <Field label="Descripción" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Detalle de la promoción, rifa o evento."
            />
          </Field>
          <Field label="Tipo">
            <Select
              value={form.kind}
              onChange={(e) => set("kind", e.target.value as FormState["kind"])}
            >
              <option value="promotion">Promoción</option>
              <option value="announcement">Anuncio</option>
            </Select>
          </Field>
          <Field label="Medio">
            <Select
              value={form.media_type}
              onChange={(e) => set("media_type", e.target.value as FormState["media_type"])}
            >
              <option value="image">Imagen</option>
              <option value="video">Video</option>
            </Select>
          </Field>
          <Field label="Archivo" className="sm:col-span-2">
            <FileUploader
              label=""
              accept={form.media_type === "video" ? "video/*" : "image/*"}
              folder="announcements"
              currentUrl={form.image_url}
              hint={form.media_type === "video" ? "Video del pop-up. Máximo 25 MB." : "Imagen del pop-up. Formato recomendado: 800×450 px o superior."}
              onUploadComplete={(url) => set("image_url", url)}
              maxSizeMB={form.media_type === "video" ? 25 : 4}
            />
          </Field>
          <Field label="WhatsApp para solicitudes" hint="Si se ingresa un número, el botón del pop-up abrirá el chat de WhatsApp.">
            <Input
              type="tel"
              value={form.button_phone}
              onChange={(e) => set("button_phone", e.target.value.replace(/\D/g, "").slice(0, 15))}
              placeholder="985928062"
            />
          </Field>
          <Field label="Fecha de inicio">
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </Field>
          <Field label="Fecha de fin">
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => set("end_date", e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-3 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {editing ? "Guardar cambios" : "Crear anuncio"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}