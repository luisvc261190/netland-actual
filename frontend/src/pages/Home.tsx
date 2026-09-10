import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  HandCoins,
  HeartHandshake,
  Landmark,
  MapPin,
  MessageCircle,
  Play,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { api } from "../lib/api";
import { whatsappLink } from "../lib/constants";
import entregallave from "../images/entregallave.jpg";
import caballosImage from "../images/caballos.jpg";
import equipoNetland from "../images/equipo_netland.jpg";
import logoNetland from "../images/logo-netland.png";
import refiereGana from "../images/refiere_gana.jpg";
import type { Project } from "../types";
import { Reveal } from "../components/Reveal";
import { CoreSpinLoader } from "../components/ui/CoreSpinLoader";
import { useEffect, useState } from "react";

interface SiteConfig {
  hero_video_url?: string;
  hero_video_title?: string;
  [key: string]: string | undefined;
}

const trustItems = [
  { icon: Landmark, title: "Empresa legalmente constituida" },
  { icon: FileCheck2, title: "Proyectos registrados en SUNARP" },
  { icon: UserCheck, title: "Asesoría completa" },
  { icon: CalendarCheck, title: "Visitas guiadas" },
  { icon: HandCoins, title: "Financiamiento directo" },
  { icon: TrendingUp, title: "Cuotas sin intereses" },
  { icon: HeartHandshake, title: "Atención personalizada" },
];

const whyItems = [
  {
    icon: ShieldCheck,
    title: "Garantía",
    text: "Respaldo de una empresa peruana sólida, con proyectos desarrollados de forma ordenada y transparente.",
  },
  {
    icon: Building2,
    title: "Responsabilidad",
    text: "Acompañamos cada etapa del proceso con orientación completa, desde la elección del lote hasta la compra.",
  },
  {
    icon: Sparkles,
    title: "Calidad",
    text: "Proyectos pensados para mejorar la calidad de vida de las familias, con espacios y entornos cuidados.",
  },
  {
    icon: ShieldCheck,
    title: "Seguridad",
    text: "Documentación en regla y procesos claros para que tu inversión esté protegida.",
  },
];

const HERO_IMAGE =
  "https://i.pinimg.com/originals/3e/2e/a0/3e2ea0689178a4a37408fed2907b9bdb.jpg";

const HERO_SLIDES = [
  {
    src: HERO_IMAGE,
    alt: "Campo y casa en Cañete",
  },
  {
    src: equipoNetland,
    alt: "Equipo de Netland",
  },
  {
    src: caballosImage,
    alt: "Caballos en el campo de Cañete",
  },
];

const VIDEO_ID_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\ w-]{11})/;

function extractVideoId(url: string): string | null {
  const match = url.match(VIDEO_ID_REGEX);
  return match ? match[1] : null;
}

export default function Home() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<Project[]>("/projects?published_only=true"),
  });

  const { data: config } = useQuery<SiteConfig>({
    queryKey: ["public-config"],
    queryFn: () => api.get("/config/public"),
  });

  return (
    <div>
      <Hero config={config} />
      <ProjectsSection projects={projects} loading={isLoading} />
      <TrustSection />
      <WhySection />
      <StatsStrip />
      <ReferralSection />
      <CtaSection />
    </div>
  );
}

