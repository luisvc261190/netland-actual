import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import type { Advisor, AdvisorCommission, CommissionPayment, CommissionPaymentType, Project } from "../../../types";
import { Button, Field, Input, Select, Textarea } from "../../admin/ui";
import { Modal } from "../../../components/ui/Modal";
import type { PaymentFormPayload } from "../types";
import { formatMoney } from "../constants";

interface ContractOption {
  id: number;
  contract_number: string;
  project_id: number;
  advisor_id: number | null;
  total_price: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: CommissionPaymentType;
  editing: CommissionPayment | null;
  onSave: (payload: PaymentFormPayload) => void;
  isSubmitting: boolean;
}

function toNum(value: string): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function PaymentFormModal({ open, onClose, mode, editing, onSave, isSubmitting }: Props) {
  const isEditing = !!editing;

  const [advisorId, setAdvisorId] = useState<number | "">("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [contractId, setContractId] = useState<number | "">("");
  const [baseAmount, setBaseAmount] = useState("");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [period, setPeriod] = useState("");
  const [notes, setNotes] = useState("");

  const { data: advisors } = useQuery({
    queryKey: ["advisors-admin"],
    queryFn: ({ signal }) => api.get<Advisor[]>("/advisors", true, signal),
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-admin"],
    queryFn: ({ signal }) => api.get<Project[]>("/projects", true, signal),
  });

  const { data: configs } = useQuery({
    queryKey: ["commission-configs-active"],
    queryFn: ({ signal }) => api.get<AdvisorCommission[]>("/commissions/configs?is_active=true", true, signal),
    enabled: mode === "comision",
  });

  const { data: contracts } = useQuery({
    queryKey: ["contracts-light"],
    queryFn: ({ signal }) => api.get<ContractOption[]>("/contracts?limit=400", true, signal),
    enabled: mode === "comision",
  });

  const { data: existingCommission } = useQuery({
    queryKey: ["existing-commission", contractId],
    queryFn: ({ signal }) =>
      api.get<CommissionPayment[]>(
        `/commissions/payments?payment_type=comision&contract_id=${contractId}`,
        true,
        signal,
      ),
    enabled: mode === "comision" && !!contractId && !isEditing,
  });

  useEffect(() => {
    if (!open) return;
    setAdvisorId(editing?.advisor_id ?? "");
    setProjectId(editing?.project_id ?? "");
    setContractId(editing?.contract_id ?? "");
    setBaseAmount(editing?.base_amount != null ? String(editing.base_amount) : "");
    setPercent(editing?.percent_applied != null ? String(editing.percent_applied) : "");
    setAmount(editing?.amount != null ? String(editing.amount) : "");
    setConcept(editing?.concept ?? "");
    setPeriod(editing?.payment_period ?? "");
    setNotes(editing?.notes ?? "");
  }, [open, editing]);

  const advisor = useMemo(
    () => (advisorId ? advisors?.find((a) => a.id === advisorId) : undefined),
    [advisors, advisorId]
  );

  const config = useMemo(() => {
    if (mode !== "comision" || !advisorId || !projectId) return undefined;
    return configs?.find((c) => c.advisor_id === advisorId && c.project_id === projectId);
  }, [configs, advisorId, projectId, mode]);

  // Autocompletar porcentaje cuando se selecciona el asesor + proyecto configurado
  useEffect(() => {
    if (mode === "comision" && config && !isEditing) {
      setPercent(String(config.commission_percent));
    }
  }, [config, mode, isEditing]);

  // Al elegir un contrato, autocompletar asesor, proyecto y base
  useEffect(() => {
    if (mode !== "comision" || !contractId) return;
    const contract = contracts?.find((c) => c.id === contractId);
    if (!contract) return;
    if (contract.project_id) setProjectId(contract.project_id);
    if (contract.advisor_id) setAdvisorId(contract.advisor_id);
    if (contract.total_price) setBaseAmount(String(contract.total_price));
  }, [contractId, contracts, mode]);

  const computedAmount = useMemo(() => {
    if (mode !== "comision") return null;
    const base = toNum(baseAmount);
    const pct = toNum(percent);
    if (base == null || pct == null) return null;
    return (base * pct) / 100;
  }, [mode, baseAmount, percent]);

  const availableContracts = useMemo(() => {
    if (!contracts) return [];
    let list = contracts;
    if (projectId) list = list.filter((c) => c.project_id === projectId);
    return list;
  }, [contracts, projectId]);

  const save = () => {
    const base = toNum(baseAmount);
    const pct = toNum(percent);
    const amt = toNum(amount) ?? (mode === "comision" ? computedAmount : undefined);
    const payload: PaymentFormPayload = {
      payment_type: mode,
      advisor_id: advisorId || null,
      project_id: mode === "comision" ? projectId || null : null,
      contract_id: mode === "comision" ? contractId || null : null,
      base_amount: mode === "comision" ? base : null,
      percent_applied: mode === "comision" ? pct : null,
      amount: amt,
      concept: concept || undefined,
      payment_period: mode === "mensualidad" ? period || null : null,
      notes: notes || undefined,
    };
    onSave(payload);
  };

  const title = mode === "comision" ? (isEditing ? "Editar comisión" : "Nueva comisión") : (isEditing ? "Editar mensualidad" : "Nueva mensualidad");

  return (
    <Modal open={open} onClose={onClose} title={title} wide={mode === "comision"}>
      <div className="space-y-4 p-6">
        <Field label="Asesor">
          <Select value={advisorId} onChange={(e) => setAdvisorId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Selecciona un asesor</option>
            {advisors?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.is_external ? "(externo)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        {mode === "comision" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Proyecto">
                <Select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Sin proyecto</option>
                  {projects?.map((p) => (
                    <option key={p.id} value={p.id}>{p.short_name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Contrato (opcional)" hint="Al elegir un contrato se autocompleta el asesor, proyecto y monto base.">
                <Select value={contractId} onChange={(e) => setContractId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Sin contrato</option>
                  {availableContracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contract_number}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Monto base (S/)" hint={config ? `% configurado para este asesor/proyecto: ${config.commission_percent}%` : "Base sobre la que se calcula la comisión."}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Porcentaje de comisión (%)">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  placeholder="Ej: 3.5"
                />
              </Field>
            </div>

            <Field label="Monto a pagar (S/)" hint={computedAmount != null ? `Calculado: ${formatMoney(computedAmount)}` : "Se calcula automáticamente o indícalo manualmente."}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Período" hint="Mes al que corresponde la mensualidad.">
                <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
              </Field>
              <Field label="Monto (S/)" hint={advisor?.base_salary != null ? `Sueldo base del asesor: ${formatMoney(advisor.base_salary)}` : "Indica el monto o configura el sueldo base del asesor."}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </div>
          </>
        )}

        <Field label={mode === "comision" ? "Concepto" : "Concepto (opcional)"}>
          <Input
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder={mode === "comision" ? "Comisión - {proyecto}" : `Mensualidad ${period}`}
          />
        </Field>

        <Field label="Notas">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones (opcional)..." />
        </Field>

        {existingCommission && existingCommission.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold">El contrato seleccionado ya tiene una comisión registrada.</p>
            <p className="mt-1">
              {existingCommission.find((c) => c.origin === "auto")
                ? "Fue generada automáticamente al registrar la venta. Crear otra aquí generará un duplicado; verifica antes de continuar."
                : "Revisa el módulo de comisiones antes de continuar; crearla generará un duplicado."}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={isSubmitting}>
            {isEditing ? "Guardar cambios" : "Crear registro"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}