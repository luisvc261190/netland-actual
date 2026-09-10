import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  FileSignature,
  Home,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { api } from "../../../lib/api";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Table,
  StatCard,
} from "../../admin/ui";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { OwnerDetail, Contract, ContractDetail, Installment, Payment } from "../types";
import {
  PERSON_TYPES,
  DOCUMENT_TYPES,
  PAYMENT_MODALITIES,
  CONTRACT_STATUS,
  CONTRACT_STATUS_COLORS,
  COLLECTION_STATUS,
  COLLECTION_STATUS_COLORS,
  INSTALLMENT_STATUS,
  INSTALLMENT_STATUS_COLORS,
  formatSoles,
  formatDate,
  getOwnerFullName,
} from "../constants";

export default function OwnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ownerId = Number(id);

  // Datos del propietario
  const { data: owner, isLoading } = useQuery({
    queryKey: ["owner", ownerId],
    queryFn: () => api.get<OwnerDetail>(`/owners/${ownerId}`, true),
    enabled: !!ownerId,
  });

  // Contratos del propietario (lista compacta)
  const { data: contracts } = useQuery({
    queryKey: ["owner-contracts", ownerId],
    queryFn: () => api.get<Contract[]>(`/contracts?owner_id=${ownerId}`, true),
    enabled: !!ownerId,
  });

  // Detalles completos de cada contrato activo
  const { data: contractDetails } = useQuery({
    queryKey: ["owner-contract-details", ownerId, contracts],
    queryFn: async () => {
      const list = contracts || [];
      const active = list.filter((c) => c.status === "activo");
      const results = await Promise.all(
        active.map((c) =>
          api.get<ContractDetail>(`/contracts/${c.id}`, true)
        )
      );
      return results;
    },
    enabled: !!ownerId && !!contracts,
  });

  const activeContracts = contractDetails || [];

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Ficha del propietario" subtitle="Cargando información..." />
        <Card>
          <div className="py-12">
            <CoreSpinLoader />
          </div>
        </Card>
      </div>
    );
  }

  if (!owner) {
    return (
      <Card>
        <EmptyState
          title="Propietario no encontrado"
          description="El propietario solicitado no existe o fue eliminado."
        />
      </Card>
    );
  }

  const ownerDisplayName = getOwnerFullName(owner);

  return (
    <div>
      <PageHeader
        title={ownerDisplayName}
        subtitle={owner.person_type === "natural"
          ? `${PERSON_TYPES.natural} · ${DOCUMENT_TYPES[owner.document_type as keyof typeof DOCUMENT_TYPES] || owner.document_type} ${owner.document_number}`
          : `${PERSON_TYPES.juridica} · RUC ${owner.document_number}`}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <Link to={`/admin/contratos`}>
              <Button>
                <FileSignature className="h-4 w-4" />
                Ver contratos
              </Button>
            </Link>
          </div>
        }
      />

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        <StatCard
          label="Propiedades"
          value={owner.total_properties}
          icon={<Home className="h-5 w-5" />}
          accent="#0d7a44"
        />
        <StatCard
          label="Valor total comprado"
          value={formatSoles(owner.total_purchased)}
          icon={<FileSignature className="h-5 w-5" />}
          accent="#0d7a44"
        />
        <StatCard
          label="Total pagado"
          value={formatSoles(owner.total_paid)}
          icon={<CreditCard className="h-5 w-5" />}
          accent="#16a34a"
        />
        <StatCard
          label="Saldo pendiente"
          value={formatSoles(owner.outstanding_balance)}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="#f59e0b"
        />
        <StatCard
          label="Deuda vencida"
          value={formatSoles(owner.overdue_debt)}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="#dc2626"
        />
      </div>

      {/* Datos personales */}
      <Card className="mb-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-netland-dark">
          Datos personales
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-netland-muted" />
            <div>
              <p className="text-xs uppercase text-netland-muted">Dirección</p>
              <p className="text-sm font-medium text-netland-dark">
                {owner.address || "—"}
                {owner.district ? `, ${owner.district}` : ""}
                {owner.province ? `, ${owner.province}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-netland-muted" />
            <div>
              <p className="text-xs uppercase text-netland-muted">Teléfono</p>
              <p className="text-sm font-medium text-netland-dark">
                {owner.client_phone || owner.secondary_phone || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-netland-muted" />
            <div>
              <p className="text-xs uppercase text-netland-muted">Email</p>
              <p className="text-sm font-medium text-netland-dark">
                {owner.client_email || "—"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Propiedades */}
      <Card className="mb-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-netland-dark">
          Propiedades
        </h2>
        {owner.properties.length === 0 ? (
          <EmptyState
            title="Sin propiedades"
            description="Este propietario aún no tiene lotes registrados."
          />
        ) : (
          <Table
            headers={[
              "Proyecto",
              "Manzana",
              "Lote",
              "Área",
              "Precio",
              "Modalidad",
              "Estado",
              "Acciones",
            ]}
          >
            {owner.properties.map((prop) => (
              <tr key={prop.contract_id} className="hover:bg-netland-light/30">
                <td className="px-5 py-3 font-medium text-netland-dark">
                  {prop.project_name}
                </td>
                <td className="px-5 py-3">{prop.block_code || "—"}</td>
                <td className="px-5 py-3 font-semibold">{prop.lot_code}</td>
                <td className="px-5 py-3">{prop.lot_area_m2} m²</td>
                <td className="px-5 py-3 font-semibold text-netland-primary">
                  {formatSoles(prop.total_price)}
                </td>
                <td className="px-5 py-3 text-xs uppercase">
                  {PAYMENT_MODALITIES[prop.payment_modality]}
                </td>
                <td className="px-5 py-3">
                  <Badge color={CONTRACT_STATUS_COLORS[prop.status as keyof typeof CONTRACT_STATUS]}>
                    {CONTRACT_STATUS[prop.status as keyof typeof CONTRACT_STATUS]}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <Link
                    to={`/admin/contratos/${prop.contract_id}`}
                    className="text-sm font-medium text-netland-primary hover:underline"
                  >
                    Ver contrato
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Financiamientos y cronograma por contrato */}
      {activeContracts.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin contratos activos"
            description="No hay financiamientos vigentes para este propietario."
          />
        </Card>
      ) : (
        activeContracts.map((contract) => (
          <ContractSection
            key={contract.id}
            contract={contract}
          />
        ))
      )}
    </div>
  );
}

function ContractSection({
  contract,
}: {
  contract: ContractDetail;
}) {
  const { data: schedule } = useQuery({
    queryKey: ["contract-schedule", contract.id],
    queryFn: () =>
      api.get<Installment[]>(`/contracts/${contract.id}/schedule`, true),
    enabled: !!contract.id,
  });

  const { data: payments } = useQuery({
    queryKey: ["contract-payments", contract.id],
    queryFn: () =>
      api.get<Array<Payment & { created_at: string }>>(
        `/payments/history/${contract.id}`,
        true
      ),
    enabled: !!contract.id,
  });

  const installments = schedule || [];
  const paidInstallments = installments.filter((i) => i.status === "pagada").length;
  const overdueInstallments = installments.filter((i) => i.status === "vencida").length;
  const pendingInstallments = installments.filter((i) =>
    ["pendiente", "parcial"].includes(i.status)
  ).length;

  const financedAmount =
    contract.financing?.financed_amount ??
    installments.reduce((sum, i) => sum + i.scheduled_amount, 0);
  const totalScheduled = installments.reduce((sum, i) => sum + i.scheduled_amount, 0);
  const totalPaidSchedule = installments.reduce((sum, i) => sum + i.paid_amount, 0);
  const totalBalance = installments.reduce((sum, i) => sum + i.balance, 0);

  const roundingDiff = financedAmount - totalScheduled;
  const scheduleRows = installments.reduce<
    Array<Installment & { saldo_capital: number }>
  >((acc, inst, idx) => {
    const isLast = idx === installments.length - 1;
    const amortization = isLast ? inst.scheduled_amount + roundingDiff : inst.scheduled_amount;
    const prevSaldo = idx === 0 ? financedAmount : acc[idx - 1].saldo_capital;
    acc.push({ ...inst, saldo_capital: Math.max(0, prevSaldo - amortization) });
    return acc;
  }, []);

  const nextToPayId = installments.find((i) =>
    ["pendiente", "parcial", "vencida"].includes(i.status)
  )?.id;

  return (
    <Card className="mb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-netland-dark">
            {contract.contract_number}
          </h2>
          <p className="text-sm text-netland-muted">
            {contract.project_name} · {contract.block_code ? `${contract.block_code} - ` : ""}
            {contract.lot_code} · {contract.payment_modality === "contado" ? "Al contado" : "Financiado"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={COLLECTION_STATUS_COLORS[contract.collection_status]}>
            {COLLECTION_STATUS[contract.collection_status]}
          </Badge>
          <Link to={`/admin/contratos/${contract.id}`}>
            <Button variant="outline" className="!px-3 !py-1.5">
              Ver detalle
            </Button>
          </Link>
        </div>
      </div>

      {/* Resumen del financiamiento */}
      {contract.financing && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryBox
            label="Monto financiado"
            value={formatSoles(contract.financing.financed_amount)}
          />
          <SummaryBox
            label="Cuota mensual"
            value={formatSoles(contract.financing.installment_amount)}
          />
          <SummaryBox
            label="Total pagado"
            value={formatSoles(contract.total_paid)}
          />
          <SummaryBox
            label="Saldo pendiente"
            value={formatSoles(contract.outstanding_balance)}
            danger={contract.outstanding_balance > 0}
          />
        </div>
      )}

      {/* Estadísticas de cuotas */}
      {contract.financing && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">
            {paidInstallments} pagadas
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
            {pendingInstallments} pendientes
          </span>
          {overdueInstallments > 0 && (
            <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
              {overdueInstallments} vencidas
            </span>
          )}
        </div>
      )}

      {/* Cronograma */}
      {contract.financing && (
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-netland-muted">
            <CalendarDays className="h-4 w-4" />
            Cronograma de cuotas
          </h3>
          {installments.length === 0 ? (
            <EmptyState
              title="Sin cronograma"
              description="No se ha generado el cronograma de este contrato."
            />
          ) : (
            <Table
              headers={[
                "Cuota",
                "Vencimiento",
                "Monto",
                "Pagado",
                "Saldo",
                "Estado",
              ]}
            >
              {scheduleRows.map((inst) => (
                <tr
                  key={inst.id}
                  className={`transition-colors hover:bg-netland-light/30 ${
                    inst.id === nextToPayId ? "bg-amber-50/60" : ""
                  }`}
                >
                  <td className="px-5 py-2.5 font-semibold">
                    {String(inst.installment_number).padStart(2, "0")}
                  </td>
                  <td className="px-5 py-2.5 text-sm">{formatDate(inst.due_date)}</td>
                  <td className="px-5 py-2.5">{formatSoles(inst.scheduled_amount)}</td>
                  <td className="px-5 py-2.5">{formatSoles(inst.paid_amount)}</td>
                  <td className="px-5 py-2.5 font-medium">
                    {formatSoles(inst.saldo_capital)}
                  </td>
                  <td className="px-5 py-2.5">
                    <Badge color={INSTALLMENT_STATUS_COLORS[inst.status]}>
                      {INSTALLMENT_STATUS[inst.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-netland-light bg-netland-light/20 font-semibold text-netland-dark">
                <td className="px-5 py-3" colSpan={2}>
                  Totales
                </td>
                <td className="px-5 py-3">{formatSoles(totalScheduled)}</td>
                <td className="px-5 py-3 text-netland-primary">{formatSoles(totalPaidSchedule)}</td>
                <td className="px-5 py-3">{formatSoles(totalBalance)}</td>
                <td className="px-5 py-3" />
              </tr>
            </Table>
          )}
        </div>
      )}

      {/* Historial de pagos */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-netland-muted">
          <CreditCard className="h-4 w-4" />
          Historial de pagos
        </h3>
        {!payments || payments.length === 0 ? (
          <p className="text-sm text-netland-muted">Sin pagos registrados.</p>
        ) : (
          <Table
            headers={["Fecha", "Monto", "Medio", "Transacción", "Estado"]}
          >
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-netland-light/30">
                <td className="px-5 py-2.5 text-sm">{formatDate(p.payment_date)}</td>
                <td className="px-5 py-2.5 font-semibold text-netland-primary">
                  {formatSoles(p.amount)}
                </td>
                <td className="px-5 py-2.5 text-xs uppercase">{p.payment_method}</td>
                <td className="px-5 py-2.5 text-sm">{p.transaction_number || "—"}</td>
                <td className="px-5 py-2.5">
                  {p.is_cancelled ? (
                    <Badge color="#dc2626">Anulado</Badge>
                  ) : (
                    <Badge color="#16a34a">Registrado</Badge>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </Card>
  );
}

function SummaryBox({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-netland-light bg-netland-light/20 p-3">
      <p className="text-xs uppercase tracking-wide text-netland-muted">{label}</p>
      <p
        className={`mt-1 font-display text-lg font-bold ${
          danger ? "text-red-600" : "text-netland-dark"
        }`}
      >
        {value}
      </p>
    </div>
  );
}