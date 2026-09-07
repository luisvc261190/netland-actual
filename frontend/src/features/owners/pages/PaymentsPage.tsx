import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Eye, XCircle, Search, X, Download } from "lucide-react";
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
import type { Contract, Payment } from "../types";
import { PAYMENT_METHODS, formatSoles, formatDate } from "../constants";

interface PaymentFormState {
  contract_id: string;
  payment_date: string;
  amount: string;
  payment_method: string;
  transaction_number: string;
  bank_name: string;
  notes: string;
}

const emptyForm: PaymentFormState = {
  contract_id: "",
  payment_date: new Date().toISOString().split("T")[0],
  amount: "",
  payment_method: "efectivo",
  transaction_number: "",
  bank_name: "",
  notes: "",
};

export default function PaymentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PaymentFormState>(emptyForm);

  // Fetch payments
  const {
    data: payments,
    isLoading,
  } = useQuery({
    queryKey: ["payments", search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      return api.get<any[]>(`/payments?${params.toString()}`, true);
    },
  });

  // Fetch active contracts for dropdown
  const { data: contracts } = useQuery({
    queryKey: ["contracts-active"],
    queryFn: () => api.get<Contract[]>("/contracts?status=activo", true),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (payload: any) => api.post("/payments", payload, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["collections-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["collections-items"] });
      toast("Pago registrado correctamente");
      setModalOpen(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api.post(`/payments/${id}/cancel`, { cancellation_reason: reason }, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["collections-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["collections-items"] });
      toast("Pago anulado correctamente");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const filteredPayments = payments || [];
  const totalPayments = filteredPayments.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedPayments = filteredPayments.slice(startIndex, startIndex + pageSize);

  const openCreate = () => {
    setForm(emptyForm);
    setModalOpen(true);
  };

  const submit = () => {
    if (!form.contract_id) {
      toast("Selecciona un contrato", "error");
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast("El monto debe ser mayor a 0", "error");
      return;
    }

    // Get payer_id from contract
    const selectedContract = contracts?.find((c) => c.id === Number(form.contract_id));
    if (!selectedContract) {
      toast("Contrato no encontrado", "error");
      return;
    }

    const payload = {
      contract_id: Number(form.contract_id),
      payer_id: selectedContract.owner_id,
      payment_date: form.payment_date,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      transaction_number: form.transaction_number || null,
      bank_name: form.bank_name || null,
      notes: form.notes || null,
    };

    saveMutation.mutate(payload);
  };

  const handleCancel = async (payment: Payment) => {
    const reason = prompt("Ingresa el motivo de la anulación (mínimo 10 caracteres):");
    if (!reason || reason.trim().length < 10) {
      toast("El motivo debe tener al menos 10 caracteres", "error");
      return;
    }
    if (await confirm(`¿Anular el pago de ${formatSoles(payment.amount)}?`)) {
      cancelMutation.mutate({ id: payment.id, reason: reason.trim() });
    }
  };

  return (
    <div>
      <PageHeader
        title="Pagos"
        subtitle="Registra y gestiona los pagos de contratos."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Registrar Pago
          </Button>
        }
      />

      {/* Search Filter */}
      <Card className="mb-6">
        <Field label="Buscar pago">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-netland-muted" />
            <Input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por contrato, propietario, transacción, banco..."
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
      </Card>

      {/* Payments Table */}
      {isLoading ? (
        <Card>
          <div className="py-8">
            <CoreSpinLoader />
          </div>
        </Card>
      ) : totalPayments === 0 ? (
        <Card>
          <EmptyState
            title="Sin pagos"
            description={
              search
                ? `No se encontraron pagos que coincidan con «${search}».`
                : "Registra el primer pago para comenzar."
            }
          />
        </Card>
      ) : (
        <>
          <Table
            headers={[
              "N° Contrato",
              "Propietario",
              "Fecha",
              "Monto",
              "Método",
              "Transacción",
              "Banco",
              "Estado",
              "Acciones",
            ]}
          >
            {paginatedPayments.map((payment) => (
              <tr
                key={payment.id}
                className={`hover:bg-netland-light/30 ${
                  payment.is_cancelled ? "opacity-50" : ""
                }`}
              >
                <td className="px-5 py-3 font-semibold text-netland-dark">
                  {payment.contract_number}
                </td>
                <td className="px-5 py-3 text-sm">{payment.payer_name}</td>
                <td className="px-5 py-3 text-sm">{formatDate(payment.payment_date)}</td>
                <td className="px-5 py-3 font-semibold text-netland-primary">
                  {formatSoles(payment.amount)}
                </td>
                <td className="px-5 py-3 text-xs uppercase">{payment.payment_method}</td>
                <td className="px-5 py-3 text-sm">{payment.transaction_number || "—"}</td>
                <td className="px-5 py-3 text-sm">{payment.bank_name || "—"}</td>
                <td className="px-5 py-3">
                  {payment.is_cancelled ? (
                    <Badge color="#dc2626">Anulado</Badge>
                  ) : (
                    <Badge color="#16a34a">Registrado</Badge>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="!px-2.5 !py-1.5"
                      onClick={() => navigate(`/admin/pagos/${payment.id}`)}
                      title="Ver detalle"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {!payment.is_cancelled && (
                      <Button
                        variant="danger"
                        className="!px-2.5 !py-1.5"
                        onClick={() => handleCancel(payment)}
                        title="Anular pago"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {payment.receipt_url && (
                      <Button
                        variant="outline"
                        className="!px-2.5 !py-1.5"
                        onClick={() => window.open(payment.receipt_url!, "_blank")}
                        title="Ver recibo"
                      >
                        <Download className="h-3.5 w-3.5" />
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
            total={totalPayments}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            unitLabel="pagos"
          />
        </>
      )}

      {/* Form Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Registrar Pago"
        wide
      >
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Contrato" className="sm:col-span-2">
            <Select
              value={form.contract_id}
              onChange={(e) => setForm({ ...form, contract_id: e.target.value })}
            >
              <option value="">Seleccionar contrato...</option>
              {contracts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contract_number} - {formatSoles(c.total_price)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Fecha de Pago">
            <Input
              type="date"
              value={form.payment_date}
              onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
            />
          </Field>

          <Field label="Monto (S/)">
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
          </Field>

          <Field label="Método de Pago">
            <Select
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
            >
              {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Número de Transacción">
            <Input
              value={form.transaction_number}
              onChange={(e) => setForm({ ...form, transaction_number: e.target.value })}
              placeholder="Opcional"
            />
          </Field>

          <Field label="Banco">
            <Input
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              placeholder="Opcional"
            />
          </Field>

          <Field label="Observaciones" className="sm:col-span-2">
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Opcional"
            />
          </Field>

          <div className="flex justify-end gap-3 sm:col-span-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saveMutation.isPending}>
              Registrar pago
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
