import { useQuery } from "@tanstack/react-query";
import { Mail, MessageCircle, Phone, Award, Star } from "lucide-react";
import { api } from "../lib/api";
import { whatsappLink } from "../lib/constants";
import type { Advisor } from "../types";
import { Reveal } from "../components/Reveal";
import { CoreSpinLoader } from "../components/ui/CoreSpinLoader";

export default function Advisors() {
  const { data: advisors, isLoading } = useQuery({
    queryKey: ["advisors"],
    queryFn: () => api.get<Advisor[]>("/advisors"),
  });

  // Filtrar solo asesores disponibles (el backend los ordena por creación, últimos primero)
  const availableAdvisors = advisors?.filter((advisor) => advisor.is_available) || [];

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
              <pattern id="grid-advisors" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-advisors)" />
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
              <span className="text-netland-accent">Nuestros Asesores</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/95 drop-shadow-md">
              Expertos asesores inmobiliarios comprometidos en ayudarte a encontrar el lote perfecto para tu futuro.
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

      {/* Intro */}
      <section className="section-padding bg-white">
        <div className="container-netland">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <p className="eyebrow justify-center">Equipo profesional</p>
              <h2 className="font-display text-4xl font-bold leading-tight text-netland-dark lg:text-5xl">
                Asesores que <span className="text-netland-accent">transforman sueños</span> en realidad
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-netland-muted">
                Nuestro equipo de asesores inmobiliarios está capacitado para brindarte
                orientación completa, desde la elección del lote hasta el cierre de la compra.
                Con atención personalizada y conocimiento profundo de cada proyecto.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Grid de asesores */}
      <section className="section-padding bg-netland-background">
        <div className="container-netland">
          {isLoading ? (
            <CoreSpinLoader />
          ) : availableAdvisors.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-netland-light bg-white p-16 text-center">
              <Award className="mx-auto mb-4 h-12 w-12 text-netland-muted/40" />
              <p className="text-netland-muted">
                No hay asesores disponibles en este momento.
              </p>
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {availableAdvisors.map((advisor, i) => (
                <Reveal key={advisor.id} delay={i * 100}>
                  <AdvisorCard advisor={advisor} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-netland-primary text-white">
        <div className="container-netland">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <Star className="mx-auto mb-6 h-12 w-12 text-netland-accent" />
              <h2 className="font-display text-4xl font-bold leading-tight lg:text-5xl">
                ¿Listo para dar el siguiente paso?
              </h2>
              <p className="mt-6 text-lg text-white/90">
                Contacta directamente a uno de nuestros asesores o comunícate con
                nosotros para que te asignemos al especialista ideal para tu proyecto.
              </p>
              <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
                <a
                  href={whatsappLink("Hola, quiero hablar con un asesor inmobiliario")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-accent"
                >
                  <MessageCircle className="h-4 w-4" />
                  Hablar por WhatsApp
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}

function AdvisorCard({ advisor }: { advisor: Advisor }) {
  const hasPhoto = advisor.photo_url && advisor.photo_url.trim() !== "";
  const initials = advisor.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="group relative h-full overflow-hidden rounded-2xl bg-white shadow-soft transition-all duration-500 hover:-translate-y-2 hover:shadow-lift">
      {/* Foto o Avatar */}
      <div className="relative h-80 overflow-hidden bg-gradient-to-br from-netland-primary to-netland-dark">
        {hasPhoto ? (
          <img
            src={advisor.photo_url}
            alt={advisor.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white/10 backdrop-blur">
              <span className="font-display text-5xl font-bold text-white">
                {initials}
              </span>
            </div>
          </div>
        )}
        {/* Badge flotante */}
        <div className="absolute right-4 top-4 rounded-full bg-netland-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg">
          Disponible
        </div>
      </div>

      {/* Contenido */}
      <div className="p-8">
        <h3 className="font-display text-2xl font-bold text-netland-dark">
          {advisor.name}
        </h3>
        <p className="mt-1 text-sm font-medium uppercase tracking-wider text-netland-accent">
          {advisor.role_title}
        </p>

        {advisor.bio && advisor.bio.trim() !== "" && (
          <p className="mt-4 text-sm leading-relaxed text-netland-muted line-clamp-3">
            {advisor.bio}
          </p>
        )}

        {/* Contacto */}
        <div className="mt-6 space-y-3">
          {advisor.phone && advisor.phone.trim() !== "" && (
            <>
              <a
                href={`https://wa.me/${advisor.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Hola ${advisor.name}, me gustaría recibir asesoría inmobiliaria`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-netland-light bg-netland-light/30 px-4 py-3 text-sm font-medium text-netland-dark transition-all hover:border-green-500 hover:bg-green-50 hover:text-green-700"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>

              <a
                href={`tel:${advisor.phone.replace(/\D/g, '')}`}
                className="flex items-center gap-3 rounded-lg border border-netland-light bg-netland-light/30 px-4 py-3 text-sm font-medium text-netland-dark transition-all hover:border-netland-primary hover:bg-netland-light hover:text-netland-primary"
              >
                <Phone className="h-4 w-4" />
                {advisor.phone}
              </a>
            </>
          )}

          {advisor.email && advisor.email.trim() !== "" && (
            <a
              href={`mailto:${advisor.email}`}
              className="flex items-center gap-3 rounded-lg border border-netland-light bg-netland-light/30 px-4 py-3 text-sm font-medium text-netland-dark transition-all hover:border-netland-primary hover:bg-netland-light hover:text-netland-primary"
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
