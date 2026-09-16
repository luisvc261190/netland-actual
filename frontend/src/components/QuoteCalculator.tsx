import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Calculator, CheckCircle2, Download } from "lucide-react";
import type { Lot, Project } from "../types";
import { API_URL, formatSoles } from "../lib/constants";
import { useLeadForm } from "../features/leads/useLeadForm";
import { validateName, validatePhone, validateEmail } from "../lib/validations";

interface QuoteCalculatorProps {
  project: Project;
  lots: Lot[];
  initialLotId?: number | null;
}

type NumericFieldValue = number | "";

export function QuoteCalculator({
  project,
  lots,
  initialLotId,
}: QuoteCalculatorProps) {
  const availableLots = useMemo(
    () => lots.filter((l) => l.status === "available"),
    [lots]
  );

  const [lotId, setLotId] = useState<number | "">(
    initialLotId ?? ""
  );

  /**
   * Puede ser:
   * 0     → muestra cero
   * ""    → temporalmente vacío mientras el usuario escribe
   * número → valor ingresado
   */
  const [pricePerM2, setPricePerM2] =
    useState<NumericFieldValue>(0);

  const [initial, setInitial] =
    useState<NumericFieldValue>(0);

  const [installments, setInstallments] = useState(24);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    last_name: "",
    phone: "",
    email: "",
  });

  const [formErrors, setFormErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
  }>({});

  const formIsValid =
    !validateName(formData.name) && !validatePhone(formData.phone);

  const updateForm = (key: keyof typeof formData, value: string) => {
    const next = { ...formData, [key]: value };
    setFormData(next);
    const errs: typeof formErrors = {};
    if (key === "name") errs.name = validateName(value) ?? undefined;
    if (key === "phone") {
      const digits = value.replace(/\D/g, "");
      errs.phone = validatePhone(digits) ?? undefined;
    }
    if (key === "email") errs.email = validateEmail(value) ?? undefined;
    setFormErrors(errs);
  };

  const { submit, submitting, submitted } = useLeadForm();

  // ============================================================
  // LOTE SELECCIONADO
  // ============================================================

  const selectedLot = useMemo(
    () => availableLots.find((l) => l.id === lotId),
    [availableLots, lotId]
  );

  // ============================================================
  // SINCRONIZAR LOTE INICIAL
  // ============================================================

  useEffect(() => {
    if (initialLotId != null) {
      setLotId(initialLotId);
    }
  }, [initialLotId]);

  // ============================================================
  // VALORES NUMÉRICOS PARA CÁLCULOS
  // ============================================================

  const numericPricePerM2 = Number(pricePerM2) || 0;
  const numericInitial = Number(initial) || 0;

  // ============================================================
  // CÁLCULO DEL PRECIO
  // ============================================================

  const price =
    selectedLot &&
    selectedLot.area_m2 &&
    numericPricePerM2 > 0
      ? selectedLot.area_m2 * numericPricePerM2
      : selectedLot?.promo_price ??
        selectedLot?.price ??
        0;

  const balance = Math.max(
    price - numericInitial,
    0
  );

  const installmentValue =
    installments > 0
      ? balance / installments
      : 0;

  // ============================================================
  // PRECIO POR M²
  // ============================================================

  const handlePriceFocus = () => {
    if (pricePerM2 === 0) {
      setPricePerM2("");
    }
  };

  const handlePriceChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;

    setPricePerM2(
      value === "" ? "" : Number(value)
    );
  };

  const handlePriceBlur = () => {
    if (pricePerM2 === "") {
      setPricePerM2(0);
    }
  };

  // ============================================================
  // INICIAL
  // ============================================================

  const handleInitialFocus = () => {
    if (initial === 0) {
      setInitial("");
    }
  };

  const handleInitialChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;

    setInitial(
      value === "" ? "" : Number(value)
    );
  };

  const handleInitialBlur = () => {
    if (initial === "") {
      setInitial(0);
    }
  };

  // ============================================================
  // SOLICITAR COTIZACIÓN
  // ============================================================

  const handleRequest = async () => {
    if (!selectedLot) return;

    if (!formIsValid) {
      alert("Revisa los campos marcados en rojo antes de enviar.");
      return;
    }

    await submit({
      name: formData.name.trim(),
      last_name: formData.last_name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || null,
      message: `Solicito cotización del lote ${
        selectedLot.code
      } (inicial S/ ${numericInitial}, ${installments} cuotas).`,
      project_id: project.id,
      lot_id: selectedLot.id,
      budget: price,
      source: "cotizador",
    });
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* ========================================================
          FORMULARIO
      ======================================================== */}

      <div className="space-y-5">
        {/* SELECCIÓN DE LOTE */}
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-netland-muted">
            Selecciona tu lote
          </span>

          <select
            value={lotId}
            onChange={(event) => {
              const id = event.target.value
                ? Number(event.target.value)
                : "";

              setLotId(id);

              const lot = availableLots.find(
                (l) => l.id === id
              );

              setPricePerM2(
                lot?.price_per_m2
                  ? Number(lot.price_per_m2)
                  : 0
              );
            }}
            className="w-full rounded-sm border border-netland-light bg-white px-4 py-3 text-sm outline-none focus:border-netland-primary"
          >
            <option value="">
              Elige un lote disponible...
            </option>

            {availableLots.map((lot) => (
              <option
                key={lot.id}
                value={lot.id}
              >
                {lot.code} — {lot.area_m2} m²
              </option>
            ))}
          </select>
        </label>

        {/* PRECIO POR M² */}
        {selectedLot && selectedLot.area_m2 && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-netland-muted">
              Precio por m² (S/)
            </span>

            <input
              type="number"
              min={0}
              value={pricePerM2}
              onFocus={handlePriceFocus}
              onChange={handlePriceChange}
              onBlur={handlePriceBlur}
              className="w-full rounded-sm border border-netland-light bg-white px-4 py-3 text-sm outline-none focus:border-netland-primary"
            />
          </label>
        )}

        {/* INICIAL */}
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-netland-muted">
            Inicial (S/)
          </span>

          <input
            type="number"
            min={0}
            value={initial}
            onFocus={handleInitialFocus}
            onChange={handleInitialChange}
            onBlur={handleInitialBlur}
            className="w-full rounded-sm border border-netland-light bg-white px-4 py-3 text-sm outline-none focus:border-netland-primary"
          />
        </label>

        {/* NÚMERO DE CUOTAS */}
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-netland-muted">
            Número de cuotas
          </span>

          <select
            value={installments}
            onChange={(event) =>
              setInstallments(
                Number(event.target.value)
              )
            }
            className="w-full rounded-sm border border-netland-light bg-white px-4 py-3 text-sm outline-none focus:border-netland-primary"
          >
            {[6, 12, 18, 24, 36, 48, 60].map(
              (number) => (
                <option
                  key={number}
                  value={number}
                >
                  {number} cuotas
                </option>
              )
            )}
          </select>
        </label>
      </div>

      {/* ========================================================
          RESUMEN
      ======================================================== */}

      <div className="flex flex-col rounded-lg bg-netland-dark p-6 text-white">
        <div className="mb-4 flex items-center gap-2 text-netland-accent">
          <Calculator className="h-5 w-5" />

          <span className="text-xs font-semibold uppercase tracking-[0.25em]">
            Resumen de inversión
          </span>
        </div>

        {!selectedLot ? (
          <p className="py-10 text-center text-sm text-white/60">
            Selecciona un lote para calcular tu inversión.
          </p>
        ) : (
          <>
            <dl className="space-y-3 text-sm">
              <Row
                label="Lote"
                value={selectedLot.code}
              />

              <Row
                label="Área"
                value={`${selectedLot.area_m2} m²`}
              />

              <Row
                label="Precio del lote"
                value={formatSoles(price)}
                highlight
              />

              <Row
                label="Inicial"
                value={formatSoles(
                  numericInitial
                )}
              />

              <Row
                label="Saldo a financiar"
                value={formatSoles(balance)}
              />

              <Row
                label="Cuotas"
                value={`${installments}`}
              />

              <Row
                label="Valor de cuota"
                value={formatSoles(
                  installmentValue
                )}
                bold
              />
            </dl>

            {/* SOLICITUD ENVIADA */}
            {submitted ? (
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2 rounded-md bg-white/10 px-4 py-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-netland-accent" />

                  Solicitud de cotización enviada.
                </div>

                <p className="text-xs text-white/70">
                  Un asesor de Netland se contactará
                  contigo muy pronto para enviarte la
                  cotización detallada del lote{" "}
                  {selectedLot.code}.
                </p>
              </div>
            ) : !showForm ? (
              <button
                type="button"
                onClick={() =>
                  setShowForm(true)
                }
                disabled={submitting}
                className="btn-accent mt-6 w-full"
              >
                Quiero esta cotización
              </button>
            ) : (
              <div className="mt-6 space-y-3">
                <p className="text-xs text-white/80">
                  Ingresa tus datos para recibir la
                  cotización:
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {/* NOMBRE */}
                  <div>
                    <input
                      type="text"
                      placeholder="Nombre *"
                      value={formData.name}
                      onChange={(event) =>
                        updateForm(
                          "name",
                          event.target.value
                        )
                      }
                      className={`rounded-sm border bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 outline-none focus:border-netland-accent ${
                        formErrors.name
                          ? "border-red-400"
                          : "border-white/20"
                      }`}
                      required
                    />
                    {formErrors.name && (
                      <p className="mt-1 text-xs text-red-400">
                        {formErrors.name}
                      </p>
                    )}
                  </div>

                  {/* APELLIDOS */}
                  <input
                    type="text"
                    placeholder="Apellidos"
                    value={formData.last_name}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        last_name:
                          event.target.value,
                      })
                    }
                    className="rounded-sm border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 outline-none focus:border-netland-accent"
                  />
                </div>

                {/* TELÉFONO */}
                <div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Teléfono / WhatsApp *"
                    value={formData.phone}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, "");
                      updateForm("phone", digits.slice(0, 9));
                    }}
                    className={`w-full rounded-sm border bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 outline-none focus:border-netland-accent ${
                      formErrors.phone
                        ? "border-red-400"
                        : "border-white/20"
                    }`}
                    required
                  />
                  {formErrors.phone && (
                    <p className="mt-1 text-xs text-red-400">
                      {formErrors.phone}
                    </p>
                  )}
                </div>

                {/* EMAIL */}
                <div>
                  <input
                    type="email"
                    placeholder="Email (opcional)"
                    value={formData.email}
                    onChange={(event) =>
                      updateForm("email", event.target.value)
                    }
                    className={`w-full rounded-sm border bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 outline-none focus:border-netland-accent ${
                      formErrors.email
                        ? "border-red-400"
                        : "border-white/20"
                    }`}
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-xs text-red-400">
                      {formErrors.email}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {/* ENVIAR */}
                  <button
                    type="button"
                    onClick={handleRequest}
                    disabled={
                      submitting ||
                      !formIsValid
                    }
                    className="btn-accent flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting
                      ? "Enviando..."
                      : "Enviar solicitud"}
                  </button>

                  {/* CANCELAR */}
                  <button
                    type="button"
                    onClick={() =>
                      setShowForm(false)
                    }
                    className="rounded-sm border border-white/20 px-4 text-sm text-white/80 hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                </div>

                <p className="text-xs text-white/50">
                  * Campos requeridos
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ================================================================
// ROW
// ================================================================

function Row({
  label,
  value,
  highlight,
  bold,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-white/60">
        {label}
      </dt>

      <dd
        className={`${
          highlight
            ? "text-netland-accent"
            : ""
        } ${
          bold
            ? "font-semibold"
            : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

// ================================================================
// DESCARGAR PDF
// ================================================================

export function QuoteDownloadButton({
  quoteId,
}: {
  quoteId: number;
}) {
  const {
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["quote-pdf", quoteId],

    queryFn: async ({ signal }) => {
      const token =
        localStorage.getItem(
          "netland_token"
        );

      const response = await fetch(
        `${API_URL}/quotes/${quoteId}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        }
      );

      if (!response.ok) {
        throw new Error(
          `No se pudo generar el PDF (${response.status})`
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download = `cotizacion-${quoteId}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      return true;
    },

    enabled: false,
  });

  return (
    <button
      type="button"
      onClick={() => refetch()}
      disabled={isFetching}
      className="btn-primary !py-2.5 text-xs"
    >
      <Download className="h-4 w-4" />

      {isFetching
        ? "Generando..."
        : "Descargar PDF"}
    </button>
  );
}
