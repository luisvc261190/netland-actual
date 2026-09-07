import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Search, X, Download, XCircle } from "lucide-react";
import { api } from "../../../lib/api";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Table,
  Field,
  Select,
  Input,
  Pagination,
} from "../../admin/ui";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { Project } from "../../../types";
import type { Contract } from "../types";
import {
  CONTRACT_STATUS,
  CONTRACT_STATUS_COLORS,
  PAYMENT_MODALITIES,
  formatSoles,
  formatDate,
} from "../constants";

export default function ContractsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [projectId, setProjectId] = useState<number | "">("");
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [cancellationInfo, setCancellationInfo] = useState<any>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ["projects-admin"],
    queryFn: () => api.get<Project[]>("/projects", true),
  });

  // Fetch contracts
  const {
    data: contracts,
    isLoading,
  } = useQuery({
    queryKey: ["contracts", projectId, status, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (projectId) params.append("project_id", projectId.toString());
      if (status) params.append("status", status);
      if (search) params.append("search", search);
      return api.get<Contract[]>(`/contracts?${params.toString()}`, true);
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: ({ contractId, reason }: { contractId: number; reason: string }) => {
      const params = new URLSearchParams({ cancellation_reason: reason });
      return api.del(`/contracts/${contractId}?${params.toString()}`, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["collections-dashboard"] });
      toast("Contrato anulado exitosamente. El lote ahora está disponible.");
      setCancelModalOpen(false);
      setSelectedContract(null);
      setCancellationInfo(null);
      setCancellationReason("");
    },
    onError: (error: any) => {
      toast(error.message || "Error al anular el contrato", "error");
    },
  });

  const filteredContracts = contracts || [];
  const totalContracts = filteredContracts.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedContracts = filteredContracts.slice(startIndex, startIndex + pageSize);

  const handleDownloadContract = async (contractId: number, contractNumber: string) => {
    try {
      const token = localStorage.getItem("netland_token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/contracts/${contractId}/pdf`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Error al descargar el contrato");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${contractNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al descargar contrato:", error);
      alert("Error al descargar el contrato. Por favor, intenta nuevamente.");
    }
  };

  const handleCancelContract = async (contract: Contract) => {
    if (contract.status === "anulado") {
      toast("Este contrato ya está anulado", "error");
      return;
    }

    // Obtener información del impacto
    try {
      const info = await api.get(`/contracts/${contract.id}/cancellation-info`, true);
      setSelectedContract(contract);
      setCancellationInfo(info);
      setCancelModalOpen(true);
    } catch (error: any) {
      toast(error.message || "Error al obtener información del contrato", "error");
    }
  };

  const confirmCancellation = () => {
    if (!cancellationReason || cancellationReason.trim().length < 10) {
      toast("El motivo debe tener al menos 10 caracteres", "error");
      return;
    }

    if (!selectedContract) return;

    cancelMutation.mutate({
      contractId: selectedContract.id,
      reason: cancellationReason.trim(),
    });
  };

  return (
    <div>
      <PageHeader
        title="Contratos"
        subtitle="Gestiona los contratos de compra-venta de lotes."
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Proyecto">
            <Select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value ? Number(e.target.value) : "");
                setPage(1);
              }}
            >
              <option value="">Todos los proyectos</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.short_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Estado">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los estados</option>
              {Object.entries(CONTRACT_STATUS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Buscar" className="sm:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-netland-muted" />
              <Input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por contrato, propietario, lote..."
                className="!pl-9 !pr-10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-netland-muted transition-colors hover:text-netland-dark"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </Field>
        </div>
      </Card>

      {/* Contracts Table */}
      {isLoading ? (
        <Card>
          <div className="py-8">
            <CoreSpinLoader />
          </div>
        </Card>
      ) : totalContracts === 0 ? (
        <Card>
          <EmptyState
            title="Sin contratos"
            description={
              search
                ? `No se encontraron contratos que coincidan con «${search}».`
                : "No hay contratos registrados."
            }
          />
        </Card>
      ) : (
        <>
          <Table
            headers={[
              "N° Contrato",
              "Fecha",
              "Área",
              "Precio Total",
              "Modalidad",
              "Estado",
              "Acciones",
            ]}
          >
            {paginatedContracts.map((contract) => (
              <tr key={contract.id} className="hover:bg-netland-light/30">
                <td className="px-5 py-3 font-semibold text-netland-dark">
                  {contract.contract_number}
                </td>
                <td className="px-5 py-3 text-sm">{formatDate(contract.contract_date)}</td>
                <td className="px-5 py-3">{contract.lot_area_m2} m²</td>
                <td className="px-5 py-3 font-semibold text-netland-primary">
                  {formatSoles(contract.total_price)}
                </td>
                <td className="px-5 py-3 text-xs uppercase">
                  {PAYMENT_MODALITIES[contract.payment_modality]}
                </td>
                <td className="px-5 py-3">
                  <Badge color={CONTRACT_STATUS_COLORS[contract.status]}>
                    {CONTRACT_STATUS[contract.status]}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="!px-2.5 !py-1.5"
                      onClick={() =>
                        navigate(`/admin/contratos/${contract.id}`)
                      }
                      title="Ver detalle"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      className="!px-2.5 !py-1.5"
                      onClick={() => handleDownloadContract(contract.id, contract.contract_number)}
                      title="Descargar contrato"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {contract.status !== "anulado" && (
                      <Button
                        variant="danger"
                        className="!px-2.5 !py-1.5"
                        onClick={() => handleCancelContract(contract)}
                        title="Anular contrato"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalContracts}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            unitLabel="contratos"
          />
        </>
      )}

      {/* Cancel Contract Modal */}
      <Modal
        open={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setSelectedContract(null);
          setCancellationInfo(null);
          setCancellationReason("");
        }}
        title="Anular Contrato"
        wide
      >
        <div className="p-6">
          {cancellationInfo && (
            <>
              <div className="mb-6">
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-yellow-800 mb-2">
                        Advertencia: Esta acción tiene las siguientes consecuencias
                      </h3>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        {cancellationInfo.warnings?.filter((w: any) => w).map((warning: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-yellow-600 mt-0.5">•</span>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6 rounded-lg bg-netland-light/30 border border-netland-muted/20 p-4">
                <h4 className="text-sm font-semibold text-netland-dark mb-3">
                  Resumen del Contrato {selectedContract?.contract_number}
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-netland-muted">Estado actual:</span>
                    <span className="ml-2 font-medium text-netland-dark capitalize">
                      {cancellationInfo.contract_status}
                    </span>
                  </div>
                  <div>
                    <span className="text-netland-muted">Pagos registrados:</span>
                    <span className="ml-2 font-medium text-netland-dark">
                      {cancellationInfo.total_payments}
                    </span>
                  </div>
                  <div>
                    <span className="text-netland-muted">Monto pagado:</span>
                    <span className="ml-2 font-medium text-netland-primary">
                      {formatSoles(cancellationInfo.total_amount_paid)}
                    </span>
                  </div>
                  <div>
                    <span className="text-netland-muted">Cuotas pendientes:</span>
                    <span className="ml-2 font-medium text-netland-dark">
                      {cancellationInfo.pending_installments}
                    </span>
                  </div>
                </div>
              </div>

              <Field label="Motivo de anulación (mínimo 10 caracteres)" className="mb-6">
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Ejemplo: Cliente solicitó cancelación por motivos personales..."
                  rows={4}
                  className="w-full rounded-lg border border-netland-muted/30 px-3 py-2 text-sm focus:border-netland-primary focus:outline-none"
                  minLength={10}
                  required
                />
                <p className="mt-1 text-xs text-netland-muted">
                  {cancellationReason.length}/10 caracteres mínimos
                </p>
              </Field>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCancelModalOpen(false);
                    setSelectedContract(null);
                    setCancellationInfo(null);
                    setCancellationReason("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={confirmCancellation}
                  disabled={cancelMutation.isPending || cancellationReason.trim().length < 10}
                >
                  {cancelMutation.isPending ? "Anulando..." : "Confirmar Anulación"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
