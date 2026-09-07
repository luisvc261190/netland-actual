import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { Button, Field, Input, Select } from "../../admin/ui";
import { Modal } from "../../../components/ui/Modal";
import { VoucherUploader, VoucherFile } from "../../../components/ui/VoucherUploader";
import { useToast } from "../../../components/ui/Toast";
import { Loader2 } from "lucide-react";
import type { ClientInfo as Client, Project } from "../../../types";
import { PERSON_TYPES, DOCUMENT_TYPES, formatSoles } from "../constants";
import ClientSelect from "./ClientSelect";

interface LotInfo {
  id: number;
  code: string;
  block_code: string | null;
  area_m2: number | null;
  price_per_m2: number | null;
  price: number | null;
  normal_price_soles: number | null;
  status: string;
}

interface SaleForm {
  client_id: string;
  person_type: "natural" | "juridica";
  document_type: string;
  document_number: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string;
  business_name: string;
  secondary_phone: string;
  project_id: string;
  lot_id: string;
  area_m2: string;
  price_per_m2: string;
  total_price: string;
  contract_date: string;
  start_date: string;
  modality: string;
  initial_payment: string;
  installments: string;
  first_installment_date: string;
  notes: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyForm: SaleForm = {
  client_id: "",
  person_type: "natural",
  document_type: "DNI",
  document_number: "",
  first_name: "",
  paternal_surname: "",
  maternal_surname: "",
  business_name: "",
  secondary_phone: "",
  project_id: "",
  lot_id: "",
  area_m2: "",
  price_per_m2: "",
  total_price: "",
  contract_date: todayISO(),
  start_date: todayISO(),
  modality: "financiado",
  initial_payment: "0",
  installments: "12",
  first_installment_date: todayISO(),
  notes: "",
};

interface NewSaleModalProps {
  open: boolean;
  onClose: () => void;
}

export default function NewSaleModal({ open, onClose }: NewSaleModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<SaleForm>(emptyForm);
  const [vouchers, setVouchers] = useState<VoucherFile[]>([]);
  const [esquinaEnabled, setEsquinaEnabled] = useState(false);
  const [esquinaSurcharge, setEsquinaSurcharge] = useState(0);
  const [frenteParqueEnabled, setFrenteParqueEnabled] = useState(false);
  const [frenteParqueSurcharge, setFrenteParqueSurcharge] = useState(0);
  const [frentePistaEnabled, setFrentePistaEnabled] = useState(false);
  const [frentePistaSurcharge, setFrentePistaSurcharge] = useState(0);
  const [discountType, setDiscountType] = useState<"none" | "percentage" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState(0);

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setVouchers([]);
      setEsquinaEnabled(false);
      setEsquinaSurcharge(0);
      setFrenteParqueEnabled(false);
      setFrenteParqueSurcharge(0);
      setFrentePistaEnabled(false);
      setFrentePistaSurcharge(0);
      setDiscountType("none");
      setDiscountValue(0);
    }
  }, [open]);

  const setSelected = (patch: Partial<SaleForm>) => setForm((f) => ({ ...f, ...patch }));

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<Client[]>("/clients", true),
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<Project[]>("/projects", true),
  });

  const projectId = form.project_id ? Number(form.project_id) : null;

  const { data: availableLots } = useQuery({
    queryKey: ["lots-available", projectId],
    queryFn: () =>
      api.get<LotInfo[]>(`/projects/${projectId}/lots?status=available`, true),
    enabled: !!projectId,
  });

  const selectedClient = clients?.find((c) => String(c.id) === String(form.client_id));

  const saleMutation = useMutation({
    mutationFn: (payload: unknown) => api.post<{ contract_number?: string }>("/sales", payload, true),
    onSuccess: (res, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      queryClient.invalidateQueries({ queryKey: ["lots-available"] });
      
      // Mensaje de éxito con información de vouchers
      let successMessage = res.contract_number
        ? `Venta registrada · Contrato ${res.contract_number}`
        : "Venta registrada";
      
      if (variables.initial_vouchers && variables.initial_vouchers.length > 0) {
        successMessage += ` · ${variables.initial_vouchers.length} voucher${variables.initial_vouchers.length > 1 ? 's' : ''} subido${variables.initial_vouchers.length > 1 ? 's' : ''} correctamente`;
      }
      
      toast(successMessage);
      setForm(emptyForm);
      setVouchers([]);
      onClose();
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const handleClientChange = (client: Client | null) => {
    if (!client) {
      setSelected({ client_id: "" });
      return;
    }
    const nameParts = (client.name || "").split(/\s+/).filter(Boolean);
    const lastParts = (client.last_name || "").split(/\s+/).filter(Boolean);

    const paternal =
      lastParts.length >= 2 ? lastParts.slice(0, lastParts.length - 1).join(" ") : "";
    const maternal = lastParts.length >= 2 ? lastParts[lastParts.length - 1] : "";

    setSelected({
      client_id: String(client.id),
      first_name: nameParts.join(" "),
      paternal_surname: lastParts.length === 1 ? lastParts[0] : paternal,
      maternal_surname: lastParts.length === 1 ? "" : maternal,
      business_name: [client.name, client.last_name].filter(Boolean).join(" ").trim(),
      secondary_phone: client.phone || client.whatsapp || "",
    });
  };

  const handleLotChange = (lotId: string) => {
    setSelected({ lot_id: lotId });
    const lot = availableLots?.find((l) => String(l.id) === String(lotId));
    if (!lot) return;
    const area = lot.area_m2 ?? 0;
    const computed =
      lot.normal_price_soles ??
      lot.price ??
      (area && lot.price_per_m2 ? area * lot.price_per_m2 : 0);
    setSelected({
      lot_id: lotId,
      area_m2: area ? String(area) : "",
      price_per_m2:
        lot.price_per_m2 != null
          ? String(lot.price_per_m2)
          : area
            ? String(Number(computed) / area)
            : "",
      total_price: computed ? String(Number(computed)) : "",
    });
  };

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelected({ project_id: e.target.value, lot_id: "" });
  };

  const handleAreaChange = (value: string) => {
    const area = Number(value) || 0;
    const ppm = Number(form.price_per_m2) || 0;
    setSelected({
      area_m2: value,
      total_price:
        area > 0 && ppm > 0
          ? String(Math.round(area * ppm * 100) / 100)
          : form.total_price,
    });
  };

  const handlePricePerM2Change = (value: string) => {
    const ppm = Number(value) || 0;
    const area = Number(form.area_m2) || 0;
    setSelected({
      price_per_m2: value,
      total_price:
        area > 0 && ppm > 0
          ? String(Math.round(area * ppm * 100) / 100)
          : form.total_price,
    });
  };

  const handleStartDateChange = (value: string) => {
    setForm((f) => ({
      ...f,
      start_date: value,
      first_installment_date:
        f.first_installment_date === f.start_date ? value : f.first_installment_date,
    }));
  };

  const contactPhone = form.secondary_phone || selectedClient?.phone || selectedClient?.whatsapp || "";

  const baseLotPrice = Number(form.total_price) || 0;
  const esquinaValue = esquinaEnabled ? Number(esquinaSurcharge) || 0 : 0;
  const frenteParqueValue = frenteParqueEnabled ? Number(frenteParqueSurcharge) || 0 : 0;
  const frentePistaValue = frentePistaEnabled ? Number(frentePistaSurcharge) || 0 : 0;
  const lotPrice = baseLotPrice + esquinaValue + frenteParqueValue + frentePistaValue;
  const totalDiscount =
    discountType === "percentage"
      ? lotPrice * ((Number(discountValue) || 0) / 100)
      : discountType === "fixed"
        ? Number(discountValue) || 0
        : 0;
  const finalPrice = Math.max(lotPrice - totalDiscount, 0);
  const totalPrice = finalPrice;
  const initialPayment = Number(form.initial_payment) || 0;
  const numInstallments = Number(form.installments) || 0;
  const financedBalance = Math.max(totalPrice - initialPayment, 0);
  const monthlyPayment =
    form.modality === "financiado" && numInstallments > 0
      ? financedBalance / numInstallments
      : 0;

  const submit = async () => {
    if (!form.document_number.trim()) {
      toast("El número de documento del comprador es obligatorio", "error");
      return;
    }
    if (form.document_number.trim().length < 8) {
      toast("El número de documento debe tener al menos 8 caracteres", "error");
      return;
    }
    if (form.person_type === "natural" && !form.first_name.trim()) {
      toast("El nombre del comprador es obligatorio para persona natural", "error");
      return;
    }
    if (form.person_type === "juridica" && !form.business_name.trim()) {
      toast("La razón social es obligatoria para persona jurídica", "error");
      return;
    }
    if (!form.project_id) {
      toast("Selecciona el proyecto del terreno", "error");
      return;
    }
    if (!form.lot_id) {
      toast("Selecciona el lote a vender", "error");
      return;
    }
    if (!(Number(form.area_m2) > 0) || !(baseLotPrice > 0)) {
      toast("El área y el precio total del lote son obligatorios", "error");
      return;
    }
    if (
      form.modality === "financiado" &&
      Number(form.initial_payment) >= totalPrice
    ) {
      toast("La cuota inicial debe ser menor al precio total", "error");
      return;
    }

    // Mostrar notificación si hay vouchers
    if (vouchers.length > 0) {
      toast(`Procesando venta y subiendo ${vouchers.length} voucher${vouchers.length > 1 ? 's' : ''}...`, "info");
    }

    const payload: Record<string, unknown> = {
      client_id: form.client_id ? Number(form.client_id) : undefined,
      client_phone: contactPhone || null,
      client_whatsapp: selectedClient?.whatsapp || contactPhone || null,
      client_email: selectedClient?.email || null,
      person_type: form.person_type,
      document_type: form.document_type,
      document_number: form.document_number.trim(),
      secondary_phone: form.secondary_phone || null,
      project_id: Number(form.project_id),
      lot_id: Number(form.lot_id),
      contract_date: form.contract_date,
      start_date: form.start_date,
      lot_area_m2: Number(form.area_m2),
      price_per_m2: Number(form.price_per_m2) || null,
      total_price: totalPrice,
      payment_modality: form.modality,
      initial_payment: Number(form.initial_payment) || 0,
      number_of_installments: Number(form.installments) || 12,
      first_installment_date: form.first_installment_date || null,
      esquina_surcharge: esquinaValue,
      frente_parque_surcharge: frenteParqueValue,
      frente_a_pista_surcharge: frentePistaValue,
      discount_type: discountType,
      discount_value: Number(discountValue) || 0,
      notes: form.notes || null,
    };

    if (form.person_type === "natural") {
      payload.first_name = form.first_name || null;
      payload.paternal_surname = form.paternal_surname || null;
      payload.maternal_surname = form.maternal_surname || null;
    } else {
      payload.business_name = form.business_name || null;
    }

    // Procesar vouchers si existen
    if (vouchers.length > 0) {
      try {
        const vouchersWithData = await Promise.all(
          vouchers.map(async (v) => {
            // Convertir archivo a base64
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error("Error al leer el archivo"));
              reader.readAsDataURL(v.file);
            });

            return {
              amount: parseFloat(v.amount) || 0,
              payment_date: v.date,
              file_data: base64,
              file_name: v.file.name,
            };
          })
        );

        payload.initial_vouchers = vouchersWithData.filter((v) => v.amount > 0);
      } catch (error) {
        toast("Error al procesar los vouchers. Por favor, inténtalo de nuevo.", "error");
        return;
      }
    }

    saleMutation.mutate(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva Venta" wide>
      <div className="grid gap-4 p-6 sm:grid-cols-2">
        {/* ================= Comprador ================= */}
        <div className="sm:col-span-2">
          <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-netland-primary">
            1 · Comprador
          </h4>
          <p className="mb-4 text-xs text-netland-muted">
            Selecciona un cliente existente (se reutilizan sus datos) o completa
            los datos de la persona que adquiere el terreno.
          </p>
        </div>

        <Field label="Cliente (opcional)" className="sm:col-span-2">
          <ClientSelect
            clients={clients}
            value={form.client_id}
            onChange={handleClientChange}
          />
          {form.client_id && (
            <span className="mt-1 block text-xs text-netland-primary">
              Datos del cliente copiados al formulario. Si el propietario ya
              existe por documento, se reutilizará.
            </span>
          )}
        </Field>

        <Field label="Tipo de Persona">
          <Select
            value={form.person_type}
            onChange={(e) =>
              setSelected({ person_type: e.target.value as "natural" | "juridica" })
            }
          >
            {Object.entries(PERSON_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tipo de Documento">
          <Select
            value={form.document_type}
            onChange={(e) => setSelected({ document_type: e.target.value })}
          >
            {Object.entries(DOCUMENT_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Número de Documento" className="sm:col-span-2">
          <Input
            value={form.document_number}
            onChange={(e) => setSelected({ document_number: e.target.value })}
            placeholder="12345678"
          />
        </Field>

        {form.person_type === "natural" ? (
          <>
            <Field label="Nombres">
              <Input
                value={form.first_name}
                onChange={(e) => setSelected({ first_name: e.target.value })}
              />
            </Field>
            <Field label="Apellido Paterno">
              <Input
                value={form.paternal_surname}
                onChange={(e) => setSelected({ paternal_surname: e.target.value })}
              />
            </Field>
            <Field label="Apellido Materno">
              <Input
                value={form.maternal_surname}
                onChange={(e) => setSelected({ maternal_surname: e.target.value })}
              />
            </Field>
          </>
        ) : (
          <Field label="Razón Social" className="sm:col-span-2">
            <Input
              value={form.business_name}
              onChange={(e) => setSelected({ business_name: e.target.value })}
            />
          </Field>
        )}

        <Field label="Teléfono / WhatsApp" className="sm:col-span-2">
          <Input
            value={form.secondary_phone}
            onChange={(e) => setSelected({ secondary_phone: e.target.value })}
            placeholder="999 999 999"
          />
        </Field>

        {/* ================= Terreno ================= */}
        <div className="sm:col-span-2 border-t border-netland-light pt-5">
          <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-netland-primary">
            2 · Terreno
          </h4>
          <p className="mb-4 text-xs text-netland-muted">
            Selecciona el proyecto y el lote; el área y los precios se completan
            automáticamente desde el lote.
          </p>
        </div>

        <Field label="Proyecto" className="sm:col-span-2">
          <Select value={form.project_id} onChange={handleProjectChange}>
            <option value="">Seleccionar proyecto...</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.short_name || p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Lote disponible" className="sm:col-span-2">
          <Select value={form.lot_id} onChange={(e) => handleLotChange(e.target.value)}>
            <option value="">Seleccionar lote...</option>
            {availableLots?.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.block_code ? `${lot.block_code} · ` : ""}
                {lot.code} · {lot.area_m2 ?? "—"} m² ·{" "}
                {formatSoles(lot.normal_price_soles ?? lot.price)}
              </option>
            ))}
          </Select>
          {projectId && availableLots?.length === 0 && (
            <span className="mt-1 block text-xs text-netland-muted">
              Este proyecto no tiene lotes disponibles.
            </span>
          )}
        </Field>

        {form.lot_id && (
          <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3">
            <Field label="Área (m²)">
              <Input
                type="number"
                min="0"
                step="any"
                value={form.area_m2}
                onChange={(e) => handleAreaChange(e.target.value)}
              />
            </Field>
            <Field label="Precio por m² (S/)">
              <Input
                type="number"
                min="0"
                step="any"
                value={form.price_per_m2}
                onChange={(e) => handlePricePerM2Change(e.target.value)}
                placeholder="Ej: 415"
              />
              <span className="mt-1 block text-xs text-netland-muted">
                El precio total se calcula automáticamente.
              </span>
            </Field>
            <Field label="Precio total (S/)">
              <Input
                type="number"
                min="0"
                step="any"
                value={totalPrice > 0 ? String(totalPrice) : ""}
                readOnly
                className="!bg-netland-background/60 text-netland-primary font-semibold"
              />
            </Field>
          </div>
        )}

        {form.lot_id && baseLotPrice > 0 && (
          <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1 rounded-lg border border-netland-light p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-netland-dark">
                <input
                  type="checkbox"
                  checked={esquinaEnabled}
                  onChange={(e) => setEsquinaEnabled(e.target.checked)}
                />
                En esquina (S/)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={esquinaSurcharge}
                disabled={!esquinaEnabled}
                onChange={(e) => setEsquinaSurcharge(e.target.value ? Number(e.target.value) : 0)}
                className="!py-1"
              />
            </div>
            <div className="grid gap-1 rounded-lg border border-netland-light p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-netland-dark">
                <input
                  type="checkbox"
                  checked={frenteParqueEnabled}
                  onChange={(e) => setFrenteParqueEnabled(e.target.checked)}
                />
                Frente a parque (S/)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={frenteParqueSurcharge}
                disabled={!frenteParqueEnabled}
                onChange={(e) => setFrenteParqueSurcharge(e.target.value ? Number(e.target.value) : 0)}
                className="!py-1"
              />
            </div>
            <div className="grid gap-1 rounded-lg border border-netland-light p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-netland-dark">
                <input
                  type="checkbox"
                  checked={frentePistaEnabled}
                  onChange={(e) => setFrentePistaEnabled(e.target.checked)}
                />
                Frente a pista (S/)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={frentePistaSurcharge}
                disabled={!frentePistaEnabled}
                onChange={(e) => setFrentePistaSurcharge(e.target.value ? Number(e.target.value) : 0)}
                className="!py-1"
              />
            </div>
          </div>
        )}

        {form.lot_id && baseLotPrice > 0 && (
          <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de descuento">
              <Select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "none" | "percentage" | "fixed")}
              >
                <option value="none">Sin descuento</option>
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed">Monto fijo (S/)</option>
              </Select>
            </Field>
            <Field label={discountType === "percentage" ? "Descuento (%)" : "Descuento (S/)"}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discountValue}
                disabled={discountType === "none"}
                onChange={(e) => setDiscountValue(e.target.value ? Number(e.target.value) : 0)}
              />
            </Field>
          </div>
        )}

        {/* ================= Condiciones ================= */}
        <div className="sm:col-span-2 border-t border-netland-light pt-5">
          <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-netland-primary">
            3 · Condiciones del contrato
          </h4>
        </div>

        <Field label="Modalidad de pago">
          <Select
            value={form.modality}
            onChange={(e) => setSelected({ modality: e.target.value })}
          >
            <option value="financiado">Financiado</option>
            <option value="contado">Al Contado</option>
          </Select>
        </Field>

        <Field label="Fecha del contrato">
          <Input
            type="date"
            value={form.contract_date}
            onChange={(e) => setSelected({ contract_date: e.target.value })}
          />
        </Field>

        <Field label="Fecha de inicio">
          <Input
            type="date"
            value={form.start_date}
            onChange={(e) => handleStartDateChange(e.target.value)}
          />
        </Field>

        {form.modality === "financiado" && (
          <>
            <Field label="Cuota inicial (S/)" className="sm:col-span-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.initial_payment}
                onChange={(e) => setSelected({ initial_payment: e.target.value })}
                placeholder="0.00"
              />
            </Field>

            {/* Voucher Uploader para pago inicial */}
            {Number(form.initial_payment) > 0 && (
              <div className="sm:col-span-2 space-y-2">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs text-blue-800">
                    💡 <span className="font-semibold">Opcional:</span> Puedes subir los vouchers de pago ahora o después desde el módulo de <span className="font-semibold">Pagos</span>. Los vouchers que subas aquí aparecerán en el detalle del contrato.
                  </p>
                </div>
                <VoucherUploader
                  vouchers={vouchers}
                  onChange={setVouchers}
                  totalAmount={Number(form.initial_payment)}
                  label="Vouchers del Pago Inicial (Opcional)"
                  description="Puedes subir los vouchers ahora o después desde el módulo de Pagos"
                />
              </div>
            )}

            <Field label="Número de cuotas">
              <Select
                value={form.installments}
                onChange={(e) => setSelected({ installments: e.target.value })}
              >
                {[6, 12, 18, 24, 36, 48, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} meses
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Primera cuota">
              <Input
                type="date"
                value={form.first_installment_date}
                onChange={(e) => setSelected({ first_installment_date: e.target.value })}
              />
            </Field>

            <div className="sm:col-span-2 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-netland-background/60 p-4">
                <p className="text-xs text-netland-muted">Saldo a financiar</p>
                <p className="font-display text-lg font-semibold text-netland-primary">
                  {formatSoles(financedBalance)}
                </p>
              </div>
              <div className="rounded-xl bg-netland-background/60 p-4">
                <p className="text-xs text-netland-muted">Cuota mensual</p>
                <p className="font-display text-lg font-semibold text-netland-primary">
                  {formatSoles(monthlyPayment)}
                </p>
              </div>
            </div>
          </>
        )}

        <Field label="Observaciones" className="sm:col-span-2">
          <Input
            value={form.notes}
            onChange={(e) => setSelected({ notes: e.target.value })}
            placeholder="Notas sobre la venta (opcional)"
          />
        </Field>

        <div className="sm:col-span-2 rounded-xl border border-netland-light bg-netland-background/60 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-netland-muted">Precio base</span>
            <span className="font-medium text-netland-dark">{formatSoles(baseLotPrice)}</span>
          </div>
          {(esquinaValue > 0 || frenteParqueValue > 0 || frentePistaValue > 0) && (
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-netland-muted">Recargos</span>
              <span className="font-medium text-netland-dark">
                +{formatSoles(esquinaValue + frenteParqueValue + frentePistaValue)}
              </span>
            </div>
          )}
          {totalDiscount > 0 && (
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-netland-muted">Descuento</span>
              <span className="font-medium text-orange-600">-{formatSoles(totalDiscount)}</span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-netland-light pt-2 text-sm">
            <span className="text-netland-muted">Total de la venta</span>
            <span className="font-display text-xl font-semibold text-netland-primary">
              {formatSoles(totalPrice)}
            </span>
          </div>
          <p className="mt-1 text-xs text-netland-muted">
            Al registrar la venta se crea el contrato CTR-XXXXX, el propietario
            titular y el lote queda marcado como vendido.
          </p>
        </div>

        <div className="flex justify-end gap-3 sm:col-span-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saleMutation.isPending}>
            {saleMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              "Registrar venta"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}