function Hero({ config }: { config?: SiteConfig }) {
  const [showVideo, setShowVideo] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoUrl = config?.hero_video_url || "";
  const videoId = videoUrl ? extractVideoId(videoUrl) : null;
  const isCloudinaryVideo =
    videoUrl.includes("cloudinary") ||
    videoUrl.includes(".mp4") ||
    videoUrl.includes(".webm");
  const hasVideo = !!(videoId || isCloudinaryVideo);

  useEffect(() => {
    if (showVideo || paused) return;
    const id = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [showVideo, paused]);

  const goTo = (index: number) =>
    setActiveIndex((index + HERO_SLIDES.length) % HERO_SLIDES.length);

  return (
    <section className="relative flex min-h-[92vh] items-center overflow-hidden">
      {/* Background Image or Video */}
      <div
        className="absolute inset-0"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {hasVideo && showVideo ? (
          <div className="relative h-full w-full">
            {videoId ? (
              // YouTube video
              <>
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&controls=1&modestbranding=1&rel=0&showinfo=0`}
                  title={config?.hero_video_title || "Video hero"}
                  className="absolute inset-0 h-full w-full scale-150 object-cover"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  style={{ pointerEvents: "none" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-netland-dark/90 via-netland-dark/40 to-netland-dark/20" />
              </>
            ) : (
              // Cloudinary or direct video
              <>
                <video
                  src={videoUrl}
                  autoPlay
                  loop
                  playsInline
                  controls
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-netland-dark/90 via-netland-dark/40 to-netland-dark/20" />
              </>
            )}
          </div>
        ) : (
          <>
            {HERO_SLIDES.map((slide, i) => (
              <div
                key={slide.src}
                className={`absolute inset-0 transition-opacity duration-[1400ms] ease-in-out ${
                  i === activeIndex ? "opacity-100" : "opacity-0"
                }`}
              >
                <img
                  src={slide.src}
                  alt={slide.alt}
                  className="h-full w-full object-cover"
                  fetchPriority={i === 0 ? "high" : undefined}
                  loading={i === 0 ? "eager" : "lazy"}
                />
              </div>
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-netland-dark/90 via-netland-dark/50 to-netland-dark/30" />
          </>
        )}
      </div>

      <div className="container-netland relative z-10 pb-24 pt-36 text-white">
        <Reveal>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.25em] backdrop-blur">
            <MapPin className="h-3.5 w-3.5 text-netland-accent" />
            Cañete, Perú
          </p>
          <h1 className="max-w-3xl text-balance font-display text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">
            El lugar donde{" "}
            <span className="text-netland-accent">mereces vivir</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/90">
            Invierte en proyectos inmobiliarios pensados para tu futuro, con
            respaldo, confianza y oportunidades de crecimiento en Cañete.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link to="/proyectos" className="btn-primary">
              Ver proyectos
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp"
            >
              <MessageCircle className="h-4 w-4" />
              Hablar con un asesor
            </a>
            {hasVideo && !showVideo && (
              <button
                onClick={() => setShowVideo(true)}
                className="inline-flex items-center gap-2 rounded-full border-2 border-white/80 bg-white/10 px-6 py-3 font-semibold text-white backdrop-blur transition-all hover:bg-white/20"
              >
                <Play className="h-4 w-4" />
                Ver video
              </button>
            )}
          </div>
        </Reveal>
      </div>

      {!showVideo && (
        <>
          <button
            onClick={() => goTo(activeIndex - 1)}
            aria-label="Imagen anterior"
            className="absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/30 bg-white/10 p-2.5 text-white backdrop-blur transition-all hover:bg-white/20 sm:block"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => goTo(activeIndex + 1)}
            aria-label="Imagen siguiente"
            className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/30 bg-white/10 p-2.5 text-white backdrop-blur transition-all hover:bg-white/20 sm:block"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5">
            {HERO_SLIDES.map((slide, i) => (
              <button
                key={slide.src}
                onClick={() => goTo(i)}
                aria-label={`Ir a la imagen ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === activeIndex
                    ? "w-8 bg-netland-accent"
                    : "w-2 bg-white/60 hover:bg-white"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ProjectsSection({
  projects,
  loading,
}: {
  projects?: Project[];
  loading: boolean;
}) {
  return (
    <section className="section-padding bg-netland-background">
      <div className="container-netland">
        <Reveal>
          <div className="mb-14 max-w-2xl">
            <p className="eyebrow">Nuestros proyectos</p>
            <h2 className="text-balance font-display text-4xl font-semibold text-netland-dark sm:text-5xl">
              Lugares pensados para crecer
            </h2>
            <p className="mt-4 text-netland-muted">
              Descubre proyectos inmobiliarios en Cañete diseñados para familias
              e inversionistas que buscan seguridad y calidad de vida.
            </p>
          </div>
        </Reveal>

        {loading ? (
          <CoreSpinLoader />
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {projects?.map((project, i) => (
              <Reveal key={project.id} delay={i * 120}>
                <Link
                  to={`/proyectos/${project.slug}`}
                  className="group relative block overflow-hidden rounded-xl shadow-lg transition-shadow duration-300 hover:shadow-2xl"
                >
                  {/* Imagen con mejor calidad */}
                  <div className="aspect-[4/3] overflow-hidden bg-netland-dark">
                    <img
                      src={
                        project.hero_image
                          ? project.hero_image.replace(
                              /upload\//,
                              "upload/q_auto:best,f_auto,w_1200/",
                            )
                          : HERO_IMAGE
                      }
                      alt={project.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </div>

                  {/* Overlay mejorado con mejor gradiente */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

                  {/* Contenido con mejor contraste */}
                  <div className="absolute inset-x-0 bottom-0 p-7">
                    {/* Badge de tipo */}
                    <span className="mb-3 inline-block rounded-full bg-netland-accent px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-lg">
                      {project.project_type === "condominio_campestre"
                        ? "Condominio campestre"
                        : "Urbanización"}
                    </span>

                    {/* Título con sombra de texto para mejor legibilidad */}
                    <h3 className="font-display text-3xl font-bold text-white drop-shadow-lg">
                      {project.short_name}
                    </h3>

                    {/* Ubicación */}
                    <p className="mt-2 flex items-center gap-2 text-sm text-white drop-shadow-md">
                      <MapPin className="h-4 w-4 text-netland-accent" />
                      <span className="font-medium">{project.location}</span>
                    </p>

                    {/* Separador sutil */}
                    <div className="my-4 h-px bg-white/20" />

                    {/* Info de lotes y CTA */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
                          <Building2 className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-bold text-white">
                          {project.available_count} lotes disponibles
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-all group-hover:bg-netland-accent group-hover:text-white">
                        Ver proyecto
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section className="bg-netland-dark py-20 text-white md:py-28">
      <div className="container-netland">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <Reveal>
              <div className="max-w-lg">
                <p className="eyebrow">Confianza</p>
                <h2 className="font-display text-4xl font-semibold sm:text-5xl">
                  Invierte con respaldo
                </h2>
                <p className="mt-4 text-white/70">
                  Cada proyecto de Netland se desarrolla con seriedad,
                  transparencia y cercanía con el cliente.
                </p>
              </div>
            </Reveal>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {trustItems.map((item, i) => (
                <Reveal key={item.title} delay={i * 80}>
                  <div className="flex h-full items-center gap-4 rounded-md border border-white/10 bg-white/5 p-5 backdrop-blur transition-colors hover:border-netland-accent/50">
                    <item.icon className="h-8 w-8 shrink-0 text-netland-accent" />
                    <span className="text-sm font-medium leading-snug">
                      {item.title}
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={150}>
            <div className="relative">
              <div className="overflow-hidden rounded-2xl shadow-2xl">
                <img
                  src={entregallave}
                  alt="Entrega de llaves a una familia feliz"
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-netland-dark/80 via-transparent to-netland-dark/20" />

              <div className="absolute -bottom-6 -left-6 hidden w-44 overflow-hidden rounded-xl border-4 border-netland-dark shadow-xl sm:block">
                <img
                  src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80"
                  alt="Casa entregada"
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>

              <div className="absolute right-6 top-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
                <ShieldCheck className="h-4 w-4 text-netland-accent" />
                Contrato protegido
              </div>

              <div className="absolute inset-x-4 bottom-6 rounded-xl bg-white/10 p-4 backdrop-blur md:inset-x-auto md:bottom-6 md:right-6 md:max-w-xs">
                <p className="font-display text-lg font-bold text-white">
                  Llave en mano, sueños cumplidos
                </p>
                <p className="mt-1 text-sm text-white/80">
                  Entrega de terreno y contrato con firma.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function WhySection() {
  return (
    <section className="section-padding bg-netland-background">
      <div className="container-netland">
        <Reveal>
          <div className="mb-14 max-w-2xl">
            <p className="eyebrow">Nuestra filosofía</p>
            <h2 className="font-display text-4xl font-semibold text-netland-dark sm:text-5xl">
              ¿Por qué Netland?
            </h2>
          </div>
        </Reveal>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {whyItems.map((item, i) => (
            <Reveal key={item.title} delay={i * 100}>
              <div className="group h-full rounded-lg bg-white p-8 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-netland-light text-netland-primary transition-colors group-hover:bg-netland-primary group-hover:text-white">
                  <item.icon className="h-7 w-7" />
                </div>
                <h3 className="mb-2 font-display text-2xl font-semibold text-netland-dark">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-netland-muted">
                  {item.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsStrip() {
  return (
    <section className="border-y border-netland-light bg-netland-light/50 py-14">
      <div className="container-netland grid gap-8 text-center sm:grid-cols-3">
        <div>
          <p className="font-display text-5xl font-semibold text-netland-primary">
            100%
          </p>
          <p className="mt-2 text-sm uppercase tracking-wider text-netland-muted">
            Respaldo y confianza
          </p>
        </div>
        <div>
          <p className="font-display text-5xl font-semibold text-netland-primary">
            Cañete
          </p>
          <p className="mt-2 text-sm uppercase tracking-wider text-netland-muted">
            Nuestro origen y crecimiento
          </p>
        </div>
        <div>
          <p className="font-display text-5xl font-semibold text-netland-primary">
            S/ 0
          </p>
          <p className="mt-2 text-sm uppercase tracking-wider text-netland-muted">
            Intereses en cuotas
          </p>
        </div>
      </div>
    </section>
  );
}

function ReferralSection() {
  return (
    <section className="section-padding bg-white">
      <div className="container-netland">
        <Reveal>
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="eyebrow justify-center">Refiere y gana</p>
            <h2 className="font-display text-4xl font-semibold text-netland-dark sm:text-5xl">
              Tu mejor publicidad eres tú
            </h2>
            <p className="mt-4 text-netland-muted">
              Invita a tus amigos y familiares a invertir en Netland y gana
              beneficios por cada persona que decida dar el paso.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-8 lg:grid-cols-2">
          <Reveal>
            <Link
              to="/refiere-y-gana"
              className="group relative block overflow-hidden rounded-2xl shadow-soft transition-all duration-500 hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="relative aspect-video overflow-hidden bg-netland-dark">
                <img
                  src={refiereGana}
                  alt="Persona feliz participando en Refiere y gana"
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <img
                  src={logoNetland}
                  alt="Logo Netland"
                  className="absolute left-6 top-6 w-16 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] sm:w-20"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-netland-primary/95 via-netland-primary/45 to-netland-primary/5" />
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-6">
                <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-netland-accent px-5 py-2 text-sm font-bold text-white transition-all group-hover:bg-white group-hover:text-netland-primary">
                  Ver el programa
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </Reveal>

          <Reveal delay={120}>
            <div className="group relative block overflow-hidden rounded-2xl shadow-soft">
              <div className="aspect-[4/3] overflow-hidden bg-netland-dark">
                <img
                  src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80"
                  alt="Casa soñada junto a Netland"
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-8">
                <span className="mb-3 inline-block rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-white backdrop-blur">
                  Netland
                </span>
                <h3 className="font-display text-3xl font-bold text-white drop-shadow-md">
                  La casa de tus sueños te espera
                </h3>
                <p className="mt-2 max-w-md text-sm text-white/85">
                  Con cada recomendación ayudas a otra familia a conseguir su
                  lote ideal y tú también ganas.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-netland-primary py-24">
      <div className="absolute inset-0 opacity-10">
        <img
          src="https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=80"
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="container-netland relative z-10 text-center text-white">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-balance font-display text-4xl font-semibold sm:text-5xl">
            Tu futuro empieza con un lote
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            Consulta disponibilidad, agenda una visita o habla directamente con
            un asesor de Netland.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link to="/proyectos" className="btn-accent">
              Ver lotes disponibles
            </Link>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp"
            >
              <MessageCircle className="h-4 w-4" />
              Agendar visita
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
