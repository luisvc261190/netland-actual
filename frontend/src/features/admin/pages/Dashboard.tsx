import { useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  FileSignature,
  FileText,
  HandCoins,
  MessageSquare,
  Milestone,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../lib/api";
import type {
  Advisor,
  DashboardActivityItem,
  DashboardAdvisorRow,
  DashboardClientsTrendPoint,
  DashboardFunnel,
  DashboardProjectPerformance,
  DashboardSourceDatum,
  DashboardSummary,
  DashboardTrendPoint,
  Project,
} from "../../../types";
import { CAPTURED_SOURCE_COLORS, formatSoles, LOT_STATUS_COLORS, LOT_STATUS_LABELS } from "../../../lib/constants";
import { PageHeader, Select } from "../ui";
import { useAuth } from "../AuthContext";

const CHART_GREEN = "#0d7a44";
const CHART_GREEN_LIGHT = "#22c55e";
const CHART_GOLD = "#f5a623";
const CHART_RED = "#dc2626";
const CHART_BLUE = "#2563eb";
const CHART_PURPLE = "#7c3aed";
const CHART_TEAL = "#0891b2";

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "quarter", label: "Últimos 3 meses" },
  { value: "year", label: "Este año" },
  { value: "all", label: "Todo" },
];

const RANGE_OPTIONS = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "6m", label: "6 meses" },
  { value: "12m", label: "12 meses" },
  { value: "ytd", label: "Año actual" },
];

const RANGE_MONTHS = [
  { value: "30d", label: "30 días" },
  { value: "6m", label: "6 meses" },
  { value: "12m", label: "12 meses" },
];

const RANGE_SOURCES = [
  { value: "", label: "Todo" },
  { value: "30d", label: "30 días" },
  { value: "6m", label: "6 meses" },
  { value: "12m", label: "12 meses" },
];

const ADVISOR_RANK_PERIODS = [
  { value: "month", label: "Este mes" },
  { value: "quarter", label: "Últimos 3 meses" },
  { value: "year", label: "Este año" },
];

const SOURCE_LABELS: Record<string, string> = {
  web: "Página web",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  google: "Google",
  referido: "Referidos",
  campo: "Campo",
  llamada: "Llamada",
  visita: "Visita presencial",
  otro: "Otros",
};

const SOURCE_COLOR_PALETTE = [
  CHART_GREEN,
  CHART_GOLD,
  CHART_BLUE,
  CHART_PURPLE,
  CHART_TEAL,
  CHART_RED,
  CHART_GREEN_LIGHT,
  "#ea580c",
  "#db2777",
  "#64748b",
];

const FUNNEL_COLORS = [
  CHART_GREEN,
  "#13965d",
  "#18b574",
  CHART_GREEN_LIGHT,
  CHART_GOLD,
  "#f0b95a",
  CHART_RED,
];

const buildParams = (params: Record<string, string>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) q.set(key, value);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

const fmtInt = (value?: number | null) =>
  (value ?? 0).toLocaleString("es-PE");

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-sm bg-netland-light ${className}`} />
);

function StateMessage({
  type,
  onRetry,
}: {
  type: "error" | "empty";
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <AlertTriangle className={`h-8 w-8 ${type === "error" ? "text-red-500" : "text-netland-muted"}`} />
      <p className="max-w-xs text-sm text-netland-muted">
        {type === "error"
          ? "No pudimos cargar la información. Intenta nuevamente."
          : "No hay información disponible para este período."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-sm border border-netland-light px-4 py-2 text-sm font-semibold text-netland-dark transition-colors hover:border-netland-primary hover:text-netland-primary"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      )}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  loading,
  error,
  empty,
  onRetry,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  loading: boolean;
  error: boolean;
  empty?: boolean;
  onRetry?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg bg-white p-5 shadow-soft sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-netland-dark">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-netland-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : error ? (
        <StateMessage type="error" onRetry={onRetry} />
      ) : empty ? (
        <StateMessage type="empty" />
      ) : (
        children
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent = CHART_GREEN,
  hint,
  delta,
  deltaLabel,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: string;
  hint?: string;
  delta?: number | null;
  deltaLabel?: string;
}) {
  const isUp = delta !== undefined && delta !== null && delta >= 0;
  return (
    <div
      className="rounded-lg border border-netland-light bg-white p-5 shadow-soft"
      title={hint}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-netland-muted">
          {label}
        </p>
        {icon && (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${accent}15`, color: accent }}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-2xl font-semibold text-netland-dark">{value}</p>
      {delta !== undefined && isUp !== undefined && (
        <p
          className="mt-1.5 flex items-center gap-1 text-xs font-medium"
          style={{ color: delta === null ? CHART_GOLD : isUp ? CHART_GREEN : CHART_RED }}
        >
          {delta === null ? (
            <span className="text-netland-muted">nuevo en este período</span>
          ) : (
            <>
              {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {fmtInt(Math.abs(delta))}% {deltaLabel ?? "vs período anterior"}
            </>
          )}
        </p>
      )}
    </div>
  );
}

const moneyTooltipFields = ["sold_amount", "collected_amount", "due_amount", "amount", "scheduled_amount"];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-netland-light bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-netland-dark">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey ?? entry.name} className="text-xs leading-5 text-netland-muted">
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
            style={{ backgroundColor: entry.color ?? entry.fill ?? entry.stroke ?? CHART_GREEN }}
          />
          {entry.name}:{" "}
          <span className="font-semibold text-netland-dark">
            {moneyTooltipFields.includes(entry.dataKey)
              ? formatSoles(Number(entry.value))
              : fmtInt(entry.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

function KpiSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-bold uppercase tracking-wide text-netland-muted">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function FunnelChart({ stages, conversions }: { stages: DashboardFunnel["stages"]; conversions: DashboardFunnel["conversions"] }) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div>
      <div className="space-y-3">
        {stages.map((stage, i) => {
          const width = stage.count === 0 ? 4 : Math.max(10, (stage.count / max) * 100);
          return (
            <div key={stage.stage}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-netland-dark">{stage.stage}</span>
                <span className="font-semibold text-netland-muted">{fmtInt(stage.count)}</span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-sm bg-netland-light">
                <div
                  className="h-full rounded-sm transition-all"
                  style={{ width: `${width}%`, backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {conversions.length > 0 && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {conversions.map((c) => (
            <div key={`${c.from}-${c.to}`} className="rounded-sm bg-netland-background px-3 py-2 text-xs">
              <span className="text-netland-muted">
                {c.from} → {c.to}:
              </span>{" "}
              <span className="font-bold text-netland-dark">{c.rate == null ? "—" : `${c.rate}%`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LotsLegend({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  return (
    <ul className="space-y-2">
      {data.map((item) => (
        <li key={item.name} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-netland-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
          <span className="font-semibold text-netland-dark">
            {fmtInt(item.value)}
            {total > 0 ? (
              <span className="ml-1.5 text-xs font-normal text-netland-muted">
                ({Math.round((item.value / total) * 100)}%)
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

const ACTIVITY_META: Record<string, { label: string; color: string; icon: ComponentType<{ className?: string }> }> = {
  lead: { label: "Lead", color: CHART_BLUE, icon: MessageSquare },
  client: { label: "Cliente", color: CHART_BLUE, icon: UserPlus },
  quote: { label: "Cotización", color: CHART_GREEN, icon: FileText },
  contract: { label: "Contrato", color: CHART_TEAL, icon: FileSignature },
  sale: { label: "Venta", color: CHART_GREEN, icon: BadgeCheck },
  payment: { label: "Pago", color: CHART_GOLD, icon: HandCoins },
  visit: { label: "Visita", color: CHART_PURPLE, icon: CalendarDays },
  lot: { label: "Lote", color: CHART_RED, icon: Milestone },
  owner: { label: "Propietario", color: "#0ea5e9", icon: Users },
  user: { label: "Usuario", color: "#6b7280", icon: Users },
};

const ACTION_LABELS: Record<string, string> = {
  create: "Nuevo",
  created: "Nuevo",
  update: "Actualizado",
  updated: "Actualizado",
  delete: "Eliminado",
  deleted: "Eliminado",
  status: "Cambio de estado",
  status_change: "Cambio de estado",
};

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return "—";
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} día${days > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? "es" : ""}`;
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function scoreColors(position: number) {
  if (position === 1) return { bg: "#fef3c7", text: "#b45309", ring: "ring-amber-200" };
  if (position === 2) return { bg: "#f1f5f9", text: "#475569", ring: "ring-slate-200" };
  if (position === 3) return { bg: "#ffedd5", text: "#c2410c", ring: "ring-orange-200" };
  return { bg: "#f1f5f3", text: "#64736e", ring: "ring-netland-light" };
}

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdvisorOnly = user?.role?.toUpperCase() === "ASESOR";

  const [period, setPeriod] = useState("month");
  const [projectId, setProjectId] = useState("");
  const [advisorId, setAdvisorId] = useState("");
  const [rangeTrend, setRangeTrend] = useState("30d");
  const [rangeCobranza, setRangeCobranza] = useState("12m");
  const [rangeClients, setRangeClients] = useState("6m");
  const [rangeSources, setRangeSources] = useState("");
  const [rankPeriod, setRankPeriod] = useState("month");
  const [salesMetric, setSalesMetric] = useState<"ventas" | "ingresos">("ventas");
  const [refreshing, setRefreshing] = useState(false);

  const summaryParams = buildParams({ period, project_id: projectId, advisor_id: isAdvisorOnly ? "" : advisorId });
  const trendParams = buildParams({ range: rangeTrend, project_id: projectId, advisor_id: isAdvisorOnly ? "" : advisorId });
  const cobranzaParams = buildParams({ range: rangeCobranza, project_id: projectId, advisor_id: isAdvisorOnly ? "" : advisorId });
  const clientsParams = buildParams({ range: rangeClients, project_id: projectId, advisor_id: isAdvisorOnly ? "" : advisorId });
  const sourcesParams = buildParams({ range: rangeSources, project_id: projectId, advisor_id: isAdvisorOnly ? "" : advisorId });
  const advisorsParams = buildParams({ period: rankPeriod, project_id: projectId });

  type SummaryQuery = { data?: DashboardSummary; isLoading: boolean; isError: boolean; refetch: () => void };
  const summary = useQuery({
    queryKey: ["dashboard", "summary", period, projectId, advisorId],
    queryFn: () => api.get<DashboardSummary>(`/dashboard/summary${summaryParams}`, true),
  }) as SummaryQuery;
  const trend = useQuery({
    queryKey: ["dashboard", "trend", rangeTrend, projectId, advisorId],
    queryFn: () => api.get<DashboardTrendPoint[]>(`/dashboard/trend${trendParams}`, true),
  });
  const cobranzaTrend = useQuery({
    queryKey: ["dashboard", "trend", rangeCobranza, projectId, advisorId],
    queryFn: () => api.get<DashboardTrendPoint[]>(`/dashboard/trend${cobranzaParams}`, true),
  });
  const projects = useQuery({
    queryKey: ["dashboard", "projects"],
    queryFn: () => api.get<DashboardProjectPerformance[]>("/dashboard/projects", true),
  });
  const advisors = useQuery({
    queryKey: ["dashboard", "advisors", rankPeriod, projectId],
    queryFn: () => api.get<DashboardAdvisorRow[]>(`/dashboard/advisors${advisorsParams}`, true),
  });
  const funnel = useQuery({
    queryKey: ["dashboard", "funnel", projectId, advisorId],
    queryFn: () => api.get<DashboardFunnel>(`/dashboard/funnel${buildParams({ project_id: projectId, advisor_id: isAdvisorOnly ? "" : advisorId })}`, true),
  });
  const sources = useQuery({
    queryKey: ["dashboard", "sources", rangeSources, projectId, advisorId],
    queryFn: () => api.get<{ total: number; items: DashboardSourceDatum[] }>(`/dashboard/leads-by-source${sourcesParams}`, true),
  });
  const clientsTrend = useQuery({
    queryKey: ["dashboard", "clients-trend", rangeClients, projectId, advisorId],
    queryFn: () => api.get<DashboardClientsTrendPoint[]>(`/dashboard/clients-trend${clientsParams}`, true),
  });
  const activity = useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: () => api.get<DashboardActivityItem[]>("/dashboard/activity?limit=15", true),
  });
  const projectsFilter = useQuery({
    queryKey: ["projects-admin"],
    queryFn: () => api.get<Project[]>("/projects"),
  });
  const advisorsFilter = useQuery({
    queryKey: ["advisors"],
    queryFn: () => api.get<Advisor[]>("/advisors"),
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "dashboard" });
      await queryClient.invalidateQueries({ queryKey: ["projects-admin"] });
    } finally {
      setRefreshing(false);
    }
  };

  const lotsData = useMemo(() => {
    const lots = summary.data?.lots;
    if (!lots) return [];
    return (
      [
        { status: "available", count: lots.available },
        { status: "reserved", count: lots.reserved },
        { status: "sold", count: lots.sold },
        { status: "not_available", count: lots.not_available },
      ]
        .filter((item) => item.count > 0)
        .map((item) => ({
          name: LOT_STATUS_LABELS[item.status] ?? item.status,
          value: item.count,
          color: LOT_STATUS_COLORS[item.status] ?? "#9ca3af",
        }))
    );
  }, [summary.data]);

  const sourceData = useMemo(() => {
    const items = sources.data?.items ?? [];
    if (!items.length) return [];
    return items.map((item, index) => ({
      name: SOURCE_LABELS[item.source] ?? capitalize(item.source),
      value: item.count,
      pct: item.pct ?? 0,
      color:
        CAPTURED_SOURCE_COLORS[item.source] ??
        SOURCE_COLOR_PALETTE[index % SOURCE_COLOR_PALETTE.length],
    }));
  }, [sources.data]);

  const s = summary.data;
  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "período";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={
          isAdvisorOnly
            ? "Resumen de tu actividad: tus clientes, ventas y gestiones."
            : "Centro de control de Netland: ventas, ingresos, proyectos y cobranza."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="!w-auto !px-3 !py-2 text-sm" aria-label="Período">
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="!w-auto !px-3 !py-2 text-sm" aria-label="Proyecto">
              <option value="">Todos los proyectos</option>
              {(projectsFilter.data ?? []).map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </Select>
            {!isAdvisorOnly && (
              <Select value={advisorId} onChange={(e) => setAdvisorId(e.target.value)} className="!w-auto !px-3 !py-2 text-sm" aria-label="Asesor">
                <option value="">Todos los asesores</option>
                {(advisorsFilter.data ?? []).map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
            <button
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-sm border border-netland-light bg-white px-3 py-2 text-sm font-semibold text-netland-dark transition-colors hover:border-netland-primary hover:text-netland-primary disabled:opacity-60"
              title="Actualizar datos"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        }
      />

      {/* ===================== INDICADORES PRINCIPALES ===================== */}
      {summary.isLoading ? (
        <div className="space-y-6">
          {[0, 1, 2].map((row) => (
            <div key={row} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ))}
        </div>
      ) : summary.isError || !s ? (
        <div className="rounded-lg bg-white p-6 shadow-soft">
          <StateMessage type="error" onRetry={refresh} />
        </div>
      ) : (
        <div className="space-y-6">
          <KpiSection title="Ventas" icon={<TrendingUp className="h-4 w-4 text-netland-primary" />}>
            <KpiCard label="Ventas totales" value={fmtInt(s.sales.total)} icon={<BadgeCheck className="h-4 w-4" />} accent={CHART_GREEN} hint="Contratos de compra-venta registrados" />
            <KpiCard label={`Ventas · ${periodLabel}`} value={fmtInt(s.sales.current)} icon={<TrendingUp className="h-4 w-4" />} accent={CHART_BLUE} delta={s.sales.growth_pct} hint={`Ventas en el período (${periodLabel}), comparadas con el período anterior`} />
            <KpiCard label="Ventas del año" value={fmtInt(s.sales.year)} icon={<CalendarDays className="h-4 w-4" />} accent={CHART_GOLD} hint="Contratos registrados en el año calendario actual" />
            <KpiCard label="Asesores" value={fmtInt(advisorsFilter.data?.length)} icon={<Users className="h-4 w-4" />} accent={CHART_PURPLE} hint="Asesores registrados en el sistema" />
          </KpiSection>
          {!isAdvisorOnly && (
            <KpiSection title="Ingresos" icon={<Wallet className="h-4 w-4 text-netland-primary" />}>
              <KpiCard label="Monto vendido" value={formatSoles(s.revenue.sold_total)} icon={<DollarSign className="h-4 w-4" />} accent={CHART_GREEN} hint="Suma de precios totales de contratos (ventas)" />
              <KpiCard label="Monto cobrado" value={formatSoles(s.revenue.collected_total)} icon={<HandCoins className="h-4 w-4" />} accent={CHART_GOLD} hint="Total cobrado por pagos registrados" />
              <KpiCard label="Monto pendiente" value={formatSoles(s.revenue.pending_total)} icon={<Clock className="h-4 w-4" />} accent={CHART_BLUE} hint="Saldo por cobrar en contratos activos (financiamiento + contado)" />
              <KpiCard label="Pagos del mes" value={formatSoles(s.revenue.payments_month)} icon={<CalendarDays className="h-4 w-4" />} accent={CHART_TEAL} hint="Cobrado en el mes calendario actual" />
            </KpiSection>
          )}
          <KpiSection title="Clientes" icon={<Users className="h-4 w-4 text-netland-primary" />}>
            <KpiCard label="Clientes totales" value={fmtInt(s.clients.total)} icon={<Users className="h-4 w-4" />} accent={CHART_BLUE} hint="Clientes vinculados a leads" />
            <KpiCard label={`Clientes nuevos · ${periodLabel}`} value={fmtInt(s.clients.new_current)} icon={<UserPlus className="h-4 w-4" />} accent={CHART_GREEN} hint="Clientes nuevos en el período seleccionado" />
            <KpiCard label={`Leads nuevos · ${periodLabel}`} value={fmtInt(s.clients.leads_new_current)} icon={<MessageSquare className="h-4 w-4" />} accent={CHART_GOLD} hint="Nuevos leads captados en el período" />
            <KpiCard label={`Cotizaciones · ${periodLabel}`} value={fmtInt(s.clients.quotes_current)} icon={<FileText className="h-4 w-4" />} accent={CHART_PURPLE} hint="Cotizaciones generadas en el período" />
          </KpiSection>
          <KpiSection title="Lotes" icon={<Milestone className="h-4 w-4 text-netland-primary" />}>
            <KpiCard label="Lotes totales" value={fmtInt(s.lots.total)} icon={<Milestone className="h-4 w-4" />} accent="#64736e" hint="Total de lotes (con el filtro de proyecto aplicado)" />
            <KpiCard label="Disponibles" value={fmtInt(s.lots.available)} icon={<Milestone className="h-4 w-4" />} accent="#16a34a" hint="Lotes en estado DISPONIBLE" />
            <KpiCard label="Reservados" value={fmtInt(s.lots.reserved)} icon={<Milestone className="h-4 w-4" />} accent="#eab308" hint="Lotes en estado RESERVADO" />
            <KpiCard label="Vendidos" value={fmtInt(s.lots.sold)} icon={<Milestone className="h-4 w-4" />} accent="#dc2626" hint="Lotes en estado VENDIDO" />
          </KpiSection>
          <KpiSection title="Cotizaciones" icon={<FileText className="h-4 w-4 text-netland-primary" />}>
            <KpiCard label="Cotizaciones totales" value={fmtInt(s.quotes.total)} icon={<FileText className="h-4 w-4" />} accent={CHART_GREEN} hint="Total de cotizaciones generadas" />
            <KpiCard label="Pendientes" value={fmtInt(s.quotes.pending)} icon={<Clock className="h-4 w-4" />} accent={CHART_GOLD} hint="Cotizaciones en borrador o enviadas" />
            <KpiCard label="Aceptadas" value={fmtInt(s.quotes.accepted)} icon={<CheckCircle2 className="h-4 w-4" />} accent={CHART_TEAL} hint="Cotizaciones aceptadas por el cliente" />
            <KpiCard label="Conversión a venta" value={s.quotes.conversion_to_sale == null ? "—" : `${fmtInt(s.quotes.conversion_to_sale)}%`} icon={<Target className="h-4 w-4" />} accent={CHART_PURPLE} hint="Contratos registrados / cotizaciones generadas" />
          </KpiSection>
        </div>
      )}

      {/* ===================== EVOLUCIÓN DE VENTAS ===================== */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Evolución de ventas"
          subtitle={salesMetric === "ventas" ? "Cantidad de ventas y monto vendido" : "Monto vendido vs. cobrado"}
          loading={trend.isLoading}
          error={trend.isError}
          onRetry={() => trend.refetch()}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-sm border border-netland-light">
                <button
                  onClick={() => setSalesMetric("ventas")}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${salesMetric === "ventas" ? "bg-netland-primary text-white" : "text-netland-muted hover:text-netland-dark"}`}
                >
                  Ventas
                </button>
                <button
                  onClick={() => setSalesMetric("ingresos")}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${salesMetric === "ingresos" ? "bg-netland-primary text-white" : "text-netland-muted hover:text-netland-dark"}`}
                >
                  Ingresos
                </button>
              </div>
              <Select value={rangeTrend} onChange={(e) => setRangeTrend(e.target.value)} className="!w-auto !px-2 !py-1.5 text-xs" aria-label="Rango">
                {RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          }
        >
          {!trend.data?.length ? (
            <StateMessage type="empty" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend.data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64736e" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64736e" }} tickLine={false} axisLine={false} width={45} />
                  <Tooltip content={<ChartTooltip />} />
                  {salesMetric === "ventas" ? (
                    <>
                      <Bar dataKey="sales_count" name="Ventas" fill={CHART_GOLD} radius={[4, 4, 0, 0]} maxBarSize={22} />
                      <Area type="monotone" dataKey="sold_amount" name="Monto vendido" stroke={CHART_GREEN} strokeWidth={2} fill={CHART_GREEN} fillOpacity={0.12} />
                    </>
                  ) : (
                    <>
                      <Area type="monotone" dataKey="sold_amount" name="Monto vendido" stroke={CHART_GREEN} strokeWidth={2} fill={CHART_GREEN} fillOpacity={0.15} />
                      <Line type="monotone" dataKey="collected_amount" name="Monto cobrado" stroke={CHART_GOLD} strokeWidth={2} dot={false} />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel
          title="Ventas vs. Cobranza"
          subtitle="Monto vendido, cobrado y pendiente por período"
          loading={cobranzaTrend.isLoading}
          error={cobranzaTrend.isError}
          onRetry={() => cobranzaTrend.refetch()}
          action={
            <Select value={rangeCobranza} onChange={(e) => setRangeCobranza(e.target.value)} className="!w-auto !px-2 !py-1.5 text-xs" aria-label="Rango">
              {RANGE_MONTHS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          }
        >
          {!cobranzaTrend.data?.length ? (
            <StateMessage type="empty" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cobranzaTrend.data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barGap={2} barCategoryGap="18%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64736e" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64736e" }} tickLine={false} axisLine={false} width={45} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="sold_amount" name="Monto vendido" fill={CHART_GREEN} radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="collected_amount" name="Monto cobrado" fill={CHART_GOLD} radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="due_amount" name="Monto pendiente" fill="#ef4444" fillOpacity={0.75} radius={[3, 3, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      {/* ===================== PROYECTOS Y ESTADO DE LOTES ===================== */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Rendimiento de proyectos"
          subtitle="Ocupación de lotes y monto vendido por proyecto"
          loading={projects.isLoading}
          error={projects.isError}
          onRetry={() => projects.refetch()}
        >
          {!projects.data?.length ? (
            <StateMessage type="empty" />
          ) : (
            <div className="space-y-5">
              {projects.data.map((project) => {
                const pct = Math.min(100, project.occupancy_pct);
                return (
                  <div key={project.project_id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="text-sm font-semibold text-netland-dark">{project.name}</h4>
                      <span className="text-sm font-bold text-netland-primary">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-3 w-full overflow-hidden rounded-sm bg-netland-light">
                      <div
                        className="h-full rounded-sm transition-all"
                        style={{ width: `${pct}%`, backgroundColor: pct >= 60 ? CHART_GREEN : pct >= 30 ? CHART_GOLD : CHART_RED }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-netland-muted">
                      <span>
                        <b className="text-netland-dark">{fmtInt(project.lots_total)}</b> lotes
                      </span>
                      <span className="font-medium" style={{ color: "#16a34a" }}>
                        {fmtInt(project.available)} disp.
                      </span>
                      <span className="font-medium" style={{ color: "#ca8a04" }}>
                        {fmtInt(project.reserved)} res.
                      </span>
                      <span className="font-medium" style={{ color: CHART_RED }}>
                        {fmtInt(project.sold)} vend.
                      </span>
                      <span className="font-medium text-netland-dark">{formatSoles(project.sold_amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="Estado de lotes"
          subtitle="Distribución global del inventario"
          loading={summary.isLoading}
          error={summary.isError}
          onRetry={refresh}
          action={
            <Link to="/admin/lotes" className="text-xs font-semibold text-netland-primary hover:underline">
              Ver lotes →
            </Link>
          }
        >
          {!lotsData.length ? (
            <StateMessage type="empty" />
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
              <div className="h-56 w-full max-w-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={lotsData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} stroke="none">
                      {lotsData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full max-w-[240px]">
                <LotsLegend data={lotsData} />
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ===================== RANKING DE ASESORES Y EMBUDO ===================== */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Ranking de asesores"
          subtitle="Desempeño comercial por asesor"
          loading={advisors.isLoading}
          error={advisors.isError}
          onRetry={() => advisors.refetch()}
          action={
            <Select value={rankPeriod} onChange={(e) => setRankPeriod(e.target.value)} className="!w-auto !px-2 !py-1.5 text-xs" aria-label="Período">
              {ADVISOR_RANK_PERIODS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          }
        >
          {!advisors.data?.length ? (
            <StateMessage type="empty" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-netland-light text-xs font-semibold uppercase tracking-wider text-netland-muted">
                    <th className="pb-2 pr-2">#</th>
                    <th className="pb-2 pr-2">Asesor</th>
                    <th className="pb-2 pr-2 text-right">Cot.</th>
                    <th className="pb-2 pr-2 text-right">Clientes</th>
                    <th className="pb-2 pr-2 text-right">Ventas</th>
                    <th className="pb-2 pr-2 text-right">Monto</th>
                    <th className="pb-2 text-right">Conv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-netland-light">
                  {advisors.data.slice(0, 6).map((advisor) => {
                    const medal = scoreColors(advisor.position);
                    return (
                      <tr key={advisor.advisor_id}>
                        <td className="py-2.5 pr-2">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-1 ${medal.ring}`} style={{ backgroundColor: medal.bg, color: medal.text }}>
                            {advisor.position}
                          </span>
                        </td>
                        <td className="py-2.5 pr-2 font-medium text-netland-dark">{advisor.advisor_name}</td>
                        <td className="py-2.5 pr-2 text-right text-netland-muted">{fmtInt(advisor.quotes_count)}</td>
                        <td className="py-2.5 pr-2 text-right text-netland-muted">{fmtInt(advisor.clients_count)}</td>
                        <td className="py-2.5 pr-2 text-right font-semibold text-netland-dark">{fmtInt(advisor.sales_count)}</td>
                        <td className="py-2.5 pr-2 text-right font-semibold text-netland-dark">{formatSoles(advisor.sold_amount)}</td>
                        <td className="py-2.5 text-right">
                          {advisor.conversion_pct == null ? (
                            <span className="text-netland-muted">—</span>
                          ) : (
                            <span
                              className="rounded-sm px-1.5 py-0.5 text-xs font-bold"
                              style={{ backgroundColor: `${advisor.conversion_pct >= 20 ? CHART_GREEN : advisor.conversion_pct >= 8 ? CHART_GOLD : CHART_RED}18`, color: advisor.conversion_pct >= 20 ? CHART_GREEN : advisor.conversion_pct >= 8 ? "#b45309" : CHART_RED }}
                            >
                              {advisor.conversion_pct}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Embudo comercial"
          subtitle="Progresión de leads hasta la venta"
          loading={funnel.isLoading}
          error={funnel.isError}
          onRetry={() => funnel.refetch()}
        >
          {!funnel.data ? (
            <StateMessage type="empty" />
          ) : (
            <FunnelChart stages={funnel.data.stages} conversions={funnel.data.conversions} />
          )}
        </Panel>
      </div>

      {/* ===================== LEADS POR ORIGEN Y CLIENTES NUEVOS ===================== */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="¿De dónde vienen nuestros clientes?"
          subtitle="Leads por origen"
          loading={sources.isLoading}
          error={sources.isError}
          onRetry={() => sources.refetch()}
          action={
            <Select value={rangeSources} onChange={(e) => setRangeSources(e.target.value)} className="!w-auto !px-2 !py-1.5 text-xs" aria-label="Rango">
              {RANGE_SOURCES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          }
        >
          {!sourceData.length ? (
            <StateMessage type="empty" />
          ) : sourceData.length === 1 ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <span className="text-3xl font-bold text-netland-dark">{fmtInt(sourceData[0].value)}</span>
              <span className="text-sm text-netland-muted">{sourceData[0].name}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
              <div className="h-56 w-full max-w-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2} stroke="none">
                      {sourceData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full max-w-[220px] space-y-2">
                {sourceData.slice(0, 6).map((item) => (
                  <li key={item.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-netland-muted">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="font-semibold text-netland-dark">
                      {fmtInt(item.value)}
                      <span className="ml-1 text-xs font-normal text-netland-muted">({item.pct}%)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel
          title="Nuevos clientes"
          subtitle="Evolución de clientes y leads en el tiempo"
          loading={clientsTrend.isLoading}
          error={clientsTrend.isError}
          onRetry={() => clientsTrend.refetch()}
          action={
            <Select value={rangeClients} onChange={(e) => setRangeClients(e.target.value)} className="!w-auto !px-2 !py-1.5 text-xs" aria-label="Rango">
              {RANGE_MONTHS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          }
        >
          {!clientsTrend.data?.length ? (
            <StateMessage type="empty" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={clientsTrend.data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64736e" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64736e" }} tickLine={false} axisLine={false} width={35} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="clients" name="Clientes nuevos" fill={CHART_GREEN} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Line type="monotone" dataKey="leads" name="Leads" stroke={CHART_BLUE} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      {/* ===================== COBRANZA Y PRÓXIMOS PAGOS ===================== */}
      {!isAdvisorOnly && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Panel
              title="Estado de cobranza"
              subtitle="Resumen de cuentas y saldos de los contratos"
              loading={summary.isLoading}
              error={summary.isError}
              onRetry={refresh}
            >
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-sm bg-netland-background p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-netland-muted">Cobrado</p>
                  <p className="mt-1.5 font-display text-xl font-semibold text-netland-dark">{formatSoles(s?.revenue.collected_total)}</p>
                </div>
                <div className="rounded-sm bg-netland-background p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-netland-muted">Pendiente</p>
                  <p className="mt-1.5 font-display text-xl font-semibold text-netland-dark">{formatSoles(s?.revenue.pending_total)}</p>
                </div>
                <div className="rounded-sm bg-red-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400">Vencido</p>
                  <p className="mt-1.5 font-display text-xl font-semibold text-red-600">{formatSoles(s?.revenue.overdue_debt)}</p>
                </div>
                <div className="rounded-sm bg-netland-background p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-netland-muted">Pagos del mes</p>
                  <p className="mt-1.5 font-display text-xl font-semibold text-netland-dark">{formatSoles(s?.revenue.payments_month)}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-netland-muted">
                El vencido corresponde al saldo de cuotas con estado "vencida". Consulta el detalle en{" "}
                <Link to="/admin/cobranzas" className="font-semibold text-netland-primary hover:underline">
                  Cobranzas
                </Link>
                .
              </p>
            </Panel>
          </div>

          <Panel
            title="Próximos pagos"
            subtitle="Cuotas por vencer o sin pagar"
            loading={summary.isLoading}
            error={summary.isError}
            onRetry={refresh}
          >
            {!(s?.upcoming?.length) ? (
              <StateMessage type="empty" />
            ) : (
              <ul className="space-y-3">
                {s!.upcoming.slice(0, 6).map((item) => {
                  const overdue = new Date(item.due_date) < new Date();
                  return (
                    <li key={item.installment_id} className="rounded-sm border border-netland-light p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-netland-dark">{item.owner_name}</span>
                        <span className="text-sm font-bold text-netland-dark">{formatSoles(item.balance)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-netland-muted">
                        <span>
                          {item.project_name} · Lote {item.lot_code}
                        </span>
                        <span className="flex items-center gap-1" style={{ color: overdue ? CHART_RED : "#64736e" }}>
                          {overdue && <AlertTriangle className="h-3 w-3" />}
                          {new Date(item.due_date).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {/* ===================== ACTIVIDAD RECIENTE ===================== */}
      <Panel
        title="Actividad reciente"
        subtitle="Últimas acciones registradas en el sistema"
        loading={activity.isLoading}
        error={activity.isError}
        onRetry={() => activity.refetch()}
      >
        {!activity.data?.length ? (
          <StateMessage type="empty" />
        ) : (
          <ul className="divide-y divide-netland-light">
            {activity.data.slice(0, 12).map((item) => {
              const meta = ACTIVITY_META[item.entity] ?? { label: capitalize(item.entity ?? "acción"), color: "#64736e", icon: FileText };
              const Icon = meta.icon;
              const actionLabel = ACTION_LABELS[item.action] ?? capitalize(item.action ?? "Registro");
              return (
                <li key={item.id} className="flex items-start gap-3 py-3">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-netland-dark">
                      <span className="font-semibold">{actionLabel} {meta.label}</span>
                      {item.entity_id ? <span className="text-netland-muted"> · #{item.entity_id}</span> : null}
                    </p>
                    <p className="text-xs text-netland-muted">
                      {item.details ? `${item.details} · ` : ""}
                      {item.user_name ?? "Sistema"}
                    </p>
                  </div>
                  <span className="shrink-0 pt-0.5 text-xs text-netland-muted">{timeAgo(item.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export { LOT_STATUS_COLORS };