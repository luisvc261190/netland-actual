import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, FileText, Plus, Search, X } from "lucide-react";
import { api } from "../../../lib/api";
import { API_URL } from "../../../lib/constants";
import { PageHeader, Button, Card, Badge, Table, Field, Select, Input, Pagination } from "../../admin/ui";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { Project } from "../../../types";
import NewSaleModal from "../components/NewSaleModal";
import { PAYMENT_MODALITIES, CONTRACT_STATUS, COLLECTION_STATUS, COLLECTION_STATUS_COLORS, formatSoles } from "../constants";

export interface SaleItem {
  sale_id: number;
  contract_id: number;
  contract_number: string;
  sale_date: string;
  owner_name: string;
  owner_document: string;
  owner_phone: string;
  project_name: string;
  block_code?: string | null;
  lot_code: string;
  lot_area_m2: number;
  price_per_m2: number;
  total_price: number;
  payment_modality: "contado" | "financiado";
  sale_status: string;
  payment_status: "pendiente" | "parcial" | "pagado";
  paid_amount: number;
  pending_amount: number;
  collection_status: "al_dia" | "proximo_vencer" | "vencido" | "cancelado";
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagado: "Pagado",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pendiente: "#f59e0b",
  parcial: "#3b82f6",
  pagado: "#16a34a",
};

export default function SalesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [projectId, setProjectId] = useState<number | "">("");
  const [status, setStatus] = useState("");
  const [modality, setModality] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");
  const [newSaleOpen, setNewSaleOpen] = useState(false);

  const { data: projects } = useQuery({
    queryKey: ["projects-admin"],
    queryFn: () => api.get<Project[]>("/projects", true),
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["sales", projectId, status, modality, paymentStatus, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (projectId) params.append("project_id", projectId.toString());
      if (status) params.append("status", status);
      if (modality) params.append("payment_modality", modality);
      if (paymentStatus) params.append("payment_status", paymentStatus);
      if (search) params.append("search", search);
      return api.get<SaleItem[]>(`/sales?${params.toString()}`, true);
    },
  });

  const sales = items || [];
  const totalItems = sales.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedItems = sales.slice(startIndex, startIndex + pageSize);

  const downloadSalePdf = async (contractId: number, contractNumber: string) => {
    const token = localStorage.getItem("netland_token");
    const response = await fetch(`${API_URL}/sales/${contractId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${contractNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle="Consultas comerciales: contratos, cobranzas y estados de pago."
        action={
          <Button onClick={() => setNewSaleOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva venta
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Proyecto">
            <Select value={projectId} onChange={(e) => { setProjectId(e.target.value ? Number(e.target.value) : ""); setPage(1); }}>
              <option value="">Todos</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>{p.short_name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Estado contrato">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {Object.entries(CONTRACT_STATUS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Modalidad">
            <Select value={modality} onChange={(e) => { setModality(e.target.value); setPage(1); }}>
              <option value="">Todas</option>
              {Object.entries(PAYMENT_MODALITIES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Estado de pago">
            <Select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Buscar" className="sm:col-span-2 lg:col-span-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-netland-muted" />
              <Input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Propietario, documento, contrato"
                className="!pl-9 !pr-10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-netland-muted hover:text-netland-dark"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </Field>
        </div>
      </Card>

      {isLoading ? (
        <Card><div className="py-8"><CoreSpinLoader /></div></Card>
      ) : totalItems === 0 ? (
        <Card>
          <EmptyState title="Sin ventas" description="No hay contratos que coincidan con los filtros." />
        </Card>
      ) : (
        <>
          <Table
            headers={[
              "Contrato", "Cliente", "Proyecto", "Lote", "Modalidad",
              "Precio", "Pagado", "Pendiente", "Pago", "Cobranza", "Acciones",
            ]}
          >
            {paginatedItems.map((item) => (
              <tr key={item.sale_id} className="hover:bg-netland-light/30">
                <td className="px-5 py-3 font-semibold text-netland-dark">{item.contract_number}</td>
                <td className="px-5 py-3">
                  <div>
                    <p className="font-medium text-netland-dark">{item.owner_name}</p>
                    <p className="text-xs text-netland-muted">{item.owner_document}</p>
                  </div>
                </td>
                <td className="px-5 py-3 text-netland-muted">{item.project_name}</td>
                <td className="px-5 py-3 font-medium">
                  {item.block_code ? `${item.block_code} - ` : ""}{item.lot_code}
                </td>
                <td className="px-5 py-3 text-xs uppercase">{PAYMENT_MODALITIES[item.payment_modality] ?? item.payment_modality}</td>
                <td className="px-5 py-3">{formatSoles(item.total_price)}</td>
                <td className="px-5 py-3 text-green-600 font-medium">{formatSoles(item.paid_amount)}</td>
                <td className="px-5 py-3 font-semibold text-netland-primary">{formatSoles(item.pending_amount)}</td>
                <td className="px-5 py-3">
                  <Badge color={PAYMENT_STATUS_COLORS[item.payment_status] ?? "#6b7280"}>
                    {PAYMENT_STATUS_LABELS[item.payment_status] ?? item.payment_status}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge color={COLLECTION_STATUS_COLORS[item.collection_status]}>
                    {COLLECTION_STATUS[item.collection_status] ?? item.collection_status}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="!px-2.5 !py-1.5"
                      title="Ver detalle"
                      onClick={() => navigate(`/admin/contratos/${item.contract_id}`)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      className="!px-2.5 !py-1.5"
                      title="Descargar PDF de venta"
                      onClick={() => downloadSalePdf(item.contract_id, item.contract_number)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            unitLabel="ventas"
          />
        </>
      )}

      <NewSaleModal open={newSaleOpen} onClose={() => setNewSaleOpen(false)} />
    </div>
  );
}
