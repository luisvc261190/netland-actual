import { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Gift, 
  Handshake, 
  ShieldCheck,
  Users,
  TrendingUp,
  Award,
  Star,
  Sparkles,
  Heart,
  Target,
  Zap,
  Crown,
  BadgeCheck,
  PartyPopper
} from "lucide-react";
import { Reveal } from "../components/Reveal";
import { useLeadForm } from "../features/leads/useLeadForm";
import { usePageMeta } from "../lib/seo";
import { validateName, validatePhone, validateEmail, validateField } from "../lib/validations";

const benefits = [
  {
    icon: Gift,
    title: "Recompensas atractivas",
    text: "Por cada referido exitoso, recibe beneficios especiales que aumentan con cada recomendación.",
    color: "from-yellow-500 to-orange-500"
  },
  {
    icon: Handshake,
    title: "Acompañamiento VIP",
    text: "Tu referido recibe atención preferencial desde el primer contacto hasta el cierre.",
    color: "from-emerald-500 to-teal-500"
  },
  {
    icon: ShieldCheck,
    title: "Proceso 100% transparente",
    text: "Seguimiento en tiempo real de cada recomendación y confirmación inmediata de beneficios.",
    color: "from-blue-500 to-cyan-500"
  },
];

const rewardTiers = [
  {
    level: "Bronce",
    referrals: "1-2 referidos",
    icon: Award,
    color: "from-amber-700 to-amber-500",
    benefits: ["Bono en efectivo", "Certificado de reconocimiento"],
    glow: "shadow-amber-500/50"
  },
  {
    level: "Plata",
    referrals: "3-5 referidos",
    icon: Star,
    color: "from-slate-400 to-slate-200",
    benefits: ["Mayor bono en efectivo", "Regalo exclusivo", "Prioridad en proyectos"],
    glow: "shadow-slate-400/50"
  },
  {
    level: "Oro",
    referrals: "6+ referidos",
    icon: Crown,
    color: "from-yellow-500 to-yellow-300",
    benefits: ["Bono Premium", "Acceso VIP", "Descuentos especiales", "Evento exclusivo"],
    glow: "shadow-yellow-500/50",
    featured: true
  },
];

const stats = [
  { icon: Users, value: "500+", label: "Familias beneficiadas", color: "text-emerald-500" },
  { icon: TrendingUp, value: "95%", label: "Tasa de satisfacción", color: "text-blue-500" },
  { icon: Heart, value: "200+", label: "Referidos exitosos", color: "text-rose-500" },
  { icon: Gift, value: "S/. 150K+", label: "Beneficios entregados", color: "text-amber-500" },
];

const howItWorks = [
  {
    step: 1,
    title: "Comparte",
    description: "Llena el formulario con los datos de tu referido",
    icon: Users,
    color: "bg-gradient-to-br from-blue-500 to-cyan-500"
  },
  {
    step: 2,
    title: "Conectamos",
    description: "Nuestro equipo contacta a tu referido con atención VIP",
    icon: Handshake,
    color: "bg-gradient-to-br from-emerald-500 to-teal-500"
  },
  {
    step: 3,
    title: "Ganas",
    description: "Cuando tu referido avanza, tú recibes tu recompensa",
    icon: Gift,
    color: "bg-gradient-to-br from-amber-500 to-orange-500"
  },
];

const testimonials = [
  {
    name: "María González",
    referrals: 4,
    level: "Plata",
    quote: "Referí a mi hermana y tres amigos. El equipo de Netland fue increíble con ellos y yo recibí mi bono en tiempo récord.",
    avatar: "MG"
  },
  {
    name: "Carlos Ruiz",
    referrals: 7,
    level: "Oro",
    quote: "Ya llevo 7 referidos exitosos. Los beneficios son reales y el proceso es super transparente. ¡100% recomendado!",
    avatar: "CR"
  },
  {
    name: "Ana Torres",
    referrals: 2,
    level: "Bronce",
    quote: "Recomendé a dos compañeros de trabajo y ambos compraron sus lotes. El bono me ayudó a dar mi inicial.",
    avatar: "AT"
  },
];

