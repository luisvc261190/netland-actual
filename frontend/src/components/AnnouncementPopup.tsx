import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { whatsappLink } from "../lib/constants";
import type { Announcement } from "../types";

const SEEN_PREFIX = "netland_announcement_seen_";

const hasBeenSeen = (announcement: Announcement): boolean =>
  announcement.once_per_session &&
  sessionStorage.getItem(`${SEEN_PREFIX}${announcement.id}`) === "1";

const markSeen = (announcement: Announcement): void => {
  if (announcement.once_per_session) {
    sessionStorage.setItem(`${SEEN_PREFIX}${announcement.id}`, "1");
  }
};

type IconComponent = ComponentType<{ className?: string }>;

const KIND_STYLES: Record<
  Announcement["kind"],
  { label: string; icon: IconComponent }
> = {
  announcement: { label: "Anuncio", icon: Megaphone },
  promotion: { label: "Promoción", icon: BadgePercent },
};

function getKind(announcement: Announcement): Announcement["kind"] {
  return announcement.kind === "promotion" ? "promotion" : "announcement";
}

function AnnouncementMedia({
  announcement,
  className,
  onResolution,
}: {
  announcement: Announcement;
  className?: string;
  onResolution: (width: number, height: number) => void;
}) {
  const isVideo =
    announcement.media_type === "video" ||
    /\.(mp4|webm|ogg|mov|m4v)([?#]|$)/i.test(announcement.image_url || "");

  if (isVideo) {
    return (
      <video
        src={announcement.image_url}
        controls
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          const el = event.currentTarget;
          if (el.videoWidth > 0 && el.videoHeight > 0) {
            onResolution(el.videoWidth, el.videoHeight);
          }
        }}
        className={`${className} object-contain`}
      />
    );
  }

  return (
    <img
      src={announcement.image_url}
      alt={announcement.title || "Anuncio Netland"}
      loading="lazy"
      onLoad={(event) => {
        const el = event.currentTarget;
        if (el.naturalWidth > 0 && el.naturalHeight > 0) {
          onResolution(el.naturalWidth, el.naturalHeight);
        }
      }}
      className={`${className} object-cover`}
    />
  );
}

function CarouselControls({
  count,
  index,
  onChange,
}: {
  count: number;
  index: number;
  onChange: (index: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={() => onChange(index === 0 ? count - 1 : index - 1)}
        aria-label="Anuncio anterior"
        className="p-1 text-netland-muted transition-colors hover:text-netland-primary"
      >
        <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
      </button>
      <div className="flex items-center gap-2 sm:gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            aria-label={`Ir al anuncio ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === index
                ? "w-6 bg-netland-accent sm:w-5"
                : "w-2 bg-netland-light hover:bg-netland-muted/40 sm:bg-netland-muted/25 sm:hover:bg-netland-muted/60"
            }`}
          />
        ))}
      </div>
      <button
        onClick={() => onChange((index + 1) % count)}
        aria-label="Anuncio siguiente"
        className="p-1 text-netland-muted transition-colors hover:text-netland-primary"
      >
        <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
      </button>
    </div>
  );
}

function KindBadge({ kind }: { kind: Announcement["kind"] }) {
  const style = KIND_STYLES[kind];
  return (
    <div className="absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
      <div className="relative">
        <span
          className="absolute -inset-1.5 animate-ping rounded-xl bg-red-500/40 sm:hidden"
          aria-hidden="true"
        />
        <span className="relative inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-white shadow-lg sm:gap-1 sm:rounded-full sm:bg-red-600/90 sm:px-2.5 sm:py-1 sm:shadow-md sm:backdrop-blur-md">
          <style.icon className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
          <span className="text-xs font-black uppercase tracking-[0.08em] sm:text-[10px] sm:font-bold sm:tracking-[0.1em]">
            {style.label}
          </span>
        </span>
      </div>
    </div>
  );
}

export function AnnouncementPopup() {
  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements-active"],
    queryFn: () => api.get<Announcement[]>("/announcements/active"),
    staleTime: 5 * 60 * 1000,
  });

  const pending = announcements.filter(
    (announcement) => !hasBeenSeen(announcement)
  );
  const current = pending.length > 0 ? pending[0] : undefined;
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [resolution, setResolution] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (pending.length === 0) {
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setIndex(0);
      setOpen(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [pending.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (current) markSeen(current);
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, current]);

  useEffect(() => {
    if (!open || pending.length <= 1) return;
    const active = pending[index % pending.length];
    const isVideo =
      active.media_type === "video" ||
      /\.(mp4|webm|ogg|mov|m4v)([?#]|$)/i.test(active.image_url || "");
    const timer = window.setTimeout(
      () => setIndex((current) => (current + 1) % pending.length),
      isVideo ? 20_000 : 6_000
    );
    return () => window.clearTimeout(timer);
  }, [open, index, pending.length]);

  if (!open || pending.length === 0) return null;

  const active = pending[index % pending.length];
  const multiple = pending.length > 1;
  const kind = getKind(active);
  const isPortrait =
    resolution !== null && resolution.width < resolution.height;
  const panelWidth = !resolution
    ? "max-w-md"
    : isPortrait
      ? "max-w-xs sm:max-w-sm"
      : "max-w-2xl";

  const close = (): void => {
    markSeen(active);
    setOpen(false);
  };

  const hasContent = Boolean(
    active.title || active.description || active.button_phone
  );

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fadeIn sm:bg-black/50 sm:p-6 sm:backdrop-blur-md"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={active.title}
    >
      <div
        className={`relative w-full ${panelWidth} max-h-[92vh] animate-popIn overflow-hidden rounded-3xl bg-white shadow-2xl transition-all duration-300 sm:rounded-2xl sm:shadow-xl sm:ring-1 sm:ring-black/5`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative">
          {active.image_url ? (
            <div
              className={`relative max-h-[70vh] w-full overflow-hidden bg-netland-dark sm:max-h-[60vh] ${
                resolution ? "" : "aspect-video"
              }`}
              style={
                resolution
                  ? { aspectRatio: `${resolution.width} / ${resolution.height}` }
                  : undefined
              }
            >
              <AnnouncementMedia
                key={active.id}
                announcement={active}
                onResolution={(width, height) =>
                  setResolution({ width, height })
                }
                className="absolute inset-0 h-full w-full"
              />
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-netland-primary to-netland-primaryDark">
              <Megaphone className="h-10 w-10 text-white/80" />
            </div>
          )}

          <KindBadge kind={kind} />

          <button
            onClick={close}
            aria-label="Cerrar"
            className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-netland-dark shadow-md transition-colors hover:bg-white sm:right-4 sm:top-4 sm:bg-white/70 sm:p-1.5 sm:shadow-none sm:backdrop-blur-sm sm:hover:bg-white/90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {hasContent ? (
          <div className="p-5 sm:p-6">
            {active.title && (
              <h3 className="font-display text-xl font-bold text-netland-dark sm:text-2xl">
                {active.title}
              </h3>
            )}

            {active.description && (
              <p className="mt-2 text-sm leading-relaxed text-netland-muted sm:max-h-24 sm:overflow-y-auto">
                {active.description}
              </p>
            )}

            {active.button_phone && (
              <div className="mt-5">
                <a
                  href={whatsappLink(
                    `Hola, estoy interesado en "${active.title}" de Netland.`,
                    active.button_phone
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                  className="btn-accent flex w-full"
                >
                  Solicito información
                </a>
              </div>
            )}

            {multiple && (
              <div className="mt-5">
                <CarouselControls
                  count={pending.length}
                  index={index}
                  onChange={setIndex}
                />
              </div>
            )}
          </div>
        ) : (
          multiple && (
            <div className="p-5">
              <CarouselControls
                count={pending.length}
                index={index}
                onChange={setIndex}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}