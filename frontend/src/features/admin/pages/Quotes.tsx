import { useState, useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";

import { api } from "../../../lib/api";
import type {
  Quote,
  QuoteInput,
  Project,
  Lot,
  Lead,
} from "../../../types";
import {
  formatSoles,
  API_URL,
} from "../../../lib/constants";
import {
  PageHeader,
  Card,
  Table,
  Button,
  Badge,
  Pagination,
} from "../ui";
import { EmptyState } from "../../../components/ui/EmptyState";
import { CoreSpinLoader } from "../../../components/ui/CoreSpinLoader";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";

const statusColors: Record<string, string> = {
  draft: "#6b7280",
  sent: "#0891b2",
  accepted: "#16a34a",
  rejected: "#dc2626",
};

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
};

/**
 * Valor utilizado por los campos numéricos.
 *
 * number → valor real
 * ""     → campo temporalmente vacío mientras el usuario escribe
 */
type NumericFieldValue = number | "";

/**
 * Convierte un campo numérico temporal en un número seguro
 * para realizar cálculos.
 */
const toNumber = (value: NumericFieldValue): number =>
  Number(value) || 0;

// ================================================================
// ADMIN QUOTES
// ================================================================

export default function AdminQuotes() {
  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [detailQuote, setDetailQuote] =
    useState<Quote | null>(null);

  const [editingQuote, setEditingQuote] =
    useState<Quote | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const queryClient = useQueryClient();
  const { toast, confirm } = useToast();

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes-admin"],
    queryFn: () =>
      api.get<Quote[]>("/quotes", true),
  });

  const totalQuotes = quotes?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalQuotes / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedQuotes = (quotes ?? []).slice(
    startIndex,
    startIndex + pageSize
  );

  // ==============================================================
  // ELIMINAR COTIZACIÓN (físicamente)
  // ==============================================================

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      api.del(`/quotes/${id}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["quotes-admin"],
      });
      toast("Cotización eliminada.");
    },
    onError: (e) => toast(e.message, "error"),
  });

  // ==============================================================
  // DESCARGAR PDF
  // ==============================================================

  const downloadPdf = async (id: number) => {
    const token =
      localStorage.getItem("netland_token");

    const response = await fetch(
      `${API_URL}/quotes/${id}/pdf`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) return;

    const blob = await response.blob();

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = `cotizacion-${id}.pdf`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  // ==============================================================
  // ENVIAR POR WHATSAPP
  // ==============================================================

  const sendWhatsApp = (quote: Quote) => {
    const phone =
      quote.client_phone || "";

    const greeting = quote.client_name
      ? `¡Hola ${quote.client_name}!`
      : "¡Hola!";

    const message =
      `${greeting} 👋 ` +
      `Te envío la cotización ${quote.quote_number} ` +
      `del lote ${quote.lot_code} ` +
      `en ${quote.project_name}. ` +
      `Total: ${formatSoles(quote.total_amount)}. ` +
      `Para ver el PDF completo: ` +
      `${API_URL}/quotes/${quote.id}/pdf`;

    const url =
      `https://wa.me/${phone.replace(/\D/g, "")}` +
      `?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");
  };

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        subtitle="Genera cotizaciones profesionales con descuentos y planes de financiamiento."
        action={
          <Button
            onClick={() =>
              setShowCreateModal(true)
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Cotización
          </Button>
        }
      />

      {isLoading ? (
        <Card>
          <div className="py-8">
            <CoreSpinLoader />
          </div>
        </Card>
      ) : !quotes || quotes.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin cotizaciones"
            description="Crea tu primera cotización profesional para tus clientes."
          />

          <div className="flex justify-center pb-6">
            <Button
              onClick={() =>
                setShowCreateModal(true)
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear Cotización
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <Table
            headers={[
              "Número",
              "Cliente",
              "Proyecto / Lote",
              "Tipo Pago",
              "Inicial",
              "Cuotas",
              "Cuota",
              "Total",
              "Estado",
              "Acciones",
            ]}
          >
            {paginatedQuotes.map((quote) => (
              <tr
                key={quote.id}
                className="hover:bg-netland-light/30"
              >
                <td className="px-5 py-3">
                  <div className="font-semibold text-netland-dark">
                    {quote.quote_number}
                  </div>

                  <div className="text-xs text-netland-muted">
                    {quote.advisor_name || "—"}
                  </div>
                </td>

                <td className="px-5 py-3">
                  <div className="font-medium">
                    {quote.client_name ||
                      "Por confirmar"}
                  </div>

                  {quote.client_phone && (
                    <div className="text-xs text-netland-muted">
                      {quote.client_phone}
                    </div>
                  )}
                </td>

                <td className="px-5 py-3">
                  <div className="font-medium">
                    {quote.project_name ?? "—"}
                  </div>

                  <div className="text-xs text-netland-muted">
                    Lote {quote.lot_code}{" "}
                    {quote.lot_area
                      ? `· ${quote.lot_area} m²`
                      : ""}
                  </div>
                </td>

                <td className="px-5 py-3">
                  <Badge
                    color={
                      quote.payment_type === "cash"
                        ? "#059669"
                        : "#0891b2"
                    }
                  >
                    {quote.payment_type === "cash"
                      ? "Contado"
                      : "Crédito"}
                  </Badge>
                </td>

                <td className="px-5 py-3 text-sm">
                  {formatSoles(
                    quote.initial_payment
                  )}
                </td>

                <td className="px-5 py-3 text-sm">
                  {quote.installments || "—"}
                </td>

                <td className="px-5 py-3 text-sm">
                  {formatSoles(
                    quote.installment_value
                  )}
                </td>

                <td className="px-5 py-3">
                  <div className="font-bold text-netland-primary">
                    {formatSoles(
                      quote.total_amount
                    )}
                  </div>

                  {quote.discount_type !==
                    "none" &&
                    (quote.discount_value || 0) >
                      0 && (
                      <div className="text-xs text-orange-600">
                        Con descuento
                      </div>
                    )}
                </td>

                <td className="px-5 py-3">
                  <Badge
                    color={
                      statusColors[
                        quote.status
                      ] ?? "#6b7280"
                    }
                  >
                    {statusLabels[
                      quote.status
                    ] || quote.status}
                  </Badge>
                </td>

                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="!px-3 !py-1.5"
                      onClick={() =>
                        setEditingQuote(quote)
                      }
                      title="Editar cotización"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="outline"
                      className="!px-3 !py-1.5"
                      onClick={() =>
                        setDetailQuote(quote)
                      }
                      title="Ver detalles"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="outline"
                      className="!px-3 !py-1.5"
                      onClick={() =>
                        downloadPdf(quote.id)
                      }
                      title="Descargar PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>

                    {quote.client_phone && (
                      <Button
                        variant="outline"
                        className="!px-3 !py-1.5 !border-green-600 !text-green-600 hover:!bg-green-50"
                        onClick={() =>
                          sendWhatsApp(quote)
                        }
                        title="Enviar por WhatsApp"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <Button
                      variant="danger"
                      className="!px-3 !py-1.5"
                      onClick={async () => {
                        if (
                          await confirm(
                            `¿Eliminar definitivamente la cotización ${quote.quote_number}?\nEsta acción no se puede deshacer.`
                          )
                        ) {
                          deleteMutation.mutate(
                            quote.id
                          );
                        }
                      }}
                      title="Eliminar cotización"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>

          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={totalQuotes}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            unitLabel="cotizaciones"
          />
        </Card>
      )}

      {showCreateModal && (
        <CreateQuoteModal
          onClose={() =>
            setShowCreateModal(false)
          }
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: ["quotes-admin"],
            });

            setShowCreateModal(false);
          }}
        />
      )}

      {editingQuote && (
        <CreateQuoteModal
          quote={editingQuote}
          onClose={() =>
            setEditingQuote(null)
          }
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: ["quotes-admin"],
            });

            setEditingQuote(null);
            toast("Cotización actualizada.");
          }}
        />
      )}

      {detailQuote && (
        <QuoteDetailModal
          quote={detailQuote}
          onClose={() =>
            setDetailQuote(null)
          }
          onDownloadPdf={downloadPdf}
          onSendWhatsApp={sendWhatsApp}
        />
      )}
    </div>
  );
}

// ================================================================
// CREATE QUOTE MODAL
// ================================================================

function CreateQuoteModal({
  onClose,
  onSuccess,
  quote,
}: {
  onClose: () => void;
  onSuccess: () => void;
  quote?: Quote | null;
}) {
  const [selectedProjectId, setSelectedProjectId] =
    useState<number | null>(quote?.project_id ?? null);

  const [selectedLotId, setSelectedLotId] =
    useState<number | null>(quote?.lot_id ?? null);

  // ==============================================================
  // CAMPOS NUMÉRICOS
  // ==============================================================

  const [pricePerM2, setPricePerM2] =
    useState<NumericFieldValue>(
      quote?.price_per_m2
        ? Number(quote.price_per_m2)
        : 0
    );

  const [esquinaEnabled, setEsquinaEnabled] =
    useState((quote?.esquina_surcharge ?? 0) > 0);

  const [esquinaSurcharge, setEsquinaSurcharge] =
    useState<NumericFieldValue>(
      quote?.esquina_surcharge
        ? Number(quote.esquina_surcharge)
        : 0
    );

  const [frenteParqueEnabled, setFrenteParqueEnabled] =
    useState((quote?.frente_parque_surcharge ?? 0) > 0);

  const [frenteParqueSurcharge, setFrenteParqueSurcharge] =
    useState<NumericFieldValue>(
      quote?.frente_parque_surcharge
        ? Number(quote.frente_parque_surcharge)
        : 0
    );

  const [frentePistaEnabled, setFrentePistaEnabled] =
    useState((quote?.frente_a_pista_surcharge ?? 0) > 0);

  const [frentePistaSurcharge, setFrentePistaSurcharge] =
    useState<NumericFieldValue>(
      quote?.frente_a_pista_surcharge
        ? Number(quote.frente_a_pista_surcharge)
        : 0
    );

  const [discountType, setDiscountType] =
    useState<
      "none" | "percentage" | "fixed"
    >(
      quote?.discount_type === "percentage" ||
        quote?.discount_type === "fixed"
        ? quote.discount_type
        : "none"
    );

  const [discountValue, setDiscountValue] =
    useState<NumericFieldValue>(
      quote?.discount_value
        ? Number(quote.discount_value)
        : 0
    );

  const [paymentType, setPaymentType] =
    useState<"cash" | "credit">(
      quote?.payment_type === "cash"
        ? "cash"
        : "credit"
    );

  const [initialPayment, setInitialPayment] =
    useState<NumericFieldValue>(
      quote?.initial_payment
        ? Number(quote.initial_payment)
        : 0
    );

  const [installments, setInstallments] =
    useState(quote?.installments ?? 12);

  const [selectedLeadId, setSelectedLeadId] =
    useState<number | null>(quote?.lead_id ?? null);

  const [clientSearch, setClientSearch] =
    useState("");

  const [clientName, setClientName] =
    useState(quote?.client_name ?? "");

  const [clientPhone, setClientPhone] =
    useState(quote?.client_phone ?? "");

  const [clientEmail, setClientEmail] =
    useState(quote?.client_email ?? "");

  const [notes, setNotes] =
    useState(quote?.notes ?? "");

  // ==============================================================
  // DATOS
  // ==============================================================

  const { data: projects } = useQuery({
    queryKey: ["projects-for-quote"],
    queryFn: () =>
      api.get<Project[]>(
        "/projects",
        false
      ),
  });

  const { data: lots } = useQuery({
    queryKey: [
      "lots-for-quote",
      selectedProjectId,
    ],
    queryFn: () =>
      api.get<Lot[]>(
        `/projects/${selectedProjectId}/lots`,
        true
      ),
    enabled: !!selectedProjectId,
  });

  const { data: leads } = useQuery({
    queryKey: ["leads-for-quote"],
    queryFn: () =>
      api.get<Lead[]>(
        "/leads",
        true
      ),
  });

  // ==============================================================
  // CLIENTES FILTRADOS
  // ==============================================================

  const filteredLeads = useMemo(() => {
    if (!leads) return [];

    const term =
      clientSearch.trim().toLowerCase();

    if (!term) return leads;

    return leads.filter((lead) => {
      const haystack = [
        lead.client?.name,
        lead.client?.last_name,
        lead.client?.phone,
        lead.client?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [leads, clientSearch]);

  const selectedLead = leads?.find(
    (lead) =>
      lead.id === selectedLeadId
  );

  const selectedLot = lots?.find(
    (lot) =>
      lot.id === selectedLotId
  );

  // ==============================================================
  // VALORES NUMÉRICOS SEGUROS
  // ==============================================================

  const numericPricePerM2 =
    toNumber(pricePerM2);

  const numericEsquinaSurcharge =
    toNumber(esquinaSurcharge);

  const numericFrenteParqueSurcharge =
    toNumber(frenteParqueSurcharge);

  const numericFrentePistaSurcharge =
    toNumber(frentePistaSurcharge);

  const numericDiscountValue =
    toNumber(discountValue);

  const numericInitialPayment =
    toNumber(initialPayment);

  // ==============================================================
  // PRECIO BASE DEL LOTE
  // ==============================================================

  const baseLotPrice = useMemo(() => {
    if (!selectedLot) return 0;

    if (
      selectedLot.area_m2 &&
      numericPricePerM2 > 0
    ) {
      return (
        selectedLot.area_m2 *
        numericPricePerM2
      );
    }

    return (
      selectedLot.promo_price ||
      selectedLot.price ||
      0
    );
  }, [
    selectedLot,
    numericPricePerM2,
  ]);

  // ==============================================================
  // RECARGOS
  // ==============================================================

  const esquinaValue =
    esquinaEnabled
      ? numericEsquinaSurcharge
      : 0;

  const frenteParqueValue =
    frenteParqueEnabled
      ? numericFrenteParqueSurcharge
      : 0;

  const frentePistaValue =
    frentePistaEnabled
      ? numericFrentePistaSurcharge
      : 0;

  const lotPrice =
    baseLotPrice +
    esquinaValue +
    frenteParqueValue +
    frentePistaValue;

  // ==============================================================
  // DESCUENTO
  // ==============================================================

  const discountAmount =
    discountType === "percentage"
      ? lotPrice *
        (numericDiscountValue / 100)
      : discountType === "fixed"
        ? numericDiscountValue
        : 0;

  const finalPrice = Math.max(
    lotPrice - discountAmount,
    0
  );

  // ==============================================================
  // FINANCIAMIENTO
  // ==============================================================

  const balance =
    paymentType === "credit"
      ? Math.max(
          finalPrice -
            numericInitialPayment,
          0
        )
      : 0;

  const monthlyPayment =
    paymentType === "credit" &&
    installments > 0
      ? balance / installments
      : 0;

  // ==============================================================
  // MUTATION
  // ==============================================================

  const createMutation =
    useMutation({
      mutationFn: (
        data: QuoteInput
      ) =>
        quote
          ? api.patch<Quote>(
              `/quotes/${quote.id}`,
              data,
              true
            )
          : api.post<Quote>(
              "/quotes",
              data,
              true
            ),
      onSuccess,
    });

  // ==============================================================
  // SUBMIT
  // ==============================================================

  const handleSubmit = (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (
      !selectedProjectId ||
      !selectedLotId
    ) {
      return;
    }

    createMutation.mutate({
      lead_id: selectedLeadId,
      project_id: selectedProjectId,
      lot_id: selectedLotId,

      lot_price: lotPrice,

      price_per_m2:
        numericPricePerM2 > 0
          ? numericPricePerM2
          : null,

      esquina_surcharge:
        esquinaValue,

      frente_parque_surcharge:
        frenteParqueValue,

      frente_a_pista_surcharge:
        frentePistaValue,

      discount_type:
        discountType,

      discount_value:
        numericDiscountValue,

      payment_type:
        paymentType,

      initial_payment:
        paymentType === "credit"
          ? numericInitialPayment
          : 0,

      installments:
        paymentType === "credit"
          ? installments
          : 0,

      client_name:
        clientName,

      client_phone:
        clientPhone,

      client_email:
        clientEmail,

      notes,
    });
  };

  // ==============================================================
  // RENDER
  // ==============================================================

  return (
    <Modal
      open={true}
      onClose={onClose}
      wide={true}
    >
      <div className="flex items-center justify-between border-b pb-4 mb-6 px-6 pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-netland-primary/10">
            <FileText className="h-5 w-5 text-netland-primary" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-netland-dark">
              {quote
                ? "Editar Cotización"
                : "Nueva Cotización"}
            </h3>

            <p className="text-sm text-netland-muted">
              {quote
                ? `Actualizando ${quote.quote_number}`
                : "Genera una cotización profesional"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-netland-muted hover:text-netland-dark"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 px-6 pb-6"
      >
        {/* ======================================================
            PROYECTO Y LOTE
        ====================================================== */}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-netland-dark mb-2">
              Proyecto{" "}
              <span className="text-red-500">
                *
              </span>
            </label>

            <select
              value={
                selectedProjectId || ""
              }
              onChange={(event) => {
                setSelectedProjectId(
                  Number(
                    event.target.value
                  ) || null
                );

                setSelectedLotId(null);
              }}
              className="w-full px-4 py-2.5 rounded-lg border border-netland-muted/30 focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20 outline-none"
              required
            >
              <option value="">
                Seleccionar proyecto
              </option>

              {projects?.map(
                (project) => (
                  <option
                    key={project.id}
                    value={project.id}
                  >
                    {project.name}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-netland-dark mb-2">
              Lote{" "}
              <span className="text-red-500">
                *
              </span>
            </label>

            <select
              value={
                selectedLotId || ""
              }
              onChange={(event) => {
                const id =
                  Number(
                    event.target.value
                  ) || null;

                setSelectedLotId(id);

                const lot =
                  lots?.find(
                    (item) =>
                      item.id === id
                  );

                setPricePerM2(
                  lot?.price_per_m2
                    ? Number(
                        lot.price_per_m2
                      )
                    : 0
                );
              }}
              className="w-full px-4 py-2.5 rounded-lg border border-netland-muted/30 focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20 outline-none"
              disabled={
                !selectedProjectId
              }
              required
            >
              <option value="">
                Seleccionar lote
              </option>

              {lots
                ?.filter(
                  (lot) =>
                    lot.status ===
                      "available" ||
                    (quote &&
                      lot.id ===
                        quote.lot_id)
                )
                .map((lot) => (
                  <option
                    key={lot.id}
                    value={lot.id}
                  >
                    {lot.code}{" "}
                    {lot.area_m2
                      ? `- ${lot.area_m2} m²`
                      : ""}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* ======================================================
            PRECIO DEL LOTE
        ====================================================== */}

        {selectedLot && (
          <div className="p-4 bg-netland-light/30 rounded-lg border border-netland-primary/20 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-netland-dark">
                Lote{" "}
                {selectedLot.code}
              </span>

              {selectedLot.area_m2 ? (
                <span className="text-sm text-netland-muted">
                  Área:{" "}
                  {
                    selectedLot.area_m2
                  }{" "}
                  m²
                </span>
              ) : null}
            </div>

            {/* PRECIO POR M² */}
            <div>
              <label className="block text-sm font-semibold text-netland-dark mb-2">
                Precio por m² (S/){" "}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <input
                type="number"
                value={pricePerM2}
                onFocus={() => {
                  if (
                    pricePerM2 ===
                    0
                  ) {
                    setPricePerM2("");
                  }
                }}
                onChange={(event) => {
                  const value =
                    event.target.value;

                  setPricePerM2(
                    value === ""
                      ? ""
                      : Number(value)
                  );
                }}
                onBlur={() => {
                  if (
                    pricePerM2 ===
                    ""
                  ) {
                    setPricePerM2(0);
                  }
                }}
                min="0"
                step="0.01"
                placeholder="Ej: 415"
                className="w-full px-4 py-2.5 rounded-lg border border-netland-muted/30 focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20 outline-none"
                required
              />
            </div>

            {/* ==================================================
                RECARGOS
            ================================================== */}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* ESQUINA */}
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  esquinaEnabled
                    ? "border-netland-primary bg-netland-primary/10"
                    : "border-netland-muted/20 hover:border-netland-primary/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={
                    esquinaEnabled
                  }
                  onChange={(event) =>
                    setEsquinaEnabled(
                      event.target
                        .checked
                    )
                  }
                  className="mt-1"
                />

                <div className="flex-1">
                  <div className="text-sm font-medium text-netland-dark">
                    Lote en esquina
                  </div>

                  <input
                    type="number"
                    value={
                      esquinaSurcharge
                    }
                    onFocus={() => {
                      if (
                        esquinaSurcharge ===
                        0
                      ) {
                        setEsquinaSurcharge(
                          ""
                        );
                      }
                    }}
                    onChange={(event) => {
                      const value =
                        event.target
                          .value;

                      setEsquinaSurcharge(
                        value === ""
                          ? ""
                          : Number(value)
                      );
                    }}
                    onBlur={() => {
                      if (
                        esquinaSurcharge ===
                        ""
                      ) {
                        setEsquinaSurcharge(
                          0
                        );
                      }
                    }}
                    disabled={
                      !esquinaEnabled
                    }
                    min="0"
                    step="0.01"
                    placeholder="S/"
                    className="mt-1 w-full px-2 py-1.5 rounded border border-netland-muted/30 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </label>

              {/* FRENTE A PARQUE */}
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  frenteParqueEnabled
                    ? "border-netland-primary bg-netland-primary/10"
                    : "border-netland-muted/20 hover:border-netland-primary/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={
                    frenteParqueEnabled
                  }
                  onChange={(event) =>
                    setFrenteParqueEnabled(
                      event.target
                        .checked
                    )
                  }
                  className="mt-1"
                />

                <div className="flex-1">
                  <div className="text-sm font-medium text-netland-dark">
                    Frente a parque
                  </div>

                  <input
                    type="number"
                    value={
                      frenteParqueSurcharge
                    }
                    onFocus={() => {
                      if (
                        frenteParqueSurcharge ===
                        0
                      ) {
                        setFrenteParqueSurcharge(
                          ""
                        );
                      }
                    }}
                    onChange={(event) => {
                      const value =
                        event.target
                          .value;

                      setFrenteParqueSurcharge(
                        value === ""
                          ? ""
                          : Number(value)
                      );
                    }}
                    onBlur={() => {
                      if (
                        frenteParqueSurcharge ===
                        ""
                      ) {
                        setFrenteParqueSurcharge(
                          0
                        );
                      }
                    }}
                    disabled={
                      !frenteParqueEnabled
                    }
                    min="0"
                    step="0.01"
                    placeholder="S/"
                    className="mt-1 w-full px-2 py-1.5 rounded border border-netland-muted/30 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </label>

              {/* FRENTE A PISTA */}
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  frentePistaEnabled
                    ? "border-netland-primary bg-netland-primary/10"
                    : "border-netland-muted/20 hover:border-netland-primary/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={
                    frentePistaEnabled
                  }
                  onChange={(event) =>
                    setFrentePistaEnabled(
                      event.target
                        .checked
                    )
                  }
                  className="mt-1"
                />

                <div className="flex-1">
                  <div className="text-sm font-medium text-netland-dark">
                    Frente a pista
                  </div>

                  <input
                    type="number"
                    value={
                      frentePistaSurcharge
                    }
                    onFocus={() => {
                      if (
                        frentePistaSurcharge ===
                        0
                      ) {
                        setFrentePistaSurcharge(
                          ""
                        );
                      }
                    }}
                    onChange={(event) => {
                      const value =
                        event.target
                          .value;

                      setFrentePistaSurcharge(
                        value === ""
                          ? ""
                          : Number(value)
                      );
                    }}
                    onBlur={() => {
                      if (
                        frentePistaSurcharge ===
                        ""
                      ) {
                        setFrentePistaSurcharge(
                          0
                        );
                      }
                    }}
                    disabled={
                      !frentePistaEnabled
                    }
                    min="0"
                    step="0.01"
                    placeholder="S/"
                    className="mt-1 w-full px-2 py-1.5 rounded border border-netland-muted/30 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </label>
            </div>

            <div className="flex justify-between items-center border-t pt-3 border-netland-primary/20">
              <span className="text-sm font-semibold text-netland-dark">
                Valor del lote:
              </span>

              <span className="text-lg font-bold text-netland-primary">
                {formatSoles(
                  lotPrice
                )}
              </span>
            </div>
          </div>
        )}

        {/* ======================================================
            DESCUENTO
        ====================================================== */}

        <div>
          <label className="block text-sm font-semibold text-netland-dark mb-2">
            Descuento
          </label>

          <div className="grid grid-cols-2 gap-4">
            <select
              value={discountType}
              onChange={(event) =>
                setDiscountType(
                  event.target
                    .value as
                    | "none"
                    | "percentage"
                    | "fixed"
                )
              }
              className="px-4 py-2.5 rounded-lg border border-netland-muted/30 focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20 outline-none"
            >
              <option value="none">
                Sin descuento
              </option>

              <option value="percentage">
                Porcentaje (%)
              </option>

              <option value="fixed">
                Monto fijo (S/)
              </option>
            </select>

            <input
              type="number"
              value={discountValue}
              onFocus={() => {
                if (
                  discountValue ===
                  0
                ) {
                  setDiscountValue("");
                }
              }}
              onChange={(event) => {
                const value =
                  event.target.value;

                setDiscountValue(
                  value === ""
                    ? ""
                    : Number(value)
                );
              }}
              onBlur={() => {
                if (
                  discountValue ===
                  ""
                ) {
                  setDiscountValue(0);
                }
              }}
              disabled={
                discountType ===
                "none"
              }
              min="0"
              step="0.01"
              placeholder={
                discountType ===
                "percentage"
                  ? "%"
                  : "S/"
              }
              className="px-4 py-2.5 rounded-lg border border-netland-muted/30 focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20 outline-none disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          {discountAmount > 0 && (
            <div className="mt-2 text-sm">
              <span className="text-orange-600 font-medium">
                Descuento: -
                {formatSoles(
                  discountAmount
                )}
              </span>

              <span className="ml-3 text-netland-primary font-bold">
                Precio final:{" "}
                {formatSoles(
                  finalPrice
                )}
              </span>
            </div>
          )}
        </div>

        {/* ======================================================
            TIPO DE PAGO
        ====================================================== */}

        <div>
          <label className="block text-sm font-semibold text-netland-dark mb-2">
            Tipo de Pago{" "}
            <span className="text-red-500">
              *
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                setPaymentType(
                  "cash"
                )
              }
              className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                paymentType ===
                "cash"
                  ? "border-netland-primary bg-netland-primary/10 text-netland-primary"
                  : "border-netland-muted/30 text-netland-muted hover:border-netland-primary/30"
              }`}
            >
              Al Contado
            </button>

            <button
              type="button"
              onClick={() =>
                setPaymentType(
                  "credit"
                )
              }
              className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                paymentType ===
                "credit"
                  ? "border-netland-primary bg-netland-primary/10 text-netland-primary"
                  : "border-netland-muted/30 text-netland-muted hover:border-netland-primary/30"
              }`}
            >
              A Crédito
            </button>
          </div>
        </div>

        {/* ======================================================
            FINANCIAMIENTO
        ====================================================== */}

        {paymentType ===
          "credit" && (
          <div className="grid grid-cols-2 gap-4">
            {/* INICIAL */}
            <div>
              <label className="block text-sm font-semibold text-netland-dark mb-2">
                Inicial (S/){" "}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <input
                type="number"
                value={
                  initialPayment
                }
                onFocus={() => {
                  if (
                    initialPayment ===
                    0
                  ) {
                    setInitialPayment(
                      ""
                    );
                  }
                }}
                onChange={(event) => {
                  const value =
                    event.target
                      .value;

                  setInitialPayment(
                    value === ""
                      ? ""
                      : Number(value)
                  );
                }}
                onBlur={() => {
                  if (
                    initialPayment ===
                    ""
                  ) {
                    setInitialPayment(
                      0
                    );
                  }
                }}
                min="0"
                max={finalPrice}
                step="0.01"
                className="w-full px-4 py-2.5 rounded-lg border border-netland-muted/30 focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20 outline-none"
                required
              />
            </div>

            {/* CUOTAS */}
            <div>
              <label className="block text-sm font-semibold text-netland-dark mb-2">
                Número de Cuotas{" "}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <select
                value={
                  installments
                }
                onChange={(event) =>
                  setInstallments(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                className="w-full px-4 py-2.5 rounded-lg border border-netland-muted/30 focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20 outline-none"
                required
              >
                {[
                  6,
                  12,
                  18,
                  24,
                  36,
                  48,
                  60,
                ].map(
                  (number) => (
                    <option
                      key={number}
                      value={number}
                    >
                      {number} meses
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        )}

        {/* ======================================================
            RESUMEN
        ====================================================== */}

        {paymentType ===
          "credit" &&
          selectedLot && (
            <div className="p-4 bg-gradient-to-r from-netland-primary/10 to-orange-50 rounded-lg border border-netland-primary/30">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-netland-muted uppercase mb-1">
                    Saldo a financiar
                  </div>

                  <div className="text-lg font-bold text-netland-dark">
                    {formatSoles(
                      balance
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-netland-muted uppercase mb-1">
                    Número de cuotas
                  </div>

                  <div className="text-lg font-bold text-netland-dark">
                    {
                      installments
                    }{" "}
                    meses
                  </div>
                </div>

                <div>
                  <div className="text-xs text-netland-muted uppercase mb-1">
                    Cuota mensual
                  </div>

                  <div className="text-xl font-bold text-netland-primary">
                    {formatSoles(
                      monthlyPayment
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* ======================================================
            CLIENTE CAPTADO
        ====================================================== */}

        <div>
          <label className="block text-sm font-semibold text-netland-dark mb-2">
            Cliente captado
          </label>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-netland-muted" />

            <input
              type="text"
              value={
                clientSearch
              }
              onChange={(event) =>
                setClientSearch(
                  event.target
                    .value
                )
              }
              placeholder="Buscar por nombre, teléfono o email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-netland-muted/30 focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20 outline-none"
            />
          </div>

          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-netland-muted/20">
            {filteredLeads.length ===
            0 ? (
              <div className="px-4 py-6 text-center text-sm text-netland-muted">
                {leads?.length ===
                0
                  ? "No hay clientes captados registrados."
                  : "No se encontraron resultados."}
              </div>
            ) : (
              filteredLeads.map(
                (lead) => {
                  const name =
                    `${lead.client?.name ?? ""} ${
                      lead.client
                        ?.last_name ??
                      ""
                    }`.trim();

                  const isSelected =
                    lead.id ===
                    selectedLeadId;

                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => {
                        const isSelected =
                          lead.id ===
                          selectedLeadId;

                        setSelectedLeadId(
                          isSelected
                            ? null
                            : lead.id
                        );

                        if (!isSelected) {
                          setClientName(
                            `${lead.client?.name ?? ""} ${
                              lead.client
                                ?.last_name ??
                              ""
                            }`.trim()
                          );
                          setClientPhone(
                            lead.client
                              ?.phone ?? ""
                          );
                          setClientEmail(
                            lead.client
                              ?.email ?? ""
                          );
                        }

                        setClientSearch(
                          ""
                        );
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-netland-muted/10 last:border-0 ${
                        isSelected
                          ? "bg-netland-primary/10"
                          : "hover:bg-netland-light/50"
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-netland-primary/10 text-netland-primary shrink-0">
                        <User className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-netland-dark truncate">
                          {name ||
                            "Sin nombre"}
                        </p>

                        <p className="text-xs text-netland-muted truncate">
                          {
                            lead
                              .client
                              ?.phone
                          }

                          {lead.client
                            ?.email
                            ? ` · ${lead.client.email}`
                            : ""}
                        </p>
                      </div>

                      {isSelected && (
                        <Badge color="#16a34a">
                          Seleccionado
                        </Badge>
                      )}
                    </button>
                  );
                }
              )
            )}
          </div>

          {selectedLead && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Badge color="#16a34a">
                {`${selectedLead.client?.name ?? ""} ${
                  selectedLead.client
                    ?.last_name ??
                  ""
                }`.trim()}
              </Badge>

              <span className="text-netland-muted">
                ·
              </span>

              <span className="text-netland-muted">
                {
                  selectedLead
                    .client?.phone
                }
              </span>

              <button
                type="button"
                onClick={() =>
                  setSelectedLeadId(
                    null
                  )
                }
                className="ml-auto text-xs text-red-500 hover:text-red-700"
              >
                Quitar selección
              </button>
            </div>
          )}
        </div>

        {/* ======================================================
            NOTAS
        ====================================================== */}

        <div className="p-4 rounded-lg border border-netland-muted/20 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-netland-muted">
            Datos del cliente
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-netland-dark mb-2">
                Nombre
              </label>

              <input
                type="text"
                value={clientName}
                onChange={(event) =>
                  setClientName(
                    event.target.value
                  )
                }
                placeholder="Nombre del cliente"
                className="w-full px-4 py-2.5 rounded-lg border border-netland-muted/30 focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-netland-dark mb-2">
                Teléfono
              </label>

              <input
                type="text"
                value={clientPhone}
                onChange={(event) =>
                  setClientPhone(
                    event.target.value
                  )
                }
                placeholder="+51 999 999 999"
                className="w-full px-4 py-2.5 rounded-lg border border-netland-muted/30 focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-netland-dark mb-2">
              Email
            </label>

            <input
              type="email"
              value={clientEmail}
              onChange={(event) =>
                setClientEmail(
                  event.target.value
                )
              }
              placeholder="cliente@correo.com"
              className="w-full px-4 py-2.5 rounded-lg border border-netland-muted/30 focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20 outline-none"
            />
          </div>
        </div>

        {/* ======================================================
            NOTAS
        ====================================================== */}

        <div>
          <label className="block text-sm font-semibold text-netland-dark mb-2">
            Observaciones adicionales
          </label>

          <textarea
            value={notes}
            onChange={(event) =>
              setNotes(
                event.target.value
              )
            }
            rows={3}
            placeholder="Agregar notas, condiciones especiales, promociones..."
            className="w-full px-4 py-2.5 rounded-lg border border-netland-muted/30 focus:border-netland-primary focus:ring-2 focus:ring-netland-primary/20 outline-none resize-none"
          />
        </div>

        {/* ======================================================
            BOTONES
        ====================================================== */}

        <div className="flex gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            disabled={
              !selectedProjectId ||
              !selectedLotId ||
              createMutation.isPending
            }
            className="flex-1"
          >
            {createMutation.isPending
              ? quote
                ? "Guardando..."
                : "Generando..."
              : quote
                ? "Guardar cambios"
                : "Generar Cotización"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ================================================================
// QUOTE DETAIL MODAL
// ================================================================

function QuoteDetailModal({
  quote,
  onClose,
  onDownloadPdf,
  onSendWhatsApp,
}: {
  quote: Quote;
  onClose: () => void;
  onDownloadPdf: (id: number) => void;
  onSendWhatsApp: (
    quote: Quote
  ) => void;
}) {
  const hasDiscount =
    quote.discount_type !==
      "none" &&
    (quote.discount_value || 0) >
      0;

  const isCredit =
    quote.payment_type ===
    "credit";

  const discountAmount =
    hasDiscount
      ? quote.discount_type ===
        "percentage"
        ? (quote.lot_price || 0) *
          ((quote.discount_value ||
            0) /
            100)
        : quote.discount_value ||
          0
      : 0;

  return (
    <Modal
      open={true}
      onClose={onClose}
      wide
    >
      <div className="px-6 pt-6 pb-4">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo-netland.png"
              alt="Netland"
              className="h-10 w-10 rounded-lg object-contain"
            />

            <div>
              <h3 className="text-xl font-bold text-netland-dark">
                {
                  quote.quote_number
                }
              </h3>

              <p className="text-sm text-netland-muted">
                {new Date().toLocaleDateString(
                  "es-PE",
                  {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }
                )}
              </p>
            </div>
          </div>

          <Badge
            color={
              statusColors[
                quote.status
              ] ?? "#6b7280"
            }
          >
            {statusLabels[
              quote.status
            ] || quote.status}
          </Badge>
        </div>

        {/* INFO GRID */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {/* CLIENTE */}
          <div className="rounded-xl bg-netland-light/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-netland-muted mb-2">
              Cliente
            </p>

            <p className="font-semibold text-netland-dark">
              {quote.client_name ||
                "Sin cliente"}
            </p>

            {quote.client_phone && (
              <p className="text-sm text-netland-muted mt-0.5">
                {
                  quote.client_phone
                }
              </p>
            )}

            {quote.client_email && (
              <p className="text-sm text-netland-muted">
                {
                  quote.client_email
                }
              </p>
            )}
          </div>

          {/* PROYECTO / LOTE */}
          <div className="rounded-xl bg-netland-light/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-netland-muted mb-2">
              Proyecto / Lote
            </p>

            <p className="font-semibold text-netland-dark">
              {
                quote.project_name ||
                "—"
              }
            </p>

            <p className="text-sm text-netland-muted mt-0.5">
              Lote{" "}
              {
                quote.lot_code
              }

              {quote.lot_area
                ? ` · ${quote.lot_area} m²`
                : ""}
            </p>

            {quote.advisor_name && (
              <p className="text-sm text-netland-muted mt-0.5">
                Asesor:{" "}
                {
                  quote.advisor_name
                }
              </p>
            )}
          </div>

          {/* TIPO DE PAGO */}
          <div className="rounded-xl bg-netland-light/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-netland-muted mb-2">
              Tipo de pago
            </p>

            <Badge
              color={
                isCredit
                  ? "#0891b2"
                  : "#059669"
              }
            >
              {isCredit
                ? "A Crédito"
                : "Al Contado"}
            </Badge>

            {isCredit && (
              <p className="text-sm text-netland-muted mt-2">
                {
                  quote.installments
                }{" "}
                cuotas de{" "}
                {formatSoles(
                  quote.installment_value
                )}
              </p>
            )}
          </div>
        </div>

        {/* DESGLOSE FINANCIERO */}
        <div className="rounded-xl border border-netland-muted/20 overflow-hidden mb-6">
          <div className="bg-netland-light/30 px-5 py-3 border-b border-netland-muted/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-netland-muted">
              Desglose financiero
            </p>
          </div>

          <div className="divide-y divide-netland-muted/10">
            {/* VALOR BASE */}
            {quote.price_per_m2 &&
            quote.lot_area ? (
              <>
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-netland-muted">
                    Valor del lote (
                    {
                      quote.lot_area
                    }{" "}
                    m² × S/{" "}
                    {Number(
                      quote.price_per_m2
                    ).toLocaleString(
                      "es-PE"
                    )}
                    )
                  </span>

                  <span className="font-medium text-netland-dark">
                    {formatSoles(
                      (quote.lot_area ||
                        0) *
                        (quote.price_per_m2 ||
                          0)
                    )}
                  </span>
                </div>

                {(quote.esquina_surcharge ||
                  0) > 0 && (
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-netland-muted">
                      Recargo lote en esquina
                    </span>

                    <span className="font-medium text-netland-dark">
                      +
                      {formatSoles(
                        quote.esquina_surcharge
                      )}
                    </span>
                  </div>
                )}

                {(quote.frente_parque_surcharge ||
                  0) > 0 && (
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-netland-muted">
                      Recargo frente a parque
                    </span>

                    <span className="font-medium text-netland-dark">
                      +
                      {formatSoles(
                        quote.frente_parque_surcharge
                      )}
                    </span>
                  </div>
                )}

                {(quote.frente_a_pista_surcharge ||
                  0) > 0 && (
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-netland-muted">
                      Recargo frente a pista
                    </span>

                    <span className="font-medium text-netland-dark">
                      +
                      {formatSoles(
                        quote.frente_a_pista_surcharge
                      )}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-netland-muted">
                  Precio del lote
                </span>

                <span className="font-medium text-netland-dark">
                  {formatSoles(
                    quote.lot_price
                  )}
                </span>
              </div>
            )}

            {/* DESCUENTO */}
            {hasDiscount && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-netland-muted">
                  Descuento
                  {quote.discount_type ===
                  "percentage"
                    ? ` (${quote.discount_value}%)`
                    : ""}
                </span>

                <span className="font-medium text-orange-600">
                  -
                  {formatSoles(
                    discountAmount
                  )}
                </span>
              </div>
            )}

            {/* INICIAL */}
            {isCredit && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-netland-muted">
                  Cuota inicial
                </span>

                <span className="font-medium text-netland-dark">
                  {formatSoles(
                    quote.initial_payment
                  )}
                </span>
              </div>
            )}

            {/* CUOTAS */}
            {isCredit && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-netland-muted">
                  {
                    quote.installments
                  }{" "}
                  cuotas mensuales
                </span>

                <span className="font-medium text-netland-dark">
                  {formatSoles(
                    quote.installment_value
                  )}
                </span>
              </div>
            )}

            {/* TOTAL */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-netland-primary/5">
              <span className="text-sm font-bold text-netland-dark uppercase tracking-wider">
                Total
              </span>

              <span className="text-xl font-bold text-netland-primary">
                {formatSoles(
                  quote.total_amount
                )}
              </span>
            </div>
          </div>
        </div>

        {/* NOTAS */}
        {quote.notes && (
          <div className="rounded-xl border border-netland-muted/20 p-4 mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-netland-muted mb-1.5">
              Observaciones
            </p>

            <p className="text-sm text-netland-dark whitespace-pre-wrap">
              {quote.notes}
            </p>
          </div>
        )}

        {/* ACCIONES */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-netland-muted/20">
          <Button
            variant="outline"
            onClick={() =>
              onDownloadPdf(
                quote.id
              )
            }
          >
            <Download className="h-4 w-4" />
            Descargar PDF
          </Button>

          {quote.client_phone && (
            <Button
              variant="outline"
              className="!border-green-600 !text-green-600 hover:!bg-green-50"
              onClick={() =>
                onSendWhatsApp(
                  quote
                )
              }
            >
              <Send className="h-4 w-4" />
              Enviar por WhatsApp
            </Button>
          )}

          <div className="ml-auto">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
