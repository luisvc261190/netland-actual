import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useState } from "react";
import {
  CalendarCheck,
  Check,
  FileText,
  MapPin,
  MessageCircle,
  Video,
} from "lucide-react";
import { api } from "../lib/api";
import { whatsappLink } from "../lib/constants";
import type {
  GalleryItem,
  Lot,
  Project,
  ProjectDocument,
  ProjectVideo,
} from "../types";
import { PlanInteractive } from "../components/PlanInteractive";
import { LotModal } from "../components/LotModal";
import { Lightbox } from "../components/ui/Lightbox";
import { Reveal } from "../components/Reveal";
import { useLeadForm } from "../features/leads/useLeadForm";
import { CoreSpinLoader } from "../components/ui/CoreSpinLoader";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1800&q=80";

const VIDEO_IDS = (url: string) => {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return match ? match[1] : null;
};

export default function ProjectDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", slug],
    queryFn: () => api.get<Project>(`/projects/${slug}`),
    enabled: !!slug,
  });

  const { data: lots = [] } = useQuery({
    queryKey: ["project-lots", project?.id],
    queryFn: () => api.get<Lot[]>(`/projects/${project!.id}/lots`),
    enabled: !!project,
  });

  const { data: gallery = [] } = useQuery({
    queryKey: ["project-gallery", project?.id],
    queryFn: () => api.get<GalleryItem[]>(`/projects/${project!.id}/gallery`),
    enabled: !!project,
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["project-videos", project?.id],
    queryFn: () => api.get<ProjectVideo[]>(`/projects/${project!.id}/videos`),
    enabled: !!project,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["project-documents", project?.id],
    queryFn: () => api.get<ProjectDocument[]>(`/projects/${project!.id}/documents`),
    enabled: !!project,
  });

  if (isLoading || !project) {
    return (
      <div className="min-h-screen bg-netland-background pt-24 flex items-center justify-center">
        <CoreSpinLoader />
      </div>
    );
  }

  const availableLots = lots.filter((l) => l.status === "available").length;
  const features = project.features
    ? project.features.split("\n").filter(Boolean)
    : [];
  const mainVideo = videos.find((v) => v.video_type === "main") ?? videos[0];

  return (
    <div>
      <section
        className="relative flex min-h-[75vh] items-end overflow-hidden bg-netland-dark"
      >
        {mainVideo ? (() => {
          const videoId = VIDEO_IDS(mainVideo.url);
          const isCloudinary = mainVideo.url.includes("cloudinary") || mainVideo.url.includes(".mp4") || mainVideo.url.includes(".webm");
          
          return videoId || isCloudinary ? (
            <div className="absolute inset-0 z-20 sm:z-auto">
              {videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=0&mute=0&loop=0&controls=1&modestbranding=1`}
                  title={mainVideo.title}
                  className="h-full w-full object-cover"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={mainVideo.url}
                  controls
                  loop
                  playsInline
                  className="h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent sm:hidden" />
            </div>
          ) : (
            <div className="absolute inset-0">
              <img
                src={project.hero_image || FALLBACK_IMAGE}
                alt={project.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-netland-dark/90 via-netland-dark/50 to-transparent" />
            </div>
          );
        })() : (
          <div className="absolute inset-0">
            <img
              src={project.hero_image || FALLBACK_IMAGE}
              alt={project.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-netland-dark/90 via-netland-dark/50 to-transparent" />
          </div>
        )}

        <div className="container-netland relative z-10 pb-16 pt-40 text-white">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-netland-accent">
            {project.tagline}
          </p>
          <h1 className="max-w-3xl text-balance font-display text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl">
            {project.short_name}
          </h1>
          <p className="mt-5 flex items-center gap-2 text-lg text-white/90">
            <MapPin className="h-5 w-5 text-netland-accent" />
            {project.location} · {project.reference}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <span className="rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold backdrop-blur-sm">
              {availableLots} lotes disponibles
            </span>
            {project.available_count > 0 && (
              <a href="#lotes" className="btn-primary">
                Ver lotes disponibles
              </a>
            )}
            <a
              href={whatsappLink(
                `Hola Luis, quiero agendar una visita a ${project.short_name}.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp"
            >
              <CalendarCheck className="h-4 w-4" />
              Agendar visita
            </a>
          </div>
        </div>
      </section>

      <section className="section-padding bg-netland-background">
        <div className="container-netland grid gap-14 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Reveal>
              <p className="eyebrow">El proyecto</p>
              <h2 className="font-display text-4xl font-semibold text-netland-dark">
                {project.description}
              </h2>
              <p className="mt-6 leading-relaxed text-netland-muted">
                {project.long_description}
              </p>
            </Reveal>

            {features.length > 0 && (
              <Reveal className="mt-8">
                <h3 className="mb-4 font-display text-2xl font-semibold text-netland-dark">
                  Beneficios del proyecto
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2.5 rounded-md bg-white px-4 py-3 text-sm shadow-soft"
                    >
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: project.color_primary }}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}
          </div>

          <div className="lg:col-span-2">
            <Reveal delay={100}>
              <div className="rounded-lg bg-netland-dark p-7 text-white">
                <h3 className="mb-5 font-display text-2xl font-semibold">
                  Respaldo y documentación
                </h3>
                <ul className="space-y-4 text-sm text-white/80">
                  <li className="flex gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-netland-accent" />
                    Empresa legalmente constituida.
                  </li>
                  <li className="flex gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-netland-accent" />
                    Proyecto registrado en SUNARP.
                  </li>
                  <li className="flex gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-netland-accent" />
                    Visitas guiadas y orientación completa.
                  </li>
                  <li className="flex gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-netland-accent" />
                    Financiamiento directo y cuotas sin intereses.
                  </li>
                </ul>
                {project.legal_info && (
                  <p className="mt-5 border-t border-white/10 pt-4 text-xs text-white/60">
                    {project.legal_info}
                  </p>
                )}
                <a
                  href={whatsappLink(
                    `Hola Luis, quiero más información sobre ${project.short_name}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-accent mt-6 w-full"
                >
                  <MessageCircle className="h-4 w-4" />
                  Hablar con un asesor
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="lotes" className="scroll-mt-20 bg-white py-20 md:py-28">
        <div className="container-netland">
          <Reveal>
            <div className="mb-10 max-w-2xl">
              <p className="eyebrow">Disponibilidad</p>
              <h2 className="font-display text-4xl font-semibold text-netland-dark">
                Plano de lotes
              </h2>
              <p className="mt-3 text-netland-muted">
                Consulta la disponibilidad en tiempo real. Toca un lote para ver su
                área, precio y estado.
              </p>
            </div>
          </Reveal>

          <PlanInteractive
            lots={lots}
            projectName={project.short_name}
            onSelect={setSelectedLot}
            planPdfUrl={project.plan_pdf_url}
          />
        </div>
      </section>

      {/* Sección de Videos - Siempre visible para debug */}
      <section className="section-padding bg-netland-dark">
        <div className="container-netland">
          <Reveal>
            <div className="mb-12 max-w-2xl text-white">
              <p className="eyebrow justify-start">Videos del proyecto</p>
              <h2 className="font-display text-4xl font-bold lg:text-5xl">
                Conoce {project.short_name} en video
              </h2>
              <p className="mt-4 text-white/70">
                Explora cada detalle del proyecto a través de nuestros recorridos virtuales y videos informativos.
              </p>
            </div>
          </Reveal>
          
          {videos && videos.length > 0 ? (
            <div className="grid gap-8 lg:grid-cols-2">
              {videos.map((video, i) => {
                const id = VIDEO_IDS(video.url);
                const isCloudinary = video.url && (video.url.includes("cloudinary") || video.url.includes(".mp4") || video.url.includes(".webm") || video.url.includes(".mov"));
                
                // Si no es YouTube ni Cloudinary, skip
                if (!id && !isCloudinary) {
                  console.warn("Video URL no válida:", video.url);
                  return null;
                }
                
                return (
                  <Reveal key={video.id} delay={i * 100}>
                    <div className="group overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-all duration-300 hover:border-netland-accent/50">
                      <div className="relative aspect-video overflow-hidden bg-black">
                        {id ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${id}?modestbranding=1`}
                            title={video.title || "Video del proyecto"}
                            className="h-full w-full"
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video
                            src={video.url}
                            controls
                            className="h-full w-full"
                            preload="metadata"
                            controlsList="nodownload"
                          >
                            Tu navegador no soporta el elemento de video.
                          </video>
                        )}
                      </div>
                      {(video.title || video.description) && (
                        <div className="p-6">
                          {video.title && (
                            <h3 className="font-display text-xl font-bold text-white">
                              {video.title}
                            </h3>
                          )}
                          {video.description && (
                            <p className="mt-2 text-sm text-white/60">
                              {video.description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </Reveal>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
              <Video className="mx-auto mb-4 h-12 w-12 text-white/30" />
              <p className="text-lg font-semibold text-white">
                Aún no hay videos para este proyecto
              </p>
              <p className="mt-2 text-sm text-white/60">
                Los videos del proyecto se mostrarán aquí una vez que sean agregados desde el panel administrativo.
              </p>
            </div>
          )}
        </div>
      </section>

      {gallery.length > 0 && (
        <section className="section-padding bg-white">
          <div className="container-netland">
            <Reveal>
              <div className="mb-12 max-w-2xl">
                <p className="eyebrow">Galería de imágenes</p>
                <h2 className="font-display text-4xl font-bold text-netland-dark lg:text-5xl">
                  Así es {project.short_name}
                </h2>
                <p className="mt-4 text-netland-muted">
                  Explora cada rincón del proyecto a través de nuestra galería fotográfica.
                </p>
              </div>
            </Reveal>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((img, i) => (
                <Reveal key={img.id} delay={i * 60}>
                  <button
                    onClick={() => setLightboxIndex(i)}
                    className="group relative block w-full overflow-hidden rounded-xl"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-netland-light">
                      <img
                        src={img.url}
                        alt={img.caption || project.short_name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>
                    {img.caption && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <p className="text-sm font-medium text-white">{img.caption}</p>
                      </div>
                    )}
                  </button>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {documents.length > 0 && (
        <section className="section-padding bg-netland-background">
          <div className="container-netland">
            <Reveal>
              <div className="mb-12 max-w-2xl">
                <p className="eyebrow">Documentación</p>
                <h2 className="font-display text-4xl font-bold text-netland-dark lg:text-5xl">
                  Material de descarga
                </h2>
                <p className="mt-4 text-netland-muted">
                  Accede a toda la documentación legal y técnica del proyecto.
                </p>
              </div>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => (
                <Reveal key={doc.id} delay={60}>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 rounded-xl border border-netland-light bg-white p-6 transition-all duration-300 hover:border-netland-primary hover:shadow-soft"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-netland-primary/5">
                      <FileText className="h-6 w-6 text-netland-primary transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-netland-dark">{doc.name}</p>
                      <p className="mt-0.5 text-xs uppercase tracking-wider text-netland-muted">
                        {doc.category}
                      </p>
                    </div>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <LocationSection project={project} />
      <VisitBanner project={project} />

      <LotModal
        lot={selectedLot}
        project={project}
        onClose={() => setSelectedLot(null)}
      />
      <Lightbox
        images={gallery.map((g) => ({ url: g.url, caption: g.caption }))}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </div>
  );
}

function LocationSection({ project }: { project: Project }) {
  const mapEmbed = project.map_link || null;
  return (
    <section className="section-padding bg-netland-background">
      <div className="container-netland">
        <Reveal>
          <div className="mb-10 max-w-2xl">
            <p className="eyebrow">Ubicación</p>
            <h2 className="font-display text-4xl font-semibold text-netland-dark">
              ¿Dónde estamos?
            </h2>
            <p className="mt-3 text-netland-muted">{project.location}</p>
            <p className="mt-1 text-sm text-netland-muted">{project.reference}</p>
          </div>
        </Reveal>

        <div className="overflow-hidden rounded-lg shadow-soft">
          {mapEmbed ? (
            <iframe
              src={mapEmbed}
              title={`Mapa de ${project.short_name}`}
              className="h-[420px] w-full"
              loading="lazy"
            />
          ) : (
            <div className="flex h-[420px] flex-col items-center justify-center gap-3 bg-netland-light text-center">
              <MapPin className="h-10 w-10 text-netland-accent" />
              <p className="font-display text-xl font-semibold text-netland-dark">
                {project.location}
              </p>
              <p className="max-w-md text-sm text-netland-muted">
                {project.reference} · El mapa de ubicación se cargará próximamente
                desde el panel administrativo.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function VisitBanner({ project }: { project: Project }) {
  const { submit, submitted } = useLeadForm();
  const [form, setForm] = useState({ name: "", phone: "" });

  const nameValid = form.name.trim().length > 0 && !/\d/.test(form.name.trim());
  const phoneValid =
    form.phone.length === 9 && form.phone.startsWith("9");
  const formValid = nameValid && phoneValid;

  if (submitted) {
    return (
      <section className="bg-netland-primary py-20 text-white">
        <div className="container-netland text-center">
          <p className="font-display text-3xl font-semibold">
            ¡Solicitud de visita enviada!
          </p>
          <p className="mt-3 text-white/90">
            Un asesor de Netland coordinará tu visita guiada a {project.short_name}.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-netland-primary py-20 text-white">
      <div className="container-netland grid items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Visitas guiadas</p>
          <h2 className="font-display text-4xl font-semibold sm:text-5xl">
            Agenda una visita a {project.short_name}
          </h2>
          <p className="mt-4 text-white/90">
            Recorre el terreno, conoce las áreas comunes y resuelve todas tus dudas
            con un asesor de Netland.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <a
              href={whatsappLink(
                `Hola Luis, quiero agendar una visita guiada a ${project.short_name}.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp"
            >
              <MessageCircle className="h-4 w-4" />
              Agendar por WhatsApp
            </a>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (formValid) {
              submit({
                name: form.name,
                phone: form.phone,
                project_id: project.id,
                source: "visita",
                message: `Quiero agendar una visita a ${project.short_name}.`,
              });
            }
          }}
          className="rounded-lg bg-white/5 p-7 backdrop-blur"
        >
          <h3 className="mb-5 font-display text-2xl font-semibold">
            Solicitar visita
          </h3>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-white/60">
                Nombre
              </span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className={`w-full rounded-sm border bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-netland-accent placeholder:text-white/40 ${
                  /\d/.test(form.name.trim()) && form.name.trim().length > 0
                    ? "border-yellow-400"
                    : "border-white/15"
                }`}
              />
              {/\d/.test(form.name.trim()) && form.name.trim().length > 0 && (
                <span className="mt-1 block text-xs text-yellow-400">
                  El nombre no puede contener números
                </span>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-white/60">
                Teléfono / WhatsApp
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={9}
                value={form.phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, phone: digits.slice(0, 9) });
                }}
                required
                className={`w-full rounded-sm border bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-netland-accent placeholder:text-white/40 ${
                  form.phone.length > 0 &&
                  (!form.phone.startsWith("9") || form.phone.length !== 9)
                    ? "border-yellow-400"
                    : "border-white/15"
                }`}
              />
              {form.phone.length > 0 && (
                <>
                  {!form.phone.startsWith("9") ? (
                    <span className="mt-1 block text-xs text-yellow-400">
                      El teléfono debe empezar con 9
                    </span>
                  ) : form.phone.length !== 9 ? (
                    <span className="mt-1 block text-xs text-yellow-400">
                      Debe tener 9 dígitos
                    </span>
                  ) : null}
                </>
              )}
            </label>
            <button
              type="submit"
              disabled={!formValid}
              className="btn-accent w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              Solicitar visita
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}