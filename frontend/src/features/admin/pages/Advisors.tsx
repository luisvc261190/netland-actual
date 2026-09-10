import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { api } from "../../../lib/api";
import type { Advisor } from "../../../types";
import { PageHeader, Button, Card, Field, Input, Textarea, Table, Badge } from "../ui";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { EmptyState } from "../../../components/ui/EmptyState";
import { FileUploader } from "../../../components/ui/FileUploader";

const emptyForm = {
  name: "",
  role_title: "Asesor Inmobiliario",
  photo_url: "",
  phone: "",
  whatsapp: "",
  email: "",
  is_available: true,
  bio: "",
};

export default function AdminAdvisors() {
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Advisor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploadMethod, setUploadMethod] = useState<"url" | "upload">("upload");

  const { data: advisors } = useQuery({
    queryKey: ["advisors-admin"],
    queryFn: () => api.get<Advisor[]>("/advisors"),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? api.put(`/advisors/${editing.id}`, form, true)
        : api.post("/advisors", form, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advisors-admin"] });
      toast(editing ? "Asesor actualizado." : "Asesor creado.");
      setModalOpen(false);
    },
    onError: (e) => toast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/advisors/${id}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advisors-admin"] });
      toast("Asesor eliminado.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setUploadMethod("upload");
    setModalOpen(true);
  };

  const openEdit = (advisor: Advisor) => {
    setEditing(advisor);
    setForm({
      name: advisor.name,
      role_title: advisor.role_title,
      photo_url: advisor.photo_url,
      phone: advisor.phone,
      whatsapp: advisor.whatsapp,
      email: advisor.email ?? "",
      is_available: advisor.is_available,
      bio: advisor.bio,
    });
    setUploadMethod(advisor.photo_url ? "url" : "upload");
    setModalOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Asesores"
        subtitle="Equipo comercial de Netland."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo asesor
          </Button>
        }
      />

      {!advisors || advisors.length === 0 ? (
        <Card>
          <EmptyState title="Sin asesores" description="Agrega el equipo comercial de Netland." />
        </Card>
      ) : (
        <Table headers={["Asesor", "Cargo", "Celular", "Estado", "Acciones"]}>
          {advisors.map((advisor) => (
            <tr key={advisor.id} className="hover:bg-netland-light/30">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  {advisor.photo_url ? (
                    <img src={advisor.photo_url} alt={advisor.name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-netland-light font-display font-semibold text-netland-primary">
                      {advisor.name.charAt(0)}
                    </div>
                  )}
                  <span className="font-semibold text-netland-dark">{advisor.name}</span>
                </div>
              </td>
              <td className="px-5 py-3 text-netland-muted">{advisor.role_title}</td>
              <td className="px-5 py-3">
                <p className="text-netland-muted">{advisor.phone || "—"}</p>
                {advisor.phone && (
                  <a
                    href={`https://wa.me/${advisor.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${advisor.name.split(" ")[0]}, te contactamos desde Netland.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-green-600 hover:underline"
                  >
                    WhatsApp →
                  </a>
                )}
              </td>
              <td className="px-5 py-3">
                <Badge color={advisor.is_available ? "#16a34a" : "#9ca3af"}>
                  {advisor.is_available ? "Disponible" : "No disponible"}
                </Badge>
              </td>
              <td className="px-5 py-3">
                <div className="flex gap-2">
                  <Button variant="outline" className="!px-2.5 !py-1.5" onClick={() => openEdit(advisor)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="danger"
                    className="!px-2.5 !py-1.5"
                    onClick={async () => {
                      if (await confirm(`¿Eliminar a ${advisor.name}?`)) {
                        deleteMutation.mutate(advisor.id);
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Editar ${editing.name}` : "Nuevo asesor"}
      >
        <div className="space-y-4 p-6">
          <Field label="Nombre completo">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          
          <Field label="Cargo">
            <Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} />
          </Field>

          {/* Foto del asesor */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-netland-dark">
              Foto del asesor
            </label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setUploadMethod("upload")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  uploadMethod === "upload"
                    ? "border-netland-primary bg-netland-primary/5 text-netland-primary"
                    : "border-netland-light bg-white text-netland-muted hover:border-netland-primary/30"
                }`}
              >
                <Upload className="mx-auto h-4 w-4" />
                Subir foto
              </button>
              <button
                type="button"
                onClick={() => setUploadMethod("url")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  uploadMethod === "url"
                    ? "border-netland-primary bg-netland-primary/5 text-netland-primary"
                    : "border-netland-light bg-white text-netland-muted hover:border-netland-primary/30"
                }`}
              >
                URL
              </button>
            </div>

            {uploadMethod === "upload" ? (
              <FileUploader
                accept="image/*"
                folder="advisors"
                onUploadComplete={(url) => setForm({ ...form, photo_url: url })}
                maxSizeMB={5}
                label=""
                hint="Formatos: JPG, PNG, WebP. Máximo 5MB. Recomendado: foto profesional con fondo neutro."
                preview={true}
                currentUrl={form.photo_url}
              />
            ) : (
              <Input 
                value={form.photo_url} 
                onChange={(e) => setForm({ ...form, photo_url: e.target.value })} 
                placeholder="https://res.cloudinary.com/..."
              />
            )}
          </div>

          <Field label="Celular (con código de país para WhatsApp)">
            <Input 
              value={form.phone} 
              onChange={(e) => setForm({ ...form, phone: e.target.value })} 
              placeholder="51985928062"
            />
            <p className="mt-1 text-xs text-netland-muted">
              Este número se usará también para WhatsApp. Incluye el código de país (ej: 51 para Perú).
            </p>
          </Field>

          <Field label="Correo electrónico">
            <Input 
              type="email" 
              value={form.email} 
              onChange={(e) => setForm({ ...form, email: e.target.value })} 
              placeholder="asesor@netlandcorp.com"
            />
          </Field>

          <Field label="Biografía">
            <Textarea 
              rows={3} 
              value={form.bio} 
              onChange={(e) => setForm({ ...form, bio: e.target.value })} 
              placeholder="Describe la experiencia y especialización del asesor..."
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_available}
              onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
              className="h-4 w-4 accent-netland-primary"
            />
            Disponible para nuevos clientes (se mostrará en la web pública)
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {editing ? "Guardar cambios" : "Crear asesor"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}