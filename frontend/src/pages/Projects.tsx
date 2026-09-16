import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { api } from "../lib/api";
import { usePageMeta } from "../lib/seo";
import type { Project } from "../types";
import { Reveal } from "../components/Reveal";
import { CoreSpinLoader } from "../components/ui/CoreSpinLoader";
import { EmptyState } from "../components/ui/EmptyState";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1800&q=80";

export default function Projects() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: ({ signal }) => api.get<Project[]>("/projects?published_only=true", false, signal),
  });

  usePageMeta({
    title: "Proyectos en Cañete | NETLAND",
    description:
      "Conoce los proyectos inmobiliarios de Netland en Cañete. Lotes con financiamiento directo, planos interactivos y disponibilidad en tiempo real.",
    path: "/proyectos",
  });

  return (
    <div>
      {/* Hero moderno y dinámico */}
      <section className="relative overflow-hidden bg-gradient-to-br from-netland-primary via-green-700 to-emerald-900 pb-20 pt-36 text-white">
        {/* Imagen de fondo con overlay */}
        <div className="absolute inset-0 opacity-15">
          <img
            src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1920&q=80"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>

        {/* Patrón geométrico moderno */}
        <div className="absolute inset-0">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-projects" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-projects)" />
          </svg>
        </div>

        {/* Formas decorativas flotantes */}
        <div className="absolute -right-20 top-20 h-72 w-72 rounded-full bg-netland-accent/20 blur-3xl animate-pulse" />
        <div className="absolute -left-20 bottom-20 h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute right-1/3 top-1/3 h-64 w-64 rounded-full bg-yellow-400/10 blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />

        {/* Contenido */}
        <div className="container-netland relative z-10">
          <Reveal>
            <p className="eyebrow justify-start !text-white/95 drop-shadow-lg">Netland</p>
            <h1 className="max-w-3xl text-balance font-display text-5xl font-bold leading-tight drop-shadow-xl sm:text-6xl lg:text-7xl">
              <span className="text-netland-accent">Nuestros Proyectos</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/95 drop-shadow-md">
              Desarrollos inmobiliarios en Cañete pensados para familias e inversionistas.
            </p>
          </Reveal>
        </div>

        {/* Onda decorativa en la parte inferior */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="h-20 w-full">
            <path
              d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 80C1200 80 1320 70 1380 65L1440 60V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      <section className="section-padding bg-netland-background">
        <div className="container-netland">
          {isLoading ? (
            <CoreSpinLoader />
          ) : !projects || projects.length === 0 ? (
            <EmptyState
              title="Próximamente nuevos proyectos"
              description="Estamos preparando nuevos desarrollos. Contacta a un asesor para más información."
            />
          ) : (
            <div className="grid gap-10 md:grid-cols-2">
              {projects.map((project, i) => (
                <Reveal key={project.id} delay={i * 120}>
                  <ProjectCard project={project} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const typeLabel =
    project.project_type === "condominio_campestre"
      ? "Condominio Campestre"
      : project.project_type === "urbanizacion"
      ? "Urbanización"
      : "Proyecto Inmobiliario";

  return (
    <article className="group overflow-hidden rounded-xl border border-netland-light bg-white transition-all duration-300 hover:border-netland-primary hover:shadow-soft">
      <Link to={`/proyectos/${project.slug}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={project.hero_image || HERO_IMAGE}
            alt={project.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="absolute left-5 top-5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-netland-primary backdrop-blur-sm">
            {typeLabel}
          </span>
        </div>
      </Link>

      <div className="p-8">
        <h3 className="font-display text-3xl font-bold text-netland-dark">
          <Link to={`/proyectos/${project.slug}`} className="transition-colors hover:text-netland-primary">
            {project.short_name}
          </Link>
        </h3>
        <p className="mt-2 flex items-center gap-2 text-sm text-netland-muted">
          <MapPin className="h-4 w-4 text-netland-accent" />
          {project.location}
        </p>
        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-netland-muted">
          {project.description}
        </p>

        <div className="mt-6 flex items-center justify-between border-t border-netland-light pt-6">
          <div className="text-sm">
            <span className="block font-bold text-netland-dark">{project.available_count}</span>
            <span className="text-netland-muted">lotes disponibles</span>
          </div>
          <div className="flex gap-3">
            <Link
              to={`/proyectos/${project.slug}`}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-netland-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-netland-primary transition-all hover:bg-netland-primary hover:text-white"
            >
              Ver proyecto
            </Link>
            <Link
              to={`/proyectos/${project.slug}?tab=lotes`}
              className="inline-flex items-center gap-2 rounded-lg bg-netland-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-white transition-all hover:bg-netland-primaryDark"
            >
              Ver lotes
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}