import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CalendarDays,
  FileSignature,
  FolderKanban,
  MessageSquare,
  Milestone,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { api } from "../../../lib/api";
import type { DashboardStats } from "../../../types";
import { LEAD_STATUS_LABELS, LOT_STATUS_LABELS, LOT_STATUS_COLORS, CAPTURED_SOURCES, formatSoles } from "../../../lib/constants";
import { PageHeader, Card, StatCard, Table } from "../ui";
import { useAuth } from "../AuthContext";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";

const statusColors: Record<string, string> = {
  available: "#16a34a",
  reserved: "#eab308",
  sold: "#dc2626",
  not_available: "#9ca3af",
  new: "#2563eb",
  contacted: "#7c3aed",
  interested: "#ea580c",
  visit_scheduled: "#0891b2",
  negotiation: "#db2777",
  discarded: "#6b7280",
};

export default function Dashboard() {
  const { user } = useAuth();
  const isAdvisorOnly = user?.role?.toUpperCase() === "ASESOR";

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardStats>("/dashboard/stats", true),
  });

  const { data: recentLeads } = useQuery({
    queryKey: ["leads", "recent"],
    queryFn: () =>
      api.get<any[]>(
        `/leads?exclude_source=${CAPTURED_SOURCES.join(",")}`,
        true
      ),
  });

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <CoreSpinLoader />
      </div>
    );
  }

  const lotsData = stats.lots_by_status.map((s) => ({
    name: LOT_STATUS_LABELS[s.status] ?? s.status,
    value: s.count,
    color: statusColors[s.status] ?? "#999",
  }));
  const leadsData = stats.leads_by_status.map((s) => ({
    name: LEAD_STATUS_LABELS[s.status] ?? s.status,
    value: s.count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hola, ${user?.name?.split(" ")[0] ?? ""}`}
        subtitle={
          isAdvisorOnly
            ? "Este es el resumen de tu actividad: tus clientes y tus gestiones."
            : "Resumen general de la plataforma Netland."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Proyectos" value={stats.projects_total} icon={<FolderKanban className="h-4 w-4" />} />
        <StatCard label="Lotes disponibles" value={stats.lots_available} icon={<Milestone className="h-4 w-4" />} accent="#16a34a" />
        <StatCard label="Lotes reservados" value={stats.lots_reserved} icon={<Milestone className="h-4 w-4" />} accent="#eab308" />
        <StatCard label="Lotes vendidos" value={stats.lots_sold} icon={<Milestone className="h-4 w-4" />} accent="#dc2626" />
        <StatCard label="Propietarios" value={stats.owners_total} icon={<UserCheck className="h-4 w-4" />} accent="#0d7a44" />
        <StatCard label="Contratos activos" value={stats.contracts_active} icon={<FileSignature className="h-4 w-4" />} accent="#0891b2" />
        <StatCard label="Saldo por cobrar" value={formatSoles(stats.pending_balance)} icon={<AlertTriangle className="h-4 w-4" />} accent="#f59e0b" />
        <StatCard label="Deuda vencida" value={formatSoles(stats.overdue_debt)} icon={<AlertTriangle className="h-4 w-4" />} accent="#dc2626" />
        <StatCard label="Leads nuevos" value={stats.leads_new} icon={<MessageSquare className="h-4 w-4" />} accent="#2563eb" />
        <StatCard label="Visitas programadas" value={stats.leads_visit_scheduled} icon={<CalendarDays className="h-4 w-4" />} accent="#0891b2" />
        <StatCard label="Asesores" value={stats.advisors_total} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Cotizaciones" value={stats.quotes_total} icon={<Sparkles className="h-4 w-4" />} accent="#f5a623" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-display text-xl font-semibold text-netland-dark">
            Estado de lotes
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={lotsData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {lotsData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-display text-xl font-semibold text-netland-dark">
            Leads por estado
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#0d7a44" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="mb-4 font-display text-xl font-semibold text-netland-dark">
          Leads por proyecto
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.leads_by_project}>
              <XAxis dataKey="project" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#f5a623" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 font-display text-xl font-semibold text-netland-dark">
          Últimos leads
        </h3>
        <Table headers={["Nombre", "Teléfono", "Proyecto", "Estado"]}>
          {(recentLeads ?? []).slice(0, 8).map((lead) => (
            <tr key={lead.id}>
              <td className="px-5 py-3 font-medium text-netland-dark">
                {lead.client?.name} {lead.client?.last_name}
              </td>
              <td className="px-5 py-3 text-netland-muted">{lead.client?.phone}</td>
              <td className="px-5 py-3 text-netland-muted">{lead.project_name ?? "—"}</td>
              <td className="px-5 py-3">
                <BadgeStatus status={lead.status} />
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

function BadgeStatus({ status }: { status: string }) {
  const color = statusColors[status] ?? "#6b7280";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold uppercase tracking-wider"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {LEAD_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export { LOT_STATUS_COLORS };