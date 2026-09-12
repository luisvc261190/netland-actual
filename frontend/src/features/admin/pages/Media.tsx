import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, Plus, Trash2, Video, Upload } from "lucide-react";
import { api } from "../../../lib/api";
import type { GalleryItem, Project, ProjectDocument, ProjectVideo } from "../../../types";
import { PageHeader, Button, Card, Field, Input, Select, Table, Textarea } from "../ui";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { EmptyState } from "../../../components/ui/EmptyState";
import { FileUploader } from "../../../components/ui/FileUploader";

type MediaTab = "galeria" | "videos" | "documentos";

export default function AdminMedia() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MediaTab>("galeria");
  const [projectId, setProjectId] = useState<number | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<"url" | "upload">("url");
  const [form, setForm] = useState({
    url: "",
    caption: "",
    title: "",
    category: "gallery",
    name: "",
    description: "",
    is_cover: false,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-admin"],
    queryFn: () => api.get<Project[]>("/projects"),
  });

  useEffect(() => {
    if (projectId === "" && projects && projects.length > 0) {
      setProjectId(projects[0].id);
    }
  }, [projectId, projects]);

  const selectedProject = projectId || projects?.[0]?.id;

  const gallery = useQuery({
    queryKey: ["admin-gallery", selectedProject],
    queryFn: () => api.get<GalleryItem[]>(`/projects/${selectedProject}/gallery`),
    enabled: !!selectedProject,
  });

  const videos = useQuery({
    queryKey: ["admin-videos", selectedProject],
    queryFn: () => api.get<ProjectVideo[]>(`/projects/${selectedProject}/videos`),
    enabled: !!selectedProject,
  });

  const documents = useQuery({
    queryKey: ["admin-documents", selectedProject],
    queryFn: () => api.get<ProjectDocument[]>(`/projects/${selectedProject}/documents`),
    enabled: !!selectedProject,
  });

  const addImage = useMutation({
    mutationFn: () =>
      api.post(
        "/projects/gallery",
        {
          project_id: selectedProject,
          url: form.url,
          caption: form.caption,
          category: form.category,
          is_cover: form.is_cover,
        },
        true
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
      toast("Imagen agregada.");
      setModalOpen(false);
    },
    onError: (e) => toast(e.message, "error"),
  });

  const deleteImage = useMutation({
    mutationFn: (id: number) => api.del(`/projects/gallery/${id}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
      toast("Imagen eliminada.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const addVideo = useMutation({
    mutationFn: () =>
      api.post(
        "/projects/videos",
        { project_id: selectedProject, url: form.url, title: form.title },
        true
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-videos"] });
      toast("Video agregado.");
      setModalOpen(false);
    },
    onError: (e) => toast(e.message, "error"),
  });

  const deleteVideo = useMutation({
    mutationFn: (id: number) => api.del(`/projects/videos/${id}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-videos"] });
      toast("Video eliminado.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const addDocument = useMutation({
    mutationFn: () =>
      api.post(
        "/projects/documents",
        {
          project_id: selectedProject,
          url: form.url,
          name: form.name,
          category: form.category,
          description: form.description,
        },
        true
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
      toast("Documento agregado.");
      setModalOpen(false);
    },
    onError: (e) => toast(e.message, "error"),
  });

  const deleteDocument = useMutation({
    mutationFn: (id: number) => api.del(`/projects/documents/${id}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
      toast("Documento eliminado.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const resetForm = () => {
    setForm({
      url: "",
      caption: "",
      title: "",
      category: tab === "documentos" ? "brochure" : "gallery",
      name: "",
      description: "",
      is_cover: false,
    });
    setUploadMethod("url");
  };

  const openAdd = () => {
    resetForm();
    setModalOpen(true);
  };

  const submit = () => {
    if (!form.url && !(tab === "documentos" && form.name)) {
      toast("Ingresa la URL del archivo.", "error");
      return;
    }
    if (tab === "galeria") addImage.mutate();
    else if (tab === "videos") addVideo.mutate();
    else addDocument.mutate();
  };

  return (
    <div>
      <PageHeader
        title="Multimedia"
        subtitle="Galería, videos y documentos por proyecto (archivos alojados en Cloudinary)."
        action={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        }
      />

      <div className="mb-6 max-w-xs">
        <Field label="Proyecto">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Seleccionar proyecto...</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mb-6 flex gap-2">
        {(
          [
            ["galeria", "Galería", ImageIcon],
            ["videos", "Videos", Video],
            ["documentos", "Documentos", FileText],
          ] as [MediaTab, string, typeof ImageIcon][]
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              resetForm();
            }}
            className={`flex items-center gap-2 rounded-sm px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === key
                ? "bg-netland-primary text-white"
                : "bg-white text-netland-muted hover:text-netland-dark"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "galeria" &&
        (gallery.data?.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {gallery.data.map((img) => (
              <div key={img.id} className="group relative overflow-hidden rounded-lg">
                <img src={img.url} alt={img.caption} className="aspect-[4/3] w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="danger"
                    className="!px-3 !py-1.5"
                    onClick={() => deleteImage.mutate(img.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {img.is_cover && (
                  <span className="absolute left-2 top-2 rounded-sm bg-netland-accent px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                    Portada
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState title="Sin imágenes" description="Agrega imágenes de Cloudinary." />
          </Card>
        ))}

      {tab === "videos" &&
        (videos.data?.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {videos.data.map((video) => {
              const videoId = video.url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\ w-]{11})/)?.[1];
              return (
                <Card key={video.id}>
                  <div className="space-y-4">
                    {videoId && (
                      <div className="aspect-video overflow-hidden rounded-lg">
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}?modestbranding=1`}
                          title={video.title}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-netland-dark">{video.title || "Sin título"}</h3>
                      <p className="mt-1 text-xs text-netland-muted">
                        Tipo: <span className="font-medium">{video.video_type}</span>
                      </p>
                      <p className="mt-1 truncate text-xs text-netland-muted">{video.url}</p>
                    </div>
                    <Button
                      variant="danger"
                      className="w-full"
                      onClick={() => deleteVideo.mutate(video.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <EmptyState title="Sin videos" description="Agrega videos promocionales de YouTube para mostrar en tu web pública." />
          </Card>
        ))}

      {tab === "documentos" &&
        (documents.data?.length ? (
          <Table headers={["Nombre", "Categoría", "URL", "Acciones"]}>
            {documents.data.map((doc) => (
              <tr key={doc.id}>
                <td className="px-5 py-3 font-medium text-netland-dark">{doc.name}</td>
                <td className="px-5 py-3 text-netland-muted">{doc.category}</td>
                <td className="max-w-[300px] truncate px-5 py-3 text-netland-muted">{doc.url}</td>
                <td className="px-5 py-3">
                  <Button variant="danger" className="!px-2.5 !py-1.5" onClick={() => deleteDocument.mutate(doc.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Card>
            <EmptyState title="Sin documentos" description="Agrega brochures, planos y fichas técnicas." />
          </Card>
        ))}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          tab === "galeria" ? "Agregar imagen" : tab === "videos" ? "Agregar video" : "Agregar documento"
        }
      >
        <div className="space-y-4 p-6">
          {/* Método de carga para videos e imágenes */}
          {(tab === "galeria" || tab === "videos") && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-netland-dark">
                Método de carga
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUploadMethod("url")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    uploadMethod === "url"
                      ? "border-netland-primary bg-netland-primary/5 text-netland-primary"
                      : "border-netland-light bg-white text-netland-muted hover:border-netland-primary/30"
                  }`}
                >
                  URL {tab === "videos" ? "(YouTube/Cloudinary)" : "(Cloudinary)"}
                </button>
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
                  Subir archivo
                </button>
              </div>
            </div>
          )}

          {tab === "documentos" && (
            <Field label="Nombre del documento">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          )}

          {/* Subir archivo o ingresar URL */}
          {uploadMethod === "upload" && (tab === "galeria" || tab === "videos") ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-netland-dark">
                Subir {tab === "galeria" ? "imagen" : "video"}
              </label>
              <FileUploader
                accept={tab === "galeria" ? "image/*" : "video/*"}
                folder={`projects/${selectedProject}/${tab === "galeria" ? "gallery" : "videos"}`}
                onUploadComplete={(url) => setForm({ ...form, url })}
                maxSizeMB={tab === "videos" ? 100 : 10}
                label={`Arrastra tu ${tab === "galeria" ? "imagen" : "video"} aquí`}
                hint={
                  tab === "galeria"
                    ? "Formatos: JPG, PNG, WebP. Máximo 10MB."
                    : "Formatos: MP4, WebM, MOV. Máximo 100MB."
                }
                preview={tab === "galeria"}
              />
              {form.url && (
                <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-2">
                  <p className="text-xs font-semibold text-green-800">
                    ✓ Archivo subido correctamente
                  </p>
                </div>
              )}
            </div>
          ) : (
            <Field label={tab === "videos" ? "URL (YouTube o Cloudinary)" : "URL (Cloudinary)"}>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder={
                  tab === "videos"
                    ? "https://www.youtube.com/watch?v=... o https://res.cloudinary.com/..."
                    : "https://res.cloudinary.com/..."
                }
              />
            </Field>
          )}

          {tab === "galeria" && (
            <>
              <Field label="Descripción">
                <Input value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
              </Field>
              <Field label="Categoría">
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="gallery">Galería</option>
                  <option value="aerial">Aéreas</option>
                  <option value="terreno">Terreno</option>
                  <option value="areas_comunes">Áreas comunes</option>
                  <option value="avances">Avances</option>
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_cover}
                  onChange={(e) => setForm({ ...form, is_cover: e.target.checked })}
                  className="h-4 w-4 accent-netland-primary"
                />
                Usar como imagen de portada
              </label>
            </>
          )}

          {tab === "videos" && (
            <>
              <Field label="Título">
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Recorrido virtual del proyecto"
                />
              </Field>
              {form.url && (() => {
                const videoId = form.url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\ w-]{11})/)?.[1];
                const isCloudinary = form.url.includes("cloudinary");
                return videoId || isCloudinary ? (
                  <div className="rounded-lg border border-netland-light bg-netland-background p-3">
                    <p className="mb-2 text-xs font-semibold text-netland-dark">Vista previa:</p>
                    <div className="aspect-video overflow-hidden rounded-lg">
                      {videoId ? (
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}?modestbranding=1`}
                          title="Video preview"
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video src={form.url} controls className="h-full w-full bg-black" preload="metadata" />
                      )}
                    </div>
                  </div>
                ) : null;
              })()}
            </>
          )}

          {tab === "documentos" && (
            <>
              <Field label="URL (Cloudinary)">
                <Input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://res.cloudinary.com/..."
                />
              </Field>
              <Field label="Categoría">
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="brochure">Brochure</option>
                  <option value="plano">Plano</option>
                  <option value="ficha_tecnica">Ficha técnica</option>
                  <option value="documento">Documento</option>
                </Select>
              </Field>
              <Field label="Descripción">
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </>
          )}

          {uploadMethod === "url" && (
            <p className="text-xs text-netland-muted">
              {tab === "videos"
                ? "Puedes usar URLs de YouTube o videos alojados en Cloudinary."
                : "Los archivos deben estar alojados en Cloudinary. Usa el botón 'Subir archivo' para cargar desde tu PC."}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={addImage.isPending || addVideo.isPending || addDocument.isPending}>
              Agregar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}