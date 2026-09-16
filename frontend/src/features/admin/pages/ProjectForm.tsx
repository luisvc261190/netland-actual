import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useState } from "react";
import { Save } from "lucide-react";
import { api } from "../../../lib/api";
import type { Project } from "../../../types";
import { PageHeader, Button, Card, Field, Input, Select, Textarea } from "../ui";
import { useToast } from "../../../components/ui/Toast";
import { Skeleton } from "../../../components/ui/Skeleton";
import { FileUploader } from "../../../components/ui/FileUploader";

const PERUVIAN_BANKS = [
  "Banco de Crédito del Perú (BCP)",
  "Banco de la Nación",
  "Interbank",
  "BBVA Perú",
  "Scotiabank Perú",
  "Mi Banco",
  "Banbif",
  "Banco Pichincha",
  "Banco Falabella",
  "Caja Arequipa",
  "Caja Cusco",
  "Caja Huancayo",
  "Caja Ica",
  "Caja Trujillo",
  "Caja Piura",
  "Caja Tacna",
  "Banco Interamericano de Finanzas (BIF)",
];

const emptyProject = {
  slug: "",
  name: "",
  short_name: "",
  project_type: "lotes",
  tagline: "",
  description: "",
  long_description: "",
  features: "",
  location: "",
  reference: "",
  map_link: "",
  color_primary: "#0d7a44",
  color_secondary: "#1e40af",
  hero_image: "",
  hero_video: "",
  logo_url: "",
  bank_name: "",
  bank_account_number: "",
  status: "active",
  is_published: true,
  legal_info: "",
  seo_title: "",
  seo_description: "",
  og_image: "",
};

