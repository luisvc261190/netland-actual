import { useEffect } from "react";

export const SITE_NAME = "NETLAND Corporación Inmobiliaria";
export const SITE_DESCRIPTION =
  "Netland Corporación Inmobiliaria. El lugar donde mereces vivir. Proyectos inmobiliarios en Cañete con respaldo, confianza y oportunidades de crecimiento.";

export function siteOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function absolutize(url: string): string {
  if (/^(https?:)?\/\//i.test(url)) return url;
  return `${siteOrigin()}${url.startsWith("/") ? url : `/${url}`}`;
}

const JSONLD_ID = "netland-jsonld";

export interface SeoInput {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  jsonLd?: object | object[] | null;
}

function setMeta(name: string, content?: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setOg(property: string, content?: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href?: string) {
  let el = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  );
  if (href) {
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", "canonical");
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  }
}

function setJsonLdString(data: string | null) {
  document.querySelector(`script#${JSONLD_ID}`)?.remove();
  if (!data) return;
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = JSONLD_ID;
  script.textContent = data;
  document.head.appendChild(script);
}

/**
 * Aplica metadatos SEO por página (title, description, canonical, Open Graph y
 * JSON-LD) usando solo el DOM. Ideal para SPAs de cliente sin SSR.
 */
export function usePageMeta(input: SeoInput) {
  const { title, description, path, image } = input;
  const jsonLdString = input.jsonLd ? JSON.stringify(input.jsonLd) : null;

  useEffect(() => {
    const originalTitle = document.title;

    if (title) document.title = title;
    setMeta("description", description);

    const canonicalPath = path ?? window.location.pathname;
    const canonicalUrl = canonicalPath.includes("://")
      ? canonicalPath
      : absolutize(canonicalPath);

    setCanonical(canonicalUrl);
    setOg("og:url", canonicalUrl);
    if (title) setOg("og:title", title);
    if (description) setOg("og:description", description);
    if (image) setOg("og:image", absolutize(image));
    setOg("og:type", "website");
    setOg("og:site_name", SITE_NAME);
    setJsonLdString(jsonLdString);

    return () => {
      if (title) document.title = originalTitle;
      setJsonLdString(null);
    };
  }, [title, description, path, image, jsonLdString]);
}