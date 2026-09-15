import { Reveal } from "../components/Reveal";
import { usePageMeta } from "../lib/seo";

const sections = [
  {
    id: "informacion-que-recopilamos",
    title: "1. Información que recopilamos",
    content: `Recopilamos información que usted nos proporciona directamente al interactuar con nuestro sitio web y servicios, incluyendo:

• Datos personales: nombre completo, número de DNI, correo electrónico, número de teléfono, dirección domiciliaria.
• Datos de contacto: información enviada a través de formularios de contacto, solicitudes de información o cotizaciones.
• Datos de navegación: dirección IP, tipo de navegador, páginas visitadas, tiempo de permanencia y其他 datos de análisis web.
• Datos de ubicación: información geográfica aproximada derivada de su dirección IP.`,
  },
  {
    id: "como-usamos-su-informacion",
    title: "2. Cómo utilizamos su información",
    content: `Utilizamos la información recopilada para:

• Responder a sus consultas, solicitudes de información y cotizaciones sobre nuestros proyectos inmobiliarios.
• Gestionar y dar seguimiento a prospectos de clientes y asesorías personalizadas.
• Enviar información sobre promociones, nuevos proyectos y servicios de Netland Corporación Inmobiliaria.
• Mejorar nuestro sitio web, servicios y experiencia del usuario.
• Cumplir con obligaciones legales y regulatorias aplicables.
• Generar estadísticas internas de análisis y marketing.`,
  },
  {
    id: "base-legal",
    title: "3. Base legal para el tratamiento",
    content: `El tratamiento de sus datos personales se fundamenta en:

• Consentimiento: cuando usted nos proporciona sus datos a través de formularios o solicitudes de contacto.
• Interés legítimo: para el envío de información comercial sobre nuestros productos y servicios inmobiliarios.
• Obligación legal: cuando exista una obligación jurídica de conservar o comunicar sus datos.`,
  },
  {
    id: "comparticion",
    title: "4. Compartición de información",
    content: `No vendemos ni alquilamos su información personal a terceros. Podemos compartir sus datos únicamente con:

• Asesores y colaboradores de Netland Corporación Inmobiliaria, para brindarle atención personalizada.
• Proveedores de servicios tecnológicos que apoyan la operación de nuestro sitio web (hosting, análisis de datos).
• Autoridades competentes, cuando sea requerido por la legislación vigente.`,
  },
  {
    id: "retencion",
    title: "5. Conservación de datos",
    content: `Sus datos personales serán conservados mientras sean necesarios para los fines para los que fueron recopilados, o durante el plazo que establezca la legislación aplicable. Transcurrido dicho plazo, sus datos serán eliminados o anonimizados de forma segura.`,
  },
  {
    id: "seguridad",
    title: "6. Seguridad de los datos",
    content: `Implementamos medidas técnicas y organizativas adecuadas para proteger sus datos personales contra accesos no autorizados, alteraciones, divulgaciones o destrucciones no autorizadas. Sin embargo, ningún método de transmisión por Internet o de almacenamiento electrónico es 100% seguro, por lo que no podemos garantizar seguridad absoluta.`,
  },
  {
    id: "derechos",
    title: "7. Sus derechos",
    content: `Usted tiene derecho a:

• Acceder a sus datos personales y conocer cómo son utilizados.
• Solicitar la rectificación de datos inexactos.
• Solicitar la eliminación de sus datos cuando ya no sean necesarios.
• Oponerse al tratamiento de sus datos para fines de marketing.
• Revocar su consentimiento en cualquier momento.

Para ejercer estos derechos, puede contactarnos a través de nuestros canales oficiales.`,
  },
  {
    id: "cookies",
    title: "8. Uso de cookies y tecnologías de rastreo",
    content: `Utilizamos cookies y tecnologías similares para mejorar su experiencia de navegación, analizar el tráfico del sitio y personalizar el contenido. Puede configurar su navegador para rechazar cookies, aunque esto podría afectar la funcionalidad del sitio.`,
  },
  {
    id: "menores",
    title: "9. Menores de edad",
    content: `Nuestros servicios no están dirigidos a menores de 18 años. No recopilamos intencionalmente información personal de menores. Si usted es padre o tutor y cree que su hijo nos ha proporcionado datos personales, contáctenos para que podamos eliminar dicha información.`,
  },
  {
    id: "cambios",
    title: "10. Cambios en esta política",
    content: `Nos reservamos el derecho de actualizar esta Política de Privacidad en cualquier momento. Cualquier cambio será publicado en esta página con la fecha de última actualización. Le recomendamos revisar periódicamente este documento.`,
  },
  {
    id: "contacto",
    title: "11. Contacto",
    content: `Si tiene preguntas o inquietudes sobre esta Política de Privacidad o sobre el tratamiento de sus datos personales, puede contactarnos a través de:

• WhatsApp: 985 928 062
• Correo electrónico: contacto@netland.com
• Ubicación: Cañete, Lima, Perú`,
  },
];

export default function PoliticaPrivacidad() {
  usePageMeta({
    title: "Política de Privacidad | NETLAND Corporación Inmobiliaria",
    description:
      "Conoce cómo Netland Corporación Inmobiliaria protege y trata tus datos personales conforme a la legislación peruana.",
    path: "/politica-de-privacidad",
  });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-netland-primary via-green-700 to-emerald-900 pb-16 pt-36 text-white">
        <div className="absolute inset-0 opacity-10">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-priv" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-priv)" />
          </svg>
        </div>

        <div className="absolute -right-20 top-20 h-72 w-72 rounded-full bg-netland-accent/20 blur-3xl animate-pulse" />
        <div className="absolute -left-20 bottom-10 h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

        <div className="container-netland relative z-10">
          <Reveal>
            <p className="eyebrow justify-start !text-white/95">Legal</p>
            <h1 className="max-w-3xl text-balance font-display text-5xl font-bold leading-tight drop-shadow-xl sm:text-6xl">
              Política de <span className="text-netland-accent">Privacidad</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/95">
              Conozca cómo Netland Corporación Inmobiliaria protege y utiliza su información personal.
            </p>
          </Reveal>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="h-20 w-full">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 80C1200 80 1320 70 1380 65L1440 60V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Contenido */}
      <section className="section-padding bg-white">
        <div className="container-netland max-w-4xl">
          <Reveal>
            <div className="mb-10 rounded-xl border border-netland-light bg-netland-background p-6">
              <p className="text-sm leading-relaxed text-netland-muted">
                <strong className="text-netland-dark">Última actualización:</strong> {new Date().toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" })}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-netland-muted">
                La presente Política de Privacidad describe cómo <strong className="text-netland-dark">Netland Corporación Inmobiliaria</strong> ("la Empresa"), con ubicación en Cañete, Lima, Perú, recopila, utiliza, almacena y protege la información personal de los usuarios que interactúan con nuestro sitio web y servicios.
              </p>
            </div>
          </Reveal>

          <div className="space-y-12">
            {sections.map((section, index) => (
              <Reveal key={section.id} delay={index * 60}>
                <div>
                  <h2 className="mb-4 font-display text-2xl font-bold text-netland-dark">
                    {section.title}
                  </h2>
                  <div className="whitespace-pre-line text-base leading-relaxed text-netland-muted">
                    {section.content}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