export default function ProjectForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyProject);

  const { isLoading } = useQuery({
    queryKey: ["project-form", id],
    queryFn: async ({ signal }) => {
      if (!id) return null;
      const project = await api.get<Project>(`/projects/${id}`, false, signal);
      setForm({
        slug: project.slug,
        name: project.name,
        short_name: project.short_name,
        project_type: project.project_type,
        tagline: project.tagline,
        description: project.description,
        long_description: project.long_description,
        features: project.features,
        location: project.location,
        reference: project.reference,
        map_link: project.map_link,
        color_primary: project.color_primary,
        color_secondary: project.color_secondary,
        hero_image: project.hero_image,
        hero_video: project.hero_video,
        logo_url: project.logo_url,
        bank_name: project.bank_name,
        bank_account_number: project.bank_account_number,
        status: project.status,
        is_published: project.is_published,
        legal_info: project.legal_info,
        seo_title: project.seo_title,
        seo_description: project.seo_description,
        og_image: project.og_image,
      });
      return project;
    },
    enabled: !!id,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      id
        ? api.put<Project>(`/projects/${id}`, form, true)
        : api.post<Project>("/projects", form, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects-admin"] });
      toast(id ? "Proyecto actualizado." : "Proyecto creado.");
      navigate("/admin/proyectos");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const set = (key: keyof typeof emptyProject, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (isLoading) return <Skeleton className="h-96 rounded-lg" />;

  return (
    <div>
      <PageHeader
        title={id ? "Editar proyecto" : "Nuevo proyecto"}
        subtitle="Información general e identidad visual del proyecto."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
        className="grid gap-6 lg:grid-cols-2"
      >
        <Card className="space-y-4">
          <h3 className="font-display text-xl font-semibold text-netland-dark">Información general</h3>
          <Field label="Slug (URL amigable)">
            <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="villa-del-sur" required />
          </Field>
          <Field label="Nombre completo">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Condominio Campestre Villa del Sur" required />
          </Field>
          <Field label="Nombre corto">
            <Input value={form.short_name} onChange={(e) => set("short_name", e.target.value)} placeholder="Villa del Sur" required />
          </Field>
          <Field label="Tipo de proyecto">
            <Select value={form.project_type} onChange={(e) => set("project_type", e.target.value)}>
              <option value="lotes">Lotes</option>
              <option value="condominio_campestre">Condominio Campestre</option>
              <option value="urbanizacion">Urbanización</option>
            </Select>
          </Field>
          <Field label="Slogan / tagline">
            <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </Field>
          <Field label="Descripción corta">
            <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Descripción larga">
            <Textarea rows={5} value={form.long_description} onChange={(e) => set("long_description", e.target.value)} />
          </Field>
          <Field label="Beneficios (uno por línea)" hint="Escribe cada beneficio en una línea.">
            <Textarea rows={4} value={form.features} onChange={(e) => set("features", e.target.value)} />
          </Field>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <h3 className="font-display text-xl font-semibold text-netland-dark">Ubicación</h3>
            <Field label="Ubicación">
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Almenares, Cañete" />
            </Field>
            <Field label="Referencia">
              <Input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="A 7 minutos de la Plaza de Armas de Imperial" />
            </Field>
            <Field label="Link del mapa (embed de Google Maps)">
              <Input value={form.map_link} onChange={(e) => set("map_link", e.target.value)} placeholder="https://www.google.com/maps/embed?pb=..." />
            </Field>
          </Card>

          <Card className="space-y-4">
            <h3 className="font-display text-xl font-semibold text-netland-dark">Datos bancarios</h3>
            <p className="text-xs text-netland-muted">
              El banco y el número de cuenta se incluirán automáticamente en las
              cotizaciones y contratos de este proyecto, para que tus clientes
              sepan dónde depositar.
            </p>
            <Field label="Banco">
              <Select
                value={form.bank_name}
                onChange={(e) => set("bank_name", e.target.value)}
              >
                <option value="">Sin banco configurado</option>
                {PERUVIAN_BANKS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Número de cuenta"
              hint="Ej: 191-1234567-0-45 (puede incluir guiones)"
            >
              <Input
                value={form.bank_account_number}
                onChange={(e) => set("bank_account_number", e.target.value)}
                placeholder="Número de cuenta para depósitos"
                disabled={!form.bank_name}
              />
            </Field>
            {form.bank_name && form.bank_account_number && (
              <div className="flex items-center gap-2 rounded-lg bg-netland-light/60 px-4 py-3">
                <div className="text-sm">
                  <span className="font-semibold text-netland-dark">{form.bank_name}</span>
                  <span className="text-netland-muted"> · N° cuenta: </span>
                  <span className="font-bold text-netland-primary">{form.bank_account_number}</span>
                </div>
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <h3 className="font-display text-xl font-semibold text-netland-dark">Identidad visual</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Color principal">
                <div className="flex items-center gap-2">
                  <input type="color" value={form.color_primary} onChange={(e) => set("color_primary", e.target.value)} className="h-10 w-14 rounded-sm border border-netland-light" />
                  <Input value={form.color_primary} onChange={(e) => set("color_primary", e.target.value)} />
                </div>
              </Field>
              <Field label="Color secundario">
                <div className="flex items-center gap-2">
                  <input type="color" value={form.color_secondary} onChange={(e) => set("color_secondary", e.target.value)} className="h-10 w-14 rounded-sm border border-netland-light" />
                  <Input value={form.color_secondary} onChange={(e) => set("color_secondary", e.target.value)} />
                </div>
              </Field>
            </div>
            
            <FileUploader
              label="Imagen de portada"
              accept="image/*"
              folder="projects/hero"
              currentUrl={form.hero_image}
              hint="Formatos: JPG, PNG, WEBP. Tamaño recomendado: 1920x1080px"
              onUploadComplete={(url) => set("hero_image", url)}
              maxSizeMB={5}
            />
            
            <FileUploader
              label="Video principal"
              accept="video/*"
              folder="projects/videos"
              currentUrl={form.hero_video}
              hint="Formatos: MP4, WEBM, MOV. También puedes pegar una URL de YouTube"
              preview={false}
              onUploadComplete={(url) => set("hero_video", url)}
              maxSizeMB={50}
            />
            
            <Field label="O pegar URL de video (YouTube/Vimeo)">
              <Input 
                value={form.hero_video} 
                onChange={(e) => set("hero_video", e.target.value)} 
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </Field>
            
            <FileUploader
              label="Logo del proyecto"
              accept="image/*"
              folder="projects/logos"
              currentUrl={form.logo_url}
              hint="Formato PNG con fondo transparente recomendado"
              onUploadComplete={(url) => set("logo_url", url)}
              maxSizeMB={2}
            />
          </Card>

          <Card className="space-y-4">
            <h3 className="font-display text-xl font-semibold text-netland-dark">Publicación y SEO</h3>
            <Field label="Información legal">
              <Textarea rows={3} value={form.legal_info} onChange={(e) => set("legal_info", e.target.value)} />
            </Field>
            <Field label="SEO Title">
              <Input value={form.seo_title} onChange={(e) => set("seo_title", e.target.value)} />
            </Field>
            <Field label="SEO Description">
              <Textarea rows={2} value={form.seo_description} onChange={(e) => set("seo_description", e.target.value)} />
            </Field>
            
            <FileUploader
              label="Imagen para compartir en redes sociales (OG Image)"
              accept="image/*"
              folder="projects/og"
              currentUrl={form.og_image}
              hint="Tamaño recomendado: 1200x630px. Se usa al compartir el proyecto en redes sociales"
              onUploadComplete={(url) => set("og_image", url)}
              maxSizeMB={3}
            />
            
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => set("is_published", e.target.checked)}
                className="h-4 w-4 accent-netland-primary"
              />
              Publicado (visible en el sitio)
            </label>
          </Card>

          <div className="flex justify-end gap-3">
            <Link to="/admin/proyectos">
              <Button type="button" variant="outline">Cancelar</Button>
            </Link>
            <Button type="submit" disabled={saveMutation.isPending}>
              <Save className="h-4 w-4" />
              Guardar proyecto
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}