export default function ReferAndEarn() {
  const { submit, submitting, submitted, error } = useLeadForm();
  const [step, setStep] = useState(1);

  usePageMeta({
    title: "Refiere y Gana | NETLAND Corporación Inmobiliaria",
    description:
      "Refiere a tus amigos y familiares para que conozcan los proyectos de Netland en Cañete y recibe recompensas por cada recomendación exitosa.",
    path: "/refiere-y-gana",
  });
  const [form, setForm] = useState({
    referrerName: "",
    referrerPhone: "",
    name: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
    consent: false,
  });

  const update = (key: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      validateName(form.referrerName) ||
      validatePhone(form.referrerPhone) ||
      validateName(form.name) ||
      (form.phone && validatePhone(form.phone)) ||
      (form.email && validateEmail(form.email))
    ) {
      return;
    }
    const message = [
      "Programa Refiere y gana",
      `Referente: ${form.referrerName}`,
      `Contacto del referente: ${form.referrerPhone}`,
      form.notes ? `Interés comentado: ${form.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await submit({
      name: form.name,
      last_name: form.lastName,
      phone: form.phone,
      email: form.email || null,
      message,
      source: "referido",
    });
  };

  const canContinue =
    validateName(form.referrerName) === null &&
    validatePhone(form.referrerPhone) === null;

  const canSubmitReferral =
    validateName(form.name) === null &&
    validatePhone(form.phone) === null &&
    (form.email === "" || validateEmail(form.email) === null) &&
    form.consent;

  return (
    <div className="overflow-hidden">
      {/* Hero ESPECTACULAR con animaciones */}
      <section className="relative overflow-hidden bg-netland-primary pb-24 pt-32 text-white">
        {/* Imagen de fondo con overlay */}
        <div className="absolute inset-0 opacity-15">
          <img
            src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1920&q=80"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>

        {/* Patrón geométrico */}
        <div className="absolute inset-0">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-refiere-new" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-refiere-new)" />
          </svg>
        </div>

        {/* Formas decorativas flotantes */}
        <div className="absolute -right-20 top-20 h-72 w-72 rounded-full bg-netland-accent/20 blur-3xl animate-pulse" />
        <div className="absolute -left-20 bottom-20 h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute right-1/3 top-1/3 h-64 w-64 rounded-full bg-yellow-400/10 blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />

        {/* Contenido del Hero */}
        <div className="container-netland relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <Reveal>
              {/* Badge animado */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/20 px-6 py-2 backdrop-blur-sm">
                <PartyPopper className="h-5 w-5 text-yellow-300 animate-bounce" />
                <span className="text-sm font-bold uppercase tracking-wider">¡Nuevo programa de referidos!</span>
                <Sparkles className="h-5 w-5 text-yellow-300 animate-pulse" />
              </div>

              <h1 className="text-balance font-display text-5xl font-black leading-tight drop-shadow-2xl sm:text-6xl lg:text-7xl">
                Comparte la oportunidad,{" "}
                <span className="text-netland-accent">
                  Gana beneficios reales
                </span>
              </h1>

              <p className="mx-auto mt-8 max-w-2xl text-xl leading-relaxed text-white/95 drop-shadow-lg">
                Por cada persona que recomiendes y concrete con Netland, tú ganas. 
                <strong className="text-yellow-300"> Simple, transparente y rentable.</strong>
              </p>

              {/* Botón CTA principal */}
              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <a
                  href="#formulario"
                  className="group relative overflow-hidden rounded-full bg-netland-accent px-10 py-4 font-bold text-white shadow-2xl shadow-yellow-500/50 transition-all duration-300 hover:scale-105 hover:shadow-yellow-500/70 hover:bg-yellow-500"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    Referir ahora
                    <Sparkles className="h-5 w-5" />
                  </span>
                </a>
                <a
                  href="#beneficios"
                  className="rounded-full border-2 border-white/30 bg-white/10 px-8 py-4 font-semibold backdrop-blur-sm transition-all hover:bg-white/20"
                >
                  Ver beneficios
                </a>
              </div>
            </Reveal>

            {/* Estadísticas con efecto contador */}
            <Reveal delay={200}>
              <div className="mt-16 grid grid-cols-2 gap-6 lg:grid-cols-4">
                {stats.map((stat, i) => (
                  <StatCounter
                    key={stat.label}
                    icon={stat.icon}
                    value={stat.value}
                    label={stat.label}
                    color={stat.color}
                    delay={i * 100}
                  />
                ))}
              </div>
            </Reveal>
          </div>
        </div>

        {/* Onda decorativa mejorada */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="h-24 w-full">
            <path
              d="M0,64 C240,100 480,120 720,100 C960,80 1200,40 1440,64 L1440,120 L0,120 Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* Sección de Niveles de Recompensa */}
      <section id="beneficios" className="section-padding bg-white">
        <div className="container-netland">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <Reveal>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-100 to-yellow-100 px-4 py-2">
                <Crown className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-bold uppercase tracking-wider text-amber-900">Sistema de niveles</span>
              </div>
              <h2 className="font-display text-4xl font-bold text-netland-dark lg:text-5xl">
                Cuanto más compartes, <span className="text-netland-accent">más ganas</span>
              </h2>
              <p className="mt-4 text-lg text-netland-muted">
                Alcanza diferentes niveles y desbloquea beneficios cada vez mayores
              </p>
            </Reveal>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {rewardTiers.map((tier, i) => (
              <Reveal key={tier.level} delay={i * 120}>
                <div
                  className={`group relative overflow-hidden rounded-2xl border-2 p-8 transition-all duration-500 hover:scale-105 ${
                    tier.featured
                      ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-2xl shadow-yellow-500/30'
                      : 'border-netland-light bg-white hover:border-netland-primary hover:shadow-xl'
                  }`}
                >
                  {tier.featured && (
                    <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 opacity-20 blur-2xl" />
                  )}

                  {/* Badge del nivel */}
                  <div className={`mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-white shadow-lg ${tier.glow}`}
                    style={{ backgroundColor: tier.level === 'Oro' ? '#eab308' : tier.level === 'Plata' ? '#94a3b8' : '#92400e' }}>
                    <tier.icon className="h-5 w-5" />
                    <span className="font-bold">{tier.level}</span>
                  </div>

                  <p className="mb-6 text-sm font-semibold uppercase tracking-wider text-netland-muted">
                    {tier.referrals}
                  </p>

                  <ul className="space-y-3">
                    {tier.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-3">
                        <BadgeCheck className={`mt-0.5 h-5 w-5 shrink-0 ${tier.featured ? 'text-amber-600' : 'text-netland-primary'}`} />
                        <span className="text-sm leading-relaxed">{benefit}</span>
                      </li>
                    ))}
                  </ul>

                  {tier.featured && (
                    <div className="mt-6 rounded-lg bg-yellow-100 border border-yellow-300 p-3 text-center">
                      <p className="text-xs font-bold text-amber-900">🎯 NIVEL MÁS POPULAR</p>
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona - Visual mejorado */}
      <section className="section-padding bg-gradient-to-br from-netland-background to-emerald-50">
        <div className="container-netland">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <Reveal>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
                <Target className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-bold uppercase tracking-wider text-emerald-900">Proceso simple</span>
              </div>
              <h2 className="font-display text-4xl font-bold text-netland-dark lg:text-5xl">
                Solo 3 pasos para ganar
              </h2>
              <p className="mt-4 text-lg text-netland-muted">
                Un proceso diseñado para ser rápido, fácil y efectivo
              </p>
            </Reveal>
          </div>

          <div className="relative mx-auto max-w-5xl">
            {/* Línea conectora */}
            <div className="absolute left-1/2 top-0 hidden h-full w-1 -translate-x-1/2 bg-gradient-to-b from-emerald-200 via-teal-200 to-amber-200 lg:block" />

            <div className="space-y-12 lg:space-y-24">
              {howItWorks.map((item, i) => (
                <Reveal key={item.step} delay={i * 150}>
                  <div className={`flex flex-col items-center gap-8 lg:flex-row ${i % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
                    {/* Contenido */}
                    <div className="flex-1 text-center lg:text-left">
                      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-bold text-netland-muted shadow-sm">
                        <Zap className="h-4 w-4" />
                        Paso {item.step}
                      </div>
                      <h3 className="font-display text-3xl font-bold text-netland-dark">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-lg leading-relaxed text-netland-muted">
                        {item.description}
                      </p>
                    </div>

                    {/* Ícono central */}
                    <div className="relative z-10">
                      <div className="relative">
                        <div className={`absolute inset-0 animate-ping rounded-full opacity-20`}
                          style={{ backgroundColor: item.step === 1 ? '#3b82f6' : item.step === 2 ? '#10b981' : '#eab308' }} />
                        <div className={`flex h-28 w-28 items-center justify-center rounded-full shadow-2xl`}
                          style={{ backgroundColor: item.step === 1 ? '#3b82f6' : item.step === 2 ? '#10b981' : '#eab308' }}>
                          <item.icon className="h-14 w-14 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Espacio simétrico */}
                    <div className="hidden flex-1 lg:block" />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Beneficios con íconos */}
      <section className="section-padding bg-white">
        <div className="container-netland">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Reveal>
              <p className="eyebrow justify-center">Por qué elegirnos</p>
              <h2 className="font-display text-4xl font-bold text-netland-dark lg:text-5xl">
                Más que un programa de referidos
              </h2>
            </Reveal>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {benefits.map((benefit, i) => (
              <Reveal key={benefit.title} delay={i * 100}>
                <div className="group rounded-2xl border-2 border-netland-light bg-white p-8 transition-all duration-300 hover:scale-105 hover:border-netland-primary hover:shadow-2xl">
                  <div className={`mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg transition-transform group-hover:scale-110`}
                    style={{ backgroundColor: benefit.color === 'from-yellow-500 to-orange-500' ? '#eab308' : 
                             benefit.color === 'from-emerald-500 to-teal-500' ? '#10b981' : '#3b82f6' }}>
                    <benefit.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-netland-dark">
                    {benefit.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-netland-muted">
                    {benefit.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section className="section-padding bg-netland-dark text-white">
        <div className="container-netland">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Reveal>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
                <Star className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-bold uppercase tracking-wider">Historias reales</span>
              </div>
              <h2 className="font-display text-4xl font-bold lg:text-5xl">
                Lo que dicen nuestros referidores
              </h2>
              <p className="mt-4 text-lg text-white/80">
                Personas que ya están ganando con Netland
              </p>
            </Reveal>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {testimonials.map((testimonial, i) => (
              <Reveal key={testimonial.name} delay={i * 120}>
                <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/15">
                  {/* Badge de nivel */}
                  <div className="absolute right-4 top-4">
                    <div className={`rounded-full px-3 py-1 text-xs font-bold text-white`}
                      style={{ backgroundColor: testimonial.level === 'Oro' ? '#eab308' : 
                               testimonial.level === 'Plata' ? '#94a3b8' : '#92400e' }}>
                      {testimonial.level}
                    </div>
                  </div>

                  {/* Avatar */}
                  <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-netland-primary text-xl font-bold text-white shadow-lg">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-bold">{testimonial.name}</p>
                      <p className="text-sm text-white/60">{testimonial.referrals} referidos exitosos</p>
                    </div>
                  </div>

                  {/* Quote */}
                  <div className="relative">
                    <Star className="absolute -left-2 -top-2 h-8 w-8 text-yellow-400/20" />
                    <p className="relative italic leading-relaxed text-white/90">
                      "{testimonial.quote}"
                    </p>
                  </div>

                  {/* Decoración */}
                  <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl transition-all group-hover:scale-150" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Formulario mejorado */}
      <section id="formulario" className="section-padding bg-netland-background">
        <div className="container-netland grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <Reveal>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-bold uppercase tracking-wider text-emerald-900">Empieza hoy</span>
              </div>
              <h2 className="font-display text-4xl font-bold text-netland-dark lg:text-5xl">
                Comparte y empieza a ganar
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-netland-muted">
                Llena el formulario y en minutos tu referido estará en contacto con nuestro mejor equipo.
              </p>

              {/* Garantía visual */}
              <div className="mt-8 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-900">Garantía de privacidad</p>
                    <p className="mt-1 text-sm text-emerald-700">
                      Todos los datos son confidenciales y solo se usan para contacto oficial de Netland.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={120}>
            <div className="relative overflow-hidden rounded-2xl bg-white p-8 shadow-2xl sm:p-10">
              {/* Decoración de fondo */}
              <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-400/20 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-gradient-to-br from-amber-400/20 to-yellow-400/20 blur-3xl" />

              <div className="relative z-10">
                {submitted ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                    <div className="relative">
                      <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/50" />
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-2xl shadow-emerald-500/50">
                        <Check className="h-10 w-10" />
                      </div>
                    </div>
                    <h2 className="mt-8 font-display text-3xl font-bold text-netland-dark">
                      ¡Recomendación enviada! 🎉
                    </h2>
                    <p className="mt-4 max-w-sm text-lg leading-relaxed text-netland-muted">
                      Gracias por confiar en Netland. Nuestro equipo contactará a tu referido en las próximas 24 horas.
                    </p>
                    <div className="mt-8 rounded-lg bg-emerald-50 border-2 border-emerald-200 p-4">
                      <p className="text-sm font-semibold text-emerald-900">
                        📧 Te enviaremos un correo con el seguimiento de tu recomendación
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Indicador de progreso mejorado */}
                    <div className="flex items-center gap-3" aria-label={`Paso ${step} de 2`}>
                      {[1, 2].map((item) => (
                        <div key={item} className="flex flex-1 items-center gap-3">
                          <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all ${
                            step >= item 
                              ? "bg-netland-primary text-white shadow-lg scale-110" 
                              : "bg-netland-light text-netland-muted"
                          }`}>
                            {step > item ? <Check className="h-5 w-5" /> : item}
                            {step === item && (
                              <div className="absolute inset-0 animate-ping rounded-full bg-netland-primary opacity-50" />
                            )}
                          </div>
                          <span className={`hidden text-xs font-bold uppercase tracking-wider sm:block ${
                            step >= item ? "text-netland-primary" : "text-netland-muted"
                          }`}>
                            {item === 1 ? "Tu información" : "Tu referido"}
                          </span>
                          {item < 2 && (
                            <div className={`h-1 flex-1 rounded-full transition-all ${
                              step > item 
                                ? "bg-netland-primary" 
                                : "bg-netland-light"
                            }`} />
                          )}
                        </div>
                      ))}
                    </div>

                    {step === 1 ? (
                      <div className="space-y-7">
                        <div>
                          <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-netland-muted">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">1</span>
                            Paso 1 de 2
                          </p>
                          <h2 className="font-display text-2xl font-bold text-netland-dark">
                            ¿Quién eres tú?
                          </h2>
                          <p className="mt-2 text-sm text-netland-muted">
                            Necesitamos tus datos para reconocer tu recomendación y enviarte tu recompensa.
                          </p>
                        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input 
            label="Tu nombre completo" 
            value={form.referrerName} 
            onChange={(value) => update("referrerName", value)} 
            required 
            placeholder="Ej: Juan Pérez" 
            icon={Users}
            validateType="name"
          />
          <Input 
            label="Tu WhatsApp" 
            value={form.referrerPhone} 
            onChange={(value) => update("referrerPhone", value)} 
            required 
            placeholder="999 888 777" 
            type="tel"
            validateType="phone"
          />
        </div>
                        <button 
                          type="button" 
                          onClick={() => canContinue && setStep(2)} 
                          disabled={!canContinue} 
                          className="group relative w-full overflow-hidden rounded-xl bg-netland-primary py-4 font-bold text-white shadow-xl transition-all hover:scale-105 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            Continuar al paso 2
                            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-7">
                        <div>
                          <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-netland-muted">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">2</span>
                            Paso 2 de 2
                          </p>
                          <h2 className="font-display text-2xl font-bold text-netland-dark">
                            ¿A quién quieres referir?
                          </h2>
                          <p className="mt-2 text-sm text-netland-muted">
                            Nuestro equipo lo contactará con atención VIP y sin compromiso.
                          </p>
                        </div>
                        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
                          <p className="text-sm">
                            <span className="text-netland-muted">Recomendado por </span>
                            <strong className="text-emerald-900">{form.referrerName}</strong>
                          </p>
                        </div>
                        <div className="grid gap-5 sm:grid-cols-2">
                          <Input 
                            label="Nombre del referido" 
                            value={form.name} 
                            onChange={(value) => update("name", value)} 
                            required 
                            placeholder="Nombre" 
                            validateType="name"
                          />
                          <Input 
                            label="Apellidos" 
                            value={form.lastName} 
                            onChange={(value) => update("lastName", value)} 
                            placeholder="Apellidos" 
                            validateType="name"
                          />
                        </div>
                        <div className="grid gap-5 sm:grid-cols-2">
                          <Input 
                            label="WhatsApp del referido" 
                            value={form.phone} 
                            onChange={(value) => update("phone", value)} 
                            required 
                            placeholder="999 888 777" 
                            type="tel" 
                            validateType="phone"
                          />
                          <Input 
                            label="Correo (opcional)" 
                            value={form.email} 
                            onChange={(value) => update("email", value)} 
                            placeholder="correo@ejemplo.com" 
                            type="email" 
                            validateType="email"
                          />
                        </div>
                        <label className="block">
                          <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-netland-muted">
                            ¿Qué está buscando? (opcional)
                          </span>
                          <textarea 
                            value={form.notes} 
                            onChange={(event) => update("notes", event.target.value)} 
                            rows={3} 
                            placeholder="Ej: Busca un lote de 200m² en zona campestre para construir su casa" 
                            className="w-full resize-none rounded-xl border-2 border-netland-light bg-white px-4 py-3 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" 
                          />
                        </label>
                        <label className="flex items-start gap-3 rounded-xl border-2 border-netland-light bg-white p-4 text-sm text-netland-muted transition-all hover:border-emerald-300">
                          <input 
                            type="checkbox" 
                            checked={form.consent} 
                            onChange={(event) => update("consent", event.target.checked)} 
                            required 
                            className="mt-1 h-5 w-5 accent-emerald-600" 
                          />
                          <span className="leading-relaxed">
                            Confirmo que cuento con <strong className="text-netland-dark">autorización expresa</strong> de esta persona para compartir sus datos con Netland.
                          </span>
                        </label>
                        {error && (
                          <div className="rounded-xl bg-red-50 border-2 border-red-200 p-4">
                            <p className="text-sm font-semibold text-red-800">{error}</p>
                          </div>
                        )}
                        <div className="flex flex-col-reverse gap-3 sm:flex-row">
                          <button 
                            type="button" 
                            onClick={() => setStep(1)} 
                            className="flex items-center justify-center gap-2 rounded-xl border-2 border-netland-primary px-6 py-4 font-semibold text-netland-primary transition-all hover:bg-netland-primary hover:text-white sm:w-1/3"
                          >
                            <ArrowLeft className="h-5 w-5" /> 
                            Atrás
                          </button>
                          <button 
                            type="submit" 
                            disabled={submitting || !canSubmitReferral} 
                            className="group relative flex-1 overflow-hidden rounded-xl bg-netland-primary py-4 font-bold text-white shadow-xl transition-all hover:scale-105 hover:bg-emerald-600 disabled:opacity-60 disabled:hover:scale-100"
                          >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                              {submitting ? (
                                <>
                                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                  Enviando...
                                </>
                              ) : (
                                <>
                                  <Gift className="h-5 w-5" />
                                  Enviar recomendación
                                  <Sparkles className="h-5 w-5" />
                                </>
                              )}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA Final espectacular */}
      <section className="relative overflow-hidden bg-netland-primary py-20 text-white">
        <div className="absolute inset-0">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute h-1 w-1 rounded-full bg-white/30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `twinkle ${Math.random() * 3 + 2}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        <div className="container-netland relative z-10 text-center">
          <Reveal>
            <div className="mx-auto max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/20 px-6 py-2 backdrop-blur-sm">
                <Zap className="h-5 w-5 text-netland-accent" />
                <span className="font-bold uppercase tracking-wider">Empieza ahora</span>
              </div>
              <h2 className="font-display text-4xl font-black lg:text-5xl">
                ¿Listo para empezar a ganar?
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-xl text-white/90">
                Cada referido es una oportunidad. No esperes más.
              </p>
              <a
                href="#formulario"
                className="mt-10 inline-flex items-center gap-3 rounded-full bg-netland-accent px-10 py-5 text-lg font-bold text-white shadow-2xl transition-all duration-300 hover:scale-110 hover:bg-yellow-500"
              >
                <PartyPopper className="h-6 w-6" />
                Hacer mi primera recomendación
                <Sparkles className="h-6 w-6" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CSS para animaciones personalizadas */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Input({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  type = "text", 
  required = false,
  icon: Icon,
  validateType,
}: { 
  label: string; 
  value: string; 
  onChange: (value: string) => void; 
  placeholder: string; 
  type?: string; 
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  validateType?: "phone" | "name" | "email";
}) {
  const [touched, setTouched] = useState(false);
  const error = touched && validateType ? validateField(validateType, value) : null;

  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-netland-muted">
        {label}
      </span>
      <div className="relative">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-netland-muted">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <input 
          type={type} 
          value={value} 
          onChange={(event) => {
            let v = event.target.value;
            if (validateType === "phone") {
              const digits = v.replace(/\D/g, "");
              v = digits.slice(0, 9);
            }
            onChange(v);
          }} 
          onBlur={() => setTouched(true)}
          placeholder={placeholder} 
          required={required} 
          className={`w-full rounded-xl border-2 bg-white ${Icon ? 'pl-12' : 'px-4'} pr-4 py-3 text-sm outline-none transition-all focus:ring-2 ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
              : "border-netland-light focus:border-netland-primary focus:ring-netland-primary/20"
          }`}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </label>
  );
}

// Componente contador animado
function StatCounter({ 
  icon: Icon, 
  value, 
  label, 
  color,
  delay 
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  color: string;
  delay: number;
}) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Extraer el número del valor
  const numericValue = parseInt(value.replace(/\D/g, '')) || 0;
  const prefix = value.match(/^[^\d]+/)?.[0] || '';
  const suffix = value.match(/[^\d]+$/)?.[0] || '';

  useEffect(() => {
    if (hasAnimated) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasAnimated(true);
          const duration = 2000; // 2 segundos
          const steps = 60;
          const increment = numericValue / steps;
          let currentCount = 0;

          const timer = setInterval(() => {
            currentCount += increment;
            if (currentCount >= numericValue) {
              setCount(numericValue);
              clearInterval(timer);
            } else {
              setCount(Math.floor(currentCount));
            }
          }, duration / steps);

          return () => clearInterval(timer);
        }
      },
      { threshold: 0.5 }
    );

    const element = document.getElementById(`stat-${label}`);
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, [hasAnimated, numericValue, label]);

  return (
    <div
      id={`stat-${label}`}
      className="group rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/20"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Icon className={`mx-auto h-8 w-8 ${color} mb-3 transition-transform group-hover:scale-110`} />
      <p className="text-3xl font-black">
        {prefix}{count}{suffix}
      </p>
      <p className="mt-1 text-sm text-white/80">{label}</p>
    </div>
  );
}

