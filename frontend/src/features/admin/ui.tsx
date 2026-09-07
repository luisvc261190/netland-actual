import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg bg-white p-6 shadow-soft ${className}`}>{children}</div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-netland-dark">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-netland-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "outline" | "danger" | "whatsapp";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "inline-flex items-center justify-center gap-2 rounded-sm px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-60";
  const variants = {
    primary: "bg-netland-primary text-white hover:bg-netland-primaryDark",
    outline: "border border-netland-light text-netland-dark hover:border-netland-primary hover:text-netland-primary",
    danger: "bg-red-600 text-white hover:bg-red-700",
    whatsapp: "bg-[#25D366] text-white hover:opacity-90",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Badge({ children, color = "#16a34a" }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold uppercase tracking-wider"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  accent = "#0d7a44",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-netland-muted">
          {label}
        </p>
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${accent}15`, color: accent }}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-4xl font-semibold" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-netland-muted">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-netland-muted">{hint}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-sm border border-netland-light bg-netland-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-netland-primary";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} resize-y ${props.className ?? ""}`} />;
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow-soft">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-netland-light bg-netland-light/50">
            {headers.map((h) => (
              <th
                key={h}
                className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-netland-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-netland-light">{children}</tbody>
      </table>
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

type PageItem = number | "ellipsis-left" | "ellipsis-right";

function getPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: PageItem[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("ellipsis-left");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push("ellipsis-right");
  items.push(total);
  return items;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  unitLabel = "registros",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  unitLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-netland-muted">
        Mostrando{" "}
        <span className="font-semibold text-netland-dark">
          {total === 0 ? 0 : startIndex + 1}–{endIndex}
        </span>{" "}
        de <span className="font-semibold text-netland-dark">{total}</span> {unitLabel}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="!w-auto !px-2 !py-1.5 text-xs"
          aria-label="Registros por página"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} por página
            </option>
          ))}
        </Select>

        <Button
          variant="outline"
          className="!px-2.5 !py-1.5"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {getPageItems(currentPage, totalPages).map((item) =>
          typeof item === "number" ? (
            <button
              key={item}
              onClick={() => onPageChange(item)}
              aria-current={item === currentPage ? "page" : undefined}
              className={`h-8 min-w-8 rounded-sm px-2 text-sm font-semibold transition-colors ${
                item === currentPage
                  ? "bg-netland-primary text-white"
                  : "border border-netland-light bg-white text-netland-dark hover:border-netland-primary hover:text-netland-primary"
              }`}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="px-1 text-sm text-netland-muted">
              …
            </span>
          )
        )}

        <Button
          variant="outline"
          className="!px-2.5 !py-1.5"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}