import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, UserRound, X } from "lucide-react";
import type { ClientInfo } from "../../../types";

const MAX_RESULTS = 30;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function clientLabel(client: ClientInfo): string {
  return [client.name, client.last_name].filter(Boolean).join(" ").trim() || "Cliente";
}

interface ClientSelectProps {
  clients: ClientInfo[] | undefined;
  value: string;
  onChange: (client: ClientInfo | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ClientSelect({
  clients,
  value,
  onChange,
  disabled,
  placeholder = "Buscar por nombre, apellido, teléfono o correo...",
}: ClientSelectProps) {
  const selected = useMemo(
    () => clients?.find((c) => String(c.id) === String(value)) ?? null,
    [clients, value]
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);

  const filtered = useMemo(() => {
    const list = clients ?? [];
    const tokens = normalize(query)
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length === 0) return list.slice(0, MAX_RESULTS);
    return list
      .filter((c) => {
        const haystack = normalize(
          `${c.name} ${c.last_name} ${c.phone} ${c.whatsapp} ${c.email ?? ""}`
        );
        return tokens.every((t) => haystack.includes(t));
      })
      .slice(0, MAX_RESULTS);
  }, [clients, query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => setActiveIndex(0), [query]);

  const openDropdown = () => {
    if (disabled) return;
    setQuery("");
    setOpen(true);
    setActiveIndex(0);
  };

  const selectClient = (client: ClientInfo) => {
    onChange(client);
    setOpen(false);
    setActiveIndex(0);
  };

  const clearSelection = () => {
    onChange(null);
    setQuery("");
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openDropdown();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[activeIndex];
      if (open && option) selectClient(option);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleBlur = () => {
    blurTimer.current = window.setTimeout(() => setOpen(false), 120);
  };
  const handleFocus = () => {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    openDropdown();
  };

  return (
    <div ref={containerRef} className="relative">
      {disabled ? (
        <div className="flex w-full items-center gap-2 rounded-sm border border-netland-light bg-netland-background/60 px-3.5 py-2.5 text-sm text-netland-dark opacity-70">
          <UserRound className="h-4 w-4 text-netland-muted" />
          <span className="truncate">{selected ? clientLabel(selected) : "—"}</span>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-netland-muted" />
          <input
            ref={inputRef}
            type="text"
            value={open ? query : selected ? clientLabel(selected) : ""}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            readOnly={!!selected && !open}
            className="w-full rounded-sm border border-netland-light bg-netland-background py-2.5 pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-netland-muted focus:border-netland-primary"
          />
          {!selected && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-netland-muted">
              <ChevronDown className="h-4 w-4" />
            </span>
          )}
          {selected && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                clearSelection();
                setOpen(true);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-netland-muted transition-colors hover:text-netland-dark"
              aria-label="Quitar cliente"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {open && !disabled && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-netland-light bg-white py-1 shadow-xl">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-netland-muted">
              No se encontraron clientes para «{query}».
            </li>
          ) : (
            filtered.map((client, i) => (
              <li key={client.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectClient(client);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    i === activeIndex
                      ? "bg-netland-primary/10 text-netland-dark"
                      : "text-netland-dark hover:bg-netland-light/40"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <UserRound className="h-4 w-4 shrink-0 text-netland-primary" />
                    <span className="truncate font-medium">{clientLabel(client)}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-netland-muted">
                    {client.phone && <span className="block">{client.phone}</span>}
                    {client.email && <span className="block truncate max-w-48">{client.email}</span>}
                  </span>
                </button>
              </li>
            ))
          )}
          {filtered.length === MAX_RESULTS && (
            <li className="border-t border-netland-light px-4 py-2 text-xs text-netland-muted">
              Mostrando {MAX_RESULTS} resultados. Usa más filtros para refinar.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}