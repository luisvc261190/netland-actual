import { useState } from "react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import {
  BadgePercent,
  CalendarDays,
  ClipboardList,
  Database,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Milestone,
  Quote as QuoteIcon,
  Settings,
  Users,
  X,
  DollarSign,
  UserCheck,
  FileSignature,
  Wallet,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { Logo } from "../../components/Logo";
import { ROLE_LABELS } from "../../lib/constants";

const navItems = [
  {
    section: "Principal",
    to: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    end: true,
    roles: ["SUPER_ADMIN", "ADMIN", "ASESOR", "VENTAS", "COBRANZAS", "SUPERVISOR"],
  },
  {
    section: "Proyectos",
    to: "/admin/proyectos",
    label: "Proyectos",
    icon: FolderKanban,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    section: "Proyectos",
    to: "/admin/lotes",
    label: "Lotes",
    icon: Milestone,
    roles: ["SUPER_ADMIN", "ADMIN", "ASESOR"],
  },
  {
    section: "Comercial",
    to: "/admin/leads",
    label: "Leads",
    icon: MessageSquare,
    roles: ["SUPER_ADMIN", "ADMIN", "ASESOR"],
  },
  {
    section: "Comercial",
    to: "/admin/clientes-captados",
    label: "Clientes captados",
    icon: ClipboardList,
    roles: ["SUPER_ADMIN", "ADMIN", "ASESOR"],
  },
  {
    section: "Comercial",
    to: "/admin/cotizaciones",
    label: "Cotizaciones",
    icon: QuoteIcon,
    roles: ["SUPER_ADMIN", "ADMIN", "ASESOR", "VENTAS"],
  },
  {
    section: "Comercial",
    to: "/admin/visitas",
    label: "Visitas",
    icon: CalendarDays,
    roles: ["SUPER_ADMIN", "ADMIN", "ASESOR"],
  },
  {
    section: "Ventas",
    to: "/admin/ventas",
    label: "Ventas",
    icon: BadgePercent,
    roles: ["SUPER_ADMIN", "ADMIN", "VENTAS", "SUPERVISOR"],
  },
  {
    section: "Ventas",
    to: "/admin/asesores",
    label: "Asesores",
    icon: Users,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    section: "Ventas",
    to: "/admin/propietarios",
    label: "Propietarios",
    icon: UserCheck,
    roles: ["SUPER_ADMIN", "ADMIN", "VENTAS", "COBRANZAS", "SUPERVISOR"],
  },
  {
    section: "Ventas",
    to: "/admin/contratos",
    label: "Contratos",
    icon: FileSignature,
    roles: ["SUPER_ADMIN", "ADMIN", "VENTAS", "COBRANZAS", "SUPERVISOR"],
  },
  {
    section: "Finanzas",
    to: "/admin/pagos",
    label: "Pagos",
    icon: Wallet,
    roles: ["SUPER_ADMIN", "ADMIN", "COBRANZAS", "SUPERVISOR"],
  },
  {
    section: "Finanzas",
    to: "/admin/cobranzas",
    label: "Cobranzas",
    icon: DollarSign,
    roles: ["SUPER_ADMIN", "ADMIN", "COBRANZAS", "SUPERVISOR"],
  },
  {
    section: "Marketing",
    to: "/admin/anuncios",
    label: "Anuncios (pop-up)",
    icon: Megaphone,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    section: "Sistema",
    to: "/admin/multimedia",
    label: "Multimedia",
    icon: FileText,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    section: "Sistema",
    to: "/admin/configuracion",
    label: "Configuración",
    icon: Settings,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    section: "Sistema",
    to: "/admin/usuarios",
    label: "Usuarios",
    icon: Users,
    roles: ["SUPER_ADMIN"],
  },
  {
    section: "Sistema",
    to: "/admin/backups",
    label: "Backups",
    icon: Database,
    roles: ["SUPER_ADMIN"],
  },
];

export default function AdminLayout() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const visibleNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role?.toUpperCase() ?? "")
  );

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-netland-light/40">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-netland-dark text-white transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between px-6">
          <Logo light size="sm" />

          <button
            className="text-white/70 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-4 py-4">
          {visibleNavItems.map((item, index) => {
            const prevItem = visibleNavItems[index - 1];
            const showSection = !prevItem || prevItem.section !== item.section;

            return (
              <div key={item.to}>
                {showSection && (
                  <p
                    className={`px-4 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 ${
                      index === 0 ? "pt-0" : ""
                    }`}
                  >
                    {item.section}
                  </p>
                )}
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-netland-primary text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-netland-accent text-sm font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user?.name}
              </p>

              <p className="text-xs text-white/60">
                {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-netland-light bg-white/95 px-5 backdrop-blur lg:px-8">
          <button
            className="text-netland-dark lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-6 w-6" />
          </button>

          <h2 className="hidden font-display text-xl font-semibold text-netland-dark sm:block">
            Panel administrativo
          </h2>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-netland-primary hover:text-netland-accent"
          >
            Ver sitio público →
          </a>
        </header>

        <main className="flex-1 p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}