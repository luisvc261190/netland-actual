import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { api } from "../lib/api";
import { whatsappLink } from "../lib/constants";
import { validateName, validatePhone, validateEmail } from "../lib/validations";
import { usePageMeta } from "../lib/seo";
import type { Advisor, Project } from "../types";
import { Reveal } from "../components/Reveal";
import { useLeadForm } from "../features/leads/useLeadForm";
import { ValidatedInput } from "../components/ui/ValidatedInput";
import { CheckCircle2 } from "lucide-react";

export default function Contact() {
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<Project[]>("/projects?published_only=true"),
  });
  const { data: advisors } = useQuery({
    queryKey: ["advisors"],
    queryFn: () => api.get<Advisor[]>("/advisors"),
  });
  const { submit, submitting, submitted } = useLeadForm();

  usePageMeta({
    title: "Contacto | NETLAND Corporación Inmobiliaria",
    description:
      "Contáctanos para conocer los proyectos inmobiliarios de Netland en Cañete. Asesoría personalizada, visitas guiadas y financiamiento directo sin intereses.",
    path: "/contacto",
  });
  const [form, setForm] = useState({
    name: "",
    last_name: "",
    phone: "",
    email: "",
    project_id: "",
    message: "",
  });

  const formIsValid =
    !validateName(form.name) &&
    !validatePhone(form.phone) &&
    !validateEmail(form.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formIsValid) return;
    await submit({
      name: form.name,
      last_name: form.last_name,
      phone: form.phone,
      email: form.email || null,
      project_id: form.project_id ? Number(form.project_id) : null,
      message: form.message,
      source: "contacto",
    });
  };

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
              <pattern id="grid-contact" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-contact)" />
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
              <span className="text-netland-accent">Contacto</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/95 drop-shadow-md">
              Habla con un asesor, agenda una visita o resuelve todas tus dudas.
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
        <div className="container-netland grid gap-14 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Reveal>
              <h2 className="mb-2 font-display text-3xl font-semibold text-netland-dark">
                Escríbenos
              </h2>
              <p className="mb-8 text-netland-muted">
                Completa el formulario y un asesor de Netland te contactará muy
                pronto.
              </p>
            </Reveal>

            {submitted ? (
              <div className="flex flex-col items-center gap-3 rounded-lg bg-white py-16 text-center shadow-soft">
                <CheckCircle2 className="h-14 w-14 text-netland-primary" />
                <h3 className="font-display text-2xl font-semibold text-netland-dark">
                  ¡Mensaje enviado!
                </h3>
                <p className="max-w-sm text-sm text-netland-muted">
                  Gracias por contactarnos. Un asesor de Netland se comunicará
                  contigo a la brevedad.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-5 rounded-lg bg-white p-8 shadow-soft"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <ValidatedInput
                    label="Nombre"
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                    placeholder="Tu nombre"
                    type="name"
                    required
                  />
                  <ValidatedInput
                    label="Apellidos"
                    value={form.last_name}
                    onChange={(v) => setForm({ ...form, last_name: v })}
                    placeholder="Tus apellidos"
                    type="name"
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <ValidatedInput
                    label="Teléfono / WhatsApp"
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                    placeholder="999 888 777"
                    type="phone"
                    required
                  />
                  <ValidatedInput
                    label="Correo electrónico"
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                    placeholder="tucorreo@email.com"
                    type="email"
                    inputType="email"
                  />
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-netland-muted">
                    Proyecto de interés
                  </span>
                  <select
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    className="w-full rounded-sm border border-netland-light bg-netland-background px-4 py-3 text-sm outline-none focus:border-netland-primary"
                  >
                    <option value="">Todos / No estoy seguro</option>
                    {projects?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.short_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-netland-muted">
                    Mensaje
                  </span>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    rows={4}
                    placeholder="Cuéntanos qué buscas..."
                    className="w-full resize-none rounded-sm border border-netland-light bg-netland-background px-4 py-3 text-sm outline-none focus:border-netland-primary"
                  />
                </label>
                <button
                  type="submit"
                  disabled={submitting || !formIsValid}
                  className="btn-primary w-full disabled:opacity-60"
                >
                  {submitting ? "Enviando..." : "Enviar mensaje"}
                </button>
              </form>
            )}
          </div>

          <div className="space-y-6 lg:col-span-2">
            <Reveal delay={100}>
              <div className="rounded-lg bg-netland-dark p-7 text-white">
                <h3 className="mb-5 font-display text-2xl font-semibold">
                  Contacto directo
                </h3>
                <ul className="space-y-4 text-sm">
                  <li className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-netland-accent" />
                    985 928 062
                  </li>
                  <li>
                    <a
                      href={whatsappLink()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-whatsapp w-full"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp directo
                    </a>
                  </li>
                  <li className="flex items-start gap-3 pt-2 text-white/75">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-netland-accent" />
                    Cañete, Lima, Perú
                  </li>
                </ul>
              </div>
            </Reveal>

            {advisors && advisors.length > 0 && (
              <Reveal delay={180}>
                <div className="rounded-lg bg-white p-7 shadow-soft">
                  <h3 className="mb-5 font-display text-2xl font-semibold text-netland-dark">
                    Nuestro equipo
                  </h3>
                  <div className="space-y-4">
                    {advisors.map((advisor) => (
                      <div key={advisor.id} className="flex items-center gap-4">
                        {advisor.photo_url ? (
                          <img
                            src={advisor.photo_url}
                            alt={advisor.name}
                            className="h-14 w-14 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-netland-light font-display text-xl font-semibold text-netland-primary">
                            {advisor.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-netland-dark">{advisor.name}</p>
                          <p className="text-xs uppercase tracking-wider text-netland-muted">
                            {advisor.role_title}
                          </p>
                          <a
                            href={whatsappLink(
                              `Hola ${advisor.name.split(" ")[0]}, estoy interesado en los proyectos de Netland.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-netland-accent hover:underline"
                          >
                            Hablar con {advisor.name.split(" ")[0]}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

