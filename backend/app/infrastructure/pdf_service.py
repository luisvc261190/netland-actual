import io
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader


# ============================================================================
# FORMATO DE MONEDA
# ============================================================================

def format_soles(value: float | None) -> str:
    if value is None:
        return "S/ ---"
    return f"S/ {value:,.2f}"


def _number_to_words(number: float) -> str:
    """Convierte un número a palabras en español (para montos en facturas)."""
    
    # Unidades
    unidades = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"]
    decenas_especiales = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"]
    decenas = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]
    centenas = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"]
    
    def convertir_grupo(n: int) -> str:
        """Convierte un grupo de hasta 3 dígitos a palabras."""
        if n == 0:
            return ""
        elif n == 100:
            return "cien"
        elif n < 10:
            return unidades[n]
        elif n < 20:
            return decenas_especiales[n - 10]
        elif n < 100:
            decena = n // 10
            unidad = n % 10
            if decena == 2:
                return "veinti" + unidades[unidad] if unidad > 0 else "veinte"
            return decenas[decena] + (" y " + unidades[unidad] if unidad > 0 else "")
        else:
            centena = n // 100
            resto = n % 100
            texto = centenas[centena]
            if resto > 0:
                texto += " " + convertir_grupo(resto)
            return texto
    
    # Separar parte entera y decimal
    partes = str(number).split(".")
    parte_entera = int(partes[0])
    parte_decimal = int(partes[1][:2]) if len(partes) > 1 else 0
    
    if parte_entera == 0:
        texto = "cero"
    elif parte_entera < 1000:
        texto = convertir_grupo(parte_entera)
    elif parte_entera < 1000000:
        miles = parte_entera // 1000
        resto = parte_entera % 1000
        if miles == 1:
            texto = "mil"
        else:
            texto = convertir_grupo(miles) + " mil"
        if resto > 0:
            texto += " " + convertir_grupo(resto)
    else:
        millones = parte_entera // 1000000
        resto = parte_entera % 1000000
        if millones == 1:
            texto = "un millón"
        else:
            texto = convertir_grupo(millones) + " millones"
        if resto >= 1000:
            miles = resto // 1000
            if miles == 1:
                texto += " mil"
            else:
                texto += " " + convertir_grupo(miles) + " mil"
            resto = resto % 1000
        if resto > 0:
            texto += " " + convertir_grupo(resto)
    
    # Agregar parte decimal
    texto += f" con {parte_decimal:02d}/100 soles"
    
    return texto.strip()


def _safe(text: str) -> str:
    """Escapa texto para renderizarlo con reportlab Paragraph."""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _corporate_palette():
    """Paleta corporativa compartida por todos los documentos."""
    return {
        "navy": colors.HexColor("#17324D"),
        "blue": colors.HexColor("#2F668F"),
        "blue_light": colors.HexColor("#EAF2F7"),
        "blue_pale": colors.HexColor("#F5F8FA"),
        "mustard": colors.HexColor("#B58A3A"),
        "mustard_light": colors.HexColor("#F5EEDC"),
        "highlight_yellow": colors.HexColor("#FFF176"),
        "dark": colors.HexColor("#263238"),
        "text": colors.HexColor("#37474F"),
        "grey": colors.HexColor("#6B7780"),
        "light_grey": colors.HexColor("#B8C1C7"),
        "border": colors.HexColor("#DCE3E7"),
        "background": colors.HexColor("#FAFBFC"),
    }


def _draw_corporate_background(c: canvas.Canvas, width: float, height: float) -> None:
    pal = _corporate_palette()
    c.setFillColor(pal["background"])
    c.rect(0, 0, width, height, stroke=0, fill=1)


def _draw_corporate_header(
    c: canvas.Canvas,
    width: float,
    height: float,
    document_label: str,
    document_number: str,
    generation_date: str,
    generation_time: str,
    company_name: str,
    company_ruc: str | None = None,
    company_razon_social: str | None = None,
    company_address: str | None = None,
    company_accounts: list[str] | None = None,
) -> tuple[float, float, float]:
    """
    Encabezado corporativo estilo cotización (logo + card de documento + datos de empresa).
    Devuelve (y, content_width, right_x) para continuar dibujando el contenido.
    """
    pal = _corporate_palette()
    background = pal["background"]
    navy = pal["navy"]
    mustard = pal["mustard"]
    grey = pal["grey"]
    border = pal["border"]

    margin_left = 18 * mm
    margin_right = 18 * mm

    content_width = width - margin_left - margin_right
    right_x = width - margin_right

    # FONDO
    _draw_corporate_background(c, width, height)

    # HEADER
    y = height - 18 * mm

    # LOGO
    logo_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "static",
        "logo-netland.png",
    )
    logo_width = 30 * mm
    logo_height = 30 * mm
    logo_x = margin_left
    logo_y = y - 18 * mm

    if os.path.exists(logo_path):
        try:
            logo_img = ImageReader(logo_path)
            c.drawImage(
                logo_img,
                logo_x,
                logo_y,
                width=logo_width,
                height=logo_height,
                preserveAspectRatio=True,
                mask="auto",
            )
        except Exception:
            pass

    # CARD DE DOCUMENTO (derecha, alineada con el logo)
    pad_x = 4 * mm
    pad_y = 4 * mm
    box_h = 13 * mm + 2 * pad_y
    max_w = max(
        c.stringWidth(t, f, s)
        for t, f, s in (
            (document_label, "Helvetica-Bold", 8.5),
            (f"N.º {document_number}", "Helvetica-Bold", 9.2),
            (f"{generation_date} · {generation_time}", "Helvetica", 6.8),
        )
    )
    box_w = max_w + 2 * pad_x
    card_y = y

    c.setFillColor(colors.white)
    c.setStrokeColor(border)
    c.setLineWidth(0.5)
    c.roundRect(
        right_x - box_w,
        card_y - 13 * mm - pad_y,
        box_w,
        box_h,
        1.5 * mm,
        stroke=1,
        fill=1,
    )

    c.setFillColor(navy)
    c.roundRect(
        right_x - box_w,
        card_y - 13 * mm - pad_y,
        1.2 * mm,
        box_h,
        0.6 * mm,
        stroke=0,
        fill=1,
    )

    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawRightString(right_x - pad_x, card_y, document_label)

    c.setFillColor(mustard)
    c.setFont("Helvetica-Bold", 9.2)
    c.drawRightString(right_x - pad_x, card_y - 4.8 * mm, f"N.º {document_number}")

    c.setFillColor(grey)
    c.setFont("Helvetica", 6.8)
    c.drawRightString(right_x - pad_x, card_y - 9 * mm, f"{generation_date} · {generation_time}")

    # INFORMACIÓN DE LA EMPRESA (centrada)
    center_x = width / 2

    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(center_x, y, "NETLAND")

    c.setFillColor(mustard)
    c.setFont("Helvetica-Bold", 7.2)
    c.drawCentredString(center_x, y - 4.8 * mm, "CORPORACIÓN INMOBILIARIA")

    c.setFillColor(grey)
    c.setFont("Helvetica", 6.8)
    location = "Cañete · Lima · Perú"
    if company_ruc:
        location += f"  ·  RUC {company_ruc}"
    c.drawCentredString(center_x, y - 9 * mm, location)

    current_y = y - 12 * mm

    if company_address:
        c.setFillColor(grey)
        c.setFont("Helvetica", 6.2)
        address_clean = company_address.replace("\n", " ")
        if " - " in address_clean:
            parts = address_clean.split(" - ", 1)
            c.drawCentredString(center_x, current_y, parts[0].strip())
            current_y -= 3 * mm
            if len(parts) > 1:
                c.drawCentredString(center_x, current_y, parts[1].strip())
                current_y -= 3.5 * mm
        else:
            c.drawCentredString(center_x, current_y, address_clean)
            current_y -= 3.5 * mm

    if company_razon_social or company_name:
        c.setFillColor(grey)
        c.setFont("Helvetica", 6.5)
        c.drawCentredString(center_x, current_y, company_razon_social or company_name)
        current_y -= 3.5 * mm

    if company_accounts:
        c.setFillColor(grey)
        c.setFont("Helvetica", 6.5)
        for account_line in company_accounts:
            c.drawCentredString(center_x, current_y, account_line)
            current_y -= 3.5 * mm

    y = current_y

    # DETALLE DECORATIVO: línea mostaza bajo el logo
    y = logo_y - 0.5 * mm
    c.setStrokeColor(mustard)
    c.setLineWidth(1.8)
    c.line(margin_left, y, margin_left + 28 * mm, y)

    return y, content_width, right_x


def _draw_corporate_footer(
    c: canvas.Canvas,
    width: float,
    footer_document: str,
    document_number: str,
    generation_date: str,
    generation_time: str,
    phone: str = "",
    location: str = "Cañete, Lima - Perú",
    contact_email: str = "ventas@netland.pe",
    extra_line: str | None = None,
) -> None:
    """Pie de página corporativo estilo cotización."""
    pal = _corporate_palette()
    navy = pal["navy"]
    grey = pal["grey"]
    mustard = pal["mustard"]
    light_grey = pal["light_grey"]

    margin_left = 18 * mm
    table_right = width - 18 * mm

    footer_y = 14 * mm

    c.setStrokeColor(mustard)
    c.setLineWidth(1)
    c.line(margin_left, footer_y + 6 * mm, margin_left + 173 * mm, footer_y + 6 * mm)

    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 6.8)
    c.drawString(margin_left, footer_y, "NETLAND")

    c.setFillColor(grey)
    c.setFont("Helvetica", 6.5)
    c.drawString(margin_left, footer_y - 3.5 * mm, location)
    if extra_line:
        c.setFont("Helvetica", 6.2)
        c.drawString(margin_left, footer_y - 7 * mm, extra_line[:120])

    c.drawRightString(table_right, footer_y, contact_email)
    c.drawRightString(table_right, footer_y - 3.5 * mm, f"WhatsApp: {phone}")

    c.setFont("Helvetica", 5.8)
    c.setFillColor(light_grey)
    c.drawCentredString(
        width / 2,
        6 * mm,
        (
            f"{footer_document} N.º {document_number} · "
            f"Generada el {generation_date} a las {generation_time}"
        ),
    )


# ============================================================================
# GENERADOR DE COTIZACIÓN INMOBILIARIA
# ============================================================================

def generate_quote_pdf(
    quote_number: str,
    company_name: str,
    project_name: str,
    lot_code: str,
    area_m2: float | None,
    lot_price: float,
    company_ruc: str | None = None,
    company_razon_social: str | None = None,
    company_address: str | None = None,
    company_accounts: list[str] | None = None,
    price_per_m2: float | None = None,
    esquina_surcharge: float = 0,
    frente_parque_surcharge: float = 0,
    frente_a_pista_surcharge: float = 0,
    discount_type: str = "none",
    discount_value: float = 0,
    discount_amount: float = 0,
    payment_type: str = "credit",
    initial_payment: float = 0,
    installments: int = 0,
    installment_value: float = 0,
    total_amount: float = 0,
    client_name: str | None = None,
    advisor_name: str | None = None,
    advisor_phone: str | None = None,
    notes: str = "",
    date_str: str | None = None,
    document_label: str = "COTIZACIÓN INMOBILIARIA",
    footer_document: str = "Cotización",
) -> bytes:
    """
    Genera una cotización inmobiliaria profesional para la venta
    de lotes de terreno.

    Diseño:
    - A4
    - Estilo corporativo sobrio
    - Azul noche + marrón mostaza
    - Logo corporativo en encabezado
    - Cards ligeros
    - Sin firma del asesor
    - Pie de página compacto
    """

    buffer = io.BytesIO()

    c = canvas.Canvas(
        buffer,
        pagesize=A4,
    )

    width, height = A4

    # =========================================================================
    # PALETA CORPORATIVA
    # =========================================================================

    # Azul noche principal
    NAVY = colors.HexColor("#17324D")

    # Azul secundario
    BLUE = colors.HexColor("#2F668F")

    # Azul muy suave para cards/títulos
    BLUE_LIGHT = colors.HexColor("#EAF2F7")

    # Fondo azul muy suave
    BLUE_PALE = colors.HexColor("#F5F8FA")

    # Marrón mostaza corporativo
    MUSTARD = colors.HexColor("#B58A3A")

    # Mostaza suave para fondos
    MUSTARD_LIGHT = colors.HexColor("#F5EEDC")

    # Amarillo de resaltado
    HIGHLIGHT_YELLOW = colors.HexColor("#FFF176")

    # Textos
    DARK = colors.HexColor("#263238")
    TEXT = colors.HexColor("#37474F")
    GREY = colors.HexColor("#6B7780")
    LIGHT_GREY = colors.HexColor("#B8C1C7")

    # Bordes
    BORDER = colors.HexColor("#DCE3E7")

    # Fondo general
    BACKGROUND = colors.HexColor("#FAFBFC")

    WHITE = colors.white

    # =========================================================================
    # MEDIDAS
    # =========================================================================

    margin_left = 18 * mm
    margin_right = 18 * mm

    content_width = width - margin_left - margin_right
    right_x = width - margin_right

    # =========================================================================
    # FECHA
    # =========================================================================

    now = datetime.now()

    generation_date = (
        date_str
        if date_str
        else now.strftime("%d/%m/%Y")
    )

    generation_time = now.strftime("%H:%M")

    # =========================================================================
    # DATOS
    # =========================================================================

    client = client_name or "Cliente por confirmar"
    advisor = advisor_name or "Área de Ventas"
    phone = advisor_phone or ""

    area_text = (
        f"{area_m2:,.2f} m²"
        if area_m2 is not None
        else "Por definir"
    )

    # =========================================================================
    # PRECIO FINAL
    # =========================================================================

    final_price = (
        lot_price - discount_amount
        if discount_amount > 0
        else lot_price
    )

    display_total = (
        total_amount
        if total_amount > 0
        else final_price
    )

    # =========================================================================
    # FONDO + ENCABEZADO CORPORATIVO (estilo compartido)
    # =========================================================================

    y, content_width, right_x = _draw_corporate_header(
        c,
        width,
        height,
        document_label=document_label,
        document_number=quote_number,
        generation_date=generation_date,
        generation_time=generation_time,
        company_name=company_name,
        company_ruc=company_ruc,
        company_razon_social=company_razon_social,
        company_address=company_address,
        company_accounts=company_accounts,
    )

    margin_left = 18 * mm

    # =========================================================================
    # DATOS DEL CLIENTE
    # =========================================================================

    y -= 15 * mm  # Aumentado de 8mm a 15mm para más separación

    # Título de sección
    c.setFillColor(BLUE_LIGHT)

    c.roundRect(
        margin_left,
        y - 5.5 * mm,
        43 * mm,
        6 * mm,
        1.5 * mm,
        stroke=0,
        fill=1,
    )

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 8.6)

    c.drawString(
        margin_left + 3 * mm,
        y - 3.7 * mm,
        "DATOS DEL CLIENTE",
    )

    y -= 7 * mm

    # -------------------------------------------------------------------------
    # CARD CLIENTE
    # -------------------------------------------------------------------------

    card_height = 27 * mm

    c.setFillColor(WHITE)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)

    c.roundRect(
        margin_left,
        y - card_height,
        content_width,
        card_height,
        2 * mm,
        stroke=1,
        fill=1,
    )

    # Barra lateral azul
    c.setFillColor(BLUE)

    c.roundRect(
        margin_left,
        y - card_height,
        1.3 * mm,
        card_height,
        0.7 * mm,
        stroke=0,
        fill=1,
    )

    # Fila 1
    row_y = y - 7 * mm

    c.setFillColor(GREY)
    c.setFont("Helvetica-Bold", 7)

    c.drawString(
        margin_left + 5 * mm,
        row_y,
        "CLIENTE",
    )

    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 9.5)

    c.drawString(
        margin_left + 29 * mm,
        row_y,
        client,
    )

    # Proyecto
    c.setFillColor(GREY)
    c.setFont("Helvetica-Bold", 7)

    c.drawString(
        width / 2,
        row_y,
        "PROYECTO",
    )

    c.setFillColor(DARK)
    c.setFont("Helvetica", 9.2)

    c.drawString(
        width / 2 + 25 * mm,
        row_y,
        project_name,
    )

    # Fila 2
    row_y -= 8 * mm

    c.setFillColor(GREY)
    c.setFont("Helvetica-Bold", 7)

    c.drawString(
        margin_left + 5 * mm,
        row_y,
        "LOTE",
    )

    c.setFillColor(MUSTARD)
    c.setFont("Helvetica-Bold", 9.5)

    c.drawString(
        margin_left + 29 * mm,
        row_y,
        f"Lote {lot_code}",
    )

    c.setFillColor(GREY)
    c.setFont("Helvetica-Bold", 7)

    c.drawString(
        width / 2,
        row_y,
        "ÁREA",
    )

    c.setFillColor(DARK)
    c.setFont("Helvetica", 9.2)

    c.drawString(
        width / 2 + 25 * mm,
        row_y,
        area_text,
    )

    # Fila 3
    row_y -= 7 * mm

    c.setFillColor(GREY)
    c.setFont("Helvetica-Bold", 7)

    c.drawString(
        margin_left + 5 * mm,
        row_y,
        "ASESOR",
    )

    c.setFillColor(TEXT)
    c.setFont("Helvetica", 9)

    c.drawString(
        margin_left + 29 * mm,
        row_y,
        advisor,
    )

    c.setFillColor(GREY)
    c.setFont("Helvetica-Bold", 7)

    c.drawString(
        width / 2,
        row_y,
        "CONTACTO",
    )

    c.setFillColor(TEXT)
    c.setFont("Helvetica", 9)

    c.drawString(
        width / 2 + 25 * mm,
        row_y,
        phone,
    )

    y -= card_height + 6 * mm

    # =========================================================================
    # DETALLE DEL INMUEBLE
    # =========================================================================

    c.setFillColor(BLUE_LIGHT)

    c.roundRect(
        margin_left,
        y - 5.5 * mm,
        52 * mm,
        6 * mm,
        1.5 * mm,
        stroke=0,
        fill=1,
    )

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 8.6)

    c.drawString(
        margin_left + 3 * mm,
        y - 3.7 * mm,
        "DETALLE DEL INMUEBLE",
    )

    y -= 7 * mm

    # =========================================================================
    # TABLA PRINCIPAL
    # =========================================================================

    table_x = margin_left
    table_right = right_x

    header_height = 8 * mm

    # Cabecera
    c.setFillColor(NAVY)

    c.roundRect(
        table_x,
        y - header_height,
        content_width,
        header_height,
        1.5 * mm,
        stroke=0,
        fill=1,
    )

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 7)

    c.drawString(
        table_x + 4 * mm,
        y - 5 * mm,
        "INMUEBLE",
    )

    c.drawCentredString(
        table_x + content_width * 0.57,
        y - 5 * mm,
        "ÁREA",
    )

    c.drawRightString(
        table_right - 38 * mm,
        y - 5 * mm,
        "VALOR",
    )

    c.drawRightString(
        table_right - 4 * mm,
        y - 5 * mm,
        "TOTAL",
    )

    y -= header_height

    # -------------------------------------------------------------------------
    # FILA LOTE
    # -------------------------------------------------------------------------

    row_height = 19 * mm

    c.setFillColor(WHITE)
    c.setStrokeColor(BORDER)

    c.rect(
        table_x,
        y - row_height,
        content_width,
        row_height,
        stroke=1,
        fill=1,
    )

    # Descripción
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 9.5)

    c.drawString(
        table_x + 4 * mm,
        y - 7 * mm,
        f"Lote {lot_code}",
    )

    c.setFillColor(GREY)
    c.setFont("Helvetica", 7.8)

    c.drawString(
        table_x + 4 * mm,
        y - 12 * mm,
        "Terreno dentro del proyecto inmobiliario",
    )

    c.setFont("Helvetica", 7.6)

    c.drawString(
        table_x + 4 * mm,
        y - 16 * mm,
        project_name,
    )

    # Área
    c.setFillColor(TEXT)
    c.setFont("Helvetica", 9)

    c.drawCentredString(
        table_x + content_width * 0.57,
        y - 10 * mm,
        area_text,
    )

    # Precio
    c.drawRightString(
        table_right - 38 * mm,
        y - 10 * mm,
        format_soles(lot_price),
    )

    c.setFont("Helvetica-Bold", 9)

    c.drawRightString(
        table_right - 4 * mm,
        y - 10 * mm,
        format_soles(lot_price),
    )

    y -= row_height

    # =========================================================================
    # DESCUENTO
    # =========================================================================

    if discount_type != "none" and discount_amount > 0:

        discount_height = 9 * mm

        c.setFillColor(MUSTARD_LIGHT)

        c.rect(
            table_x,
            y - discount_height,
            content_width,
            discount_height,
            stroke=0,
            fill=1,
        )

        if discount_type == "percentage":
            discount_label = (
                f"Beneficio comercial ({discount_value}%)"
            )
        else:
            discount_label = "Beneficio comercial"

        c.setFillColor(TEXT)
        c.setFont("Helvetica", 8.2)

        c.drawString(
            table_x + 4 * mm,
            y - 5.5 * mm,
            discount_label,
        )

        c.setFillColor(MUSTARD)
        c.setFont("Helvetica-Bold", 9)

        c.drawRightString(
            table_right - 4 * mm,
            y - 5.5 * mm,
            f"- {format_soles(discount_amount)}",
        )

        y -= discount_height

    # =========================================================================
    # CONDICIONES DE PAGO
    # =========================================================================

    y -= 7 * mm

    c.setFillColor(BLUE_LIGHT)

    c.roundRect(
        margin_left,
        y - 5.5 * mm,
        52 * mm,
        6 * mm,
        1.5 * mm,
        stroke=0,
        fill=1,
    )

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 8.6)

    c.drawString(
        margin_left + 3 * mm,
        y - 3.7 * mm,
        "CONDICIONES DE PAGO",
    )

    y -= 7 * mm

    # -------------------------------------------------------------------------
    # CARD DE PAGO
    # -------------------------------------------------------------------------

    payment_height = 27 * mm

    c.setFillColor(WHITE)
    c.setStrokeColor(BORDER)

    c.roundRect(
        margin_left,
        y - payment_height,
        content_width,
        payment_height,
        2 * mm,
        stroke=1,
        fill=1,
    )

    # Barra lateral mostaza
    c.setFillColor(MUSTARD)

    c.roundRect(
        margin_left,
        y - payment_height,
        1.3 * mm,
        payment_height,
        0.7 * mm,
        stroke=0,
        fill=1,
    )

    row_y = y - 7 * mm

    # Modalidad
    c.setFillColor(GREY)
    c.setFont("Helvetica-Bold", 7)

    c.drawString(
        margin_left + 5 * mm,
        row_y,
        "MODALIDAD",
    )

    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 9)

    if payment_type == "credit":
        payment_label = "Financiamiento directo"
    else:
        payment_label = "Pago al contado"

    c.drawString(
        margin_left + 29 * mm,
        row_y,
        payment_label,
    )

    # Inicial
    c.setFillColor(GREY)
    c.setFont("Helvetica-Bold", 7)

    c.drawString(
        width / 2,
        row_y,
        "CUOTA INICIAL",
    )

    c.setFillColor(MUSTARD)
    c.setFont("Helvetica-Bold", 9.5)

    c.drawString(
        width / 2 + 31 * mm,
        row_y,
        format_soles(initial_payment),
    )

    if payment_type == "credit":

        row_y -= 9 * mm

        # Saldo
        saldo = max(
            display_total - initial_payment,
            0,
        )

        c.setFillColor(GREY)
        c.setFont("Helvetica-Bold", 7)

        c.drawString(
            margin_left + 5 * mm,
            row_y,
            "SALDO",
        )

        c.setFillColor(TEXT)
        c.setFont("Helvetica", 9)

        c.drawString(
            margin_left + 29 * mm,
            row_y,
            format_soles(saldo),
        )

        # Cuotas
        c.setFillColor(GREY)
        c.setFont("Helvetica-Bold", 7.5)

        c.drawString(
            width / 2,
            row_y,
            "PLAN DE CUOTAS",
        )

        cuotas_text = (
            f"{installments} cuotas mensuales de "
            f"{format_soles(installment_value)}"
        )

        text_x = width / 2 + 31 * mm
        font_name = "Helvetica"
        font_size = 9.5

        cuotas_width = c.stringWidth(
            cuotas_text, font_name, font_size
        )

        # Resaltar toda la línea de cuotas en amarillo
        pad = 2.0
        highlight_y = row_y - 0.5 * mm
        highlight_height = font_size * 1.35 + 2.5

        c.saveState()
        c.setFillColor(HIGHLIGHT_YELLOW)

        c.roundRect(
            text_x - pad,
            highlight_y,
            cuotas_width + 2 * pad,
            highlight_height,
            1.0,
            stroke=0,
            fill=1,
        )

        c.restoreState()

        c.setFillColor(TEXT)
        c.setFont(font_name, font_size)

        c.drawString(
            text_x,
            row_y,
            cuotas_text,
        )

    y -= payment_height + 7 * mm

    # =========================================================================
    # RESUMEN ECONÓMICO
    # =========================================================================

    summary_width = 76 * mm
    summary_x = width - margin_right - summary_width

    c.setFillColor(GREY)
    c.setFont("Helvetica-Bold", 8)

    c.drawString(
        summary_x,
        y,
        "RESUMEN ECONÓMICO",
    )

    y -= 5 * mm

    # Línea azul
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)

    c.line(
        summary_x,
        y,
        table_right,
        y,
    )

    y -= 6 * mm

    # Valor del lote (base: área × precio m²)
    base_price = lot_price - esquina_surcharge - frente_parque_surcharge - frente_a_pista_surcharge
    if price_per_m2 is not None and area_m2:
        valor_label = (
            f"Valor del lote ({area_m2:,.2f} m² × S/ {price_per_m2:,.2f})"
        )
    else:
        valor_label = "Valor del lote"

    c.setFillColor(TEXT)
    c.setFont("Helvetica", 9)

    c.drawString(
        summary_x,
        y,
        valor_label,
    )

    c.drawRightString(
        table_right,
        y,
        format_soles(base_price),
    )

    # Recargo lote en esquina
    if esquina_surcharge > 0:

        y -= 5.5 * mm

        c.setFillColor(GREY)

        c.drawString(
            summary_x,
            y,
            "Recargo lote en esquina",
        )

        c.setFillColor(TEXT)

        c.drawRightString(
            table_right,
            y,
            f"+ {format_soles(esquina_surcharge)}",
        )

    # Recargo frente a parque
    if frente_parque_surcharge > 0:

        y -= 5.5 * mm

        c.setFillColor(GREY)

        c.drawString(
            summary_x,
            y,
            "Recargo frente a parque",
        )

        c.setFillColor(TEXT)

        c.drawRightString(
            table_right,
            y,
            f"+ {format_soles(frente_parque_surcharge)}",
        )

    # Recargo frente a pista
    if frente_a_pista_surcharge > 0:

        y -= 5.5 * mm

        c.setFillColor(GREY)

        c.drawString(
            summary_x,
            y,
            "Recargo frente a pista",
        )

        c.setFillColor(TEXT)

        c.drawRightString(
            table_right,
            y,
            f"+ {format_soles(frente_a_pista_surcharge)}",
        )

    # Descuento
    if discount_amount > 0:

        y -= 5.5 * mm

        c.setFillColor(GREY)

        c.drawString(
            summary_x,
            y,
            "Beneficio comercial",
        )

        c.setFillColor(MUSTARD)

        c.drawRightString(
            table_right,
            y,
            f"- {format_soles(discount_amount)}",
        )

    # Línea destacada
    y -= 6 * mm

    c.setStrokeColor(MUSTARD)
    c.setLineWidth(0.8)

    c.line(
        summary_x,
        y,
        table_right,
        y,
    )

    y -= 7 * mm

    # Total
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 10)

    c.drawString(
        summary_x,
        y,
        "PRECIO TOTAL",
    )

    c.setFillColor(MUSTARD)
    c.setFont("Helvetica-Bold", 12)

    c.drawRightString(
        table_right,
        y,
        format_soles(display_total),
    )

    # =========================================================================
    # OBSERVACIONES
    # =========================================================================

    if notes:

        y -= 13 * mm

        c.setFillColor(MUSTARD_LIGHT)

        c.roundRect(
            margin_left,
            y - 5.5 * mm,
            48 * mm,
            6 * mm,
            1.5 * mm,
            stroke=0,
            fill=1,
        )

        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 8.6)

        c.drawString(
            margin_left + 3 * mm,
            y - 3.7 * mm,
            "OBSERVACIONES",
        )

        y -= 9 * mm

        note_style = ParagraphStyle(
            "netland_notes",
            fontName="Helvetica",
            fontSize=8.2,
            leading=10.5,
            textColor=TEXT,
        )

        note_para = Paragraph(
            notes.replace("\n", "<br/>"),
            note_style,
        )

        note_width = content_width - 8 * mm

        _, note_height = note_para.wrap(
            note_width,
            25 * mm,
        )

        note_box_height = max(
            note_height + 8 * mm,
            16 * mm,
        )

        c.setFillColor(WHITE)
        c.setStrokeColor(BORDER)

        c.roundRect(
            margin_left,
            y - note_box_height,
            content_width,
            note_box_height,
            2 * mm,
            stroke=1,
            fill=1,
        )

        # Barra mostaza
        c.setFillColor(MUSTARD)

        c.roundRect(
            margin_left,
            y - note_box_height,
            1.3 * mm,
            note_box_height,
            0.7 * mm,
            stroke=0,
            fill=1,
        )

        note_para.drawOn(
            c,
            margin_left + 5 * mm,
            y - note_height - 4 * mm,
        )

    # =========================================================================
    # PIE DE PÁGINA CORPORATIVA (estilo compartido)
    # =========================================================================

    _draw_corporate_footer(
        c,
        width,
        footer_document=footer_document,
        document_number=quote_number,
        generation_date=generation_date,
        generation_time=generation_time,
        phone=phone,
    )

    # =========================================================================
    # GUARDAR
    # =========================================================================

    c.save()

    return buffer.getvalue()


# ============================================================================
# HELPERS COMPARTIDOS PARA DOCUMENTOS OPERATIVOS
# ============================================================================

def _prepare_pdf():
    """Crea un canvas A4 en memoria y devuelve canvas + geometría."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    return c, buffer, width, height


def _draw_document_header(
    c: canvas.Canvas,
    width: float,
    title: str,
    document_number: str,
    company_name: str,
    company_ruc: str | None,
    company_address: str | None,
) -> None:
    """Cabecera corporativa para contratos y documentos de venta."""
    NAVY = colors.HexColor("#17324D")
    BLUE = colors.HexColor("#2F668F")
    MUSTARD = colors.HexColor("#B58A3A")
    DARK = colors.HexColor("#263238")
    GREY = colors.HexColor("#6B7780")

    margin_left = 14 * mm
    table_right = width - 14 * mm

    # Banda superior
    c.setFillColor(NAVY)
    c.rect(0, A4[1] - 20 * mm, A4[0], 20 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(margin_left, A4[1] - 13 * mm, title.upper())
    c.drawRightString(table_right, A4[1] - 13 * mm, document_number)

    # Empresa
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin_left, A4[1] - 30 * mm, company_name)
    c.setFillColor(GREY)
    c.setFont("Helvetica", 8.5)
    if company_ruc:
        c.drawString(margin_left, A4[1] - 35 * mm, f"RUC: {company_ruc}")
    if company_address:
        c.drawString(margin_left, A4[1] - 38.5 * mm, company_address)

    # Fecha de emisión a la derecha
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawRightString(table_right, A4[1] - 30 * mm, "Fecha de emisión")
    c.setFillColor(GREY)
    c.setFont("Helvetica", 8.5)
    c.drawRightString(table_right, A4[1] - 34 * mm, datetime.now().strftime("%d/%m/%Y %H:%M"))

    # Línea decorativa
    c.setStrokeColor(MUSTARD)
    c.setLineWidth(1.4)
    c.line(margin_left, A4[1] - 42 * mm, table_right, A4[1] - 42 * mm)


def _draw_info_block(
    c: canvas.Canvas,
    x: float,
    y: float,
    title: str,
    lines: list[tuple[str, str]],
) -> None:
    """Bloque de datos rotulado (cliente, inmueble, etc.)."""
    NAVY = colors.HexColor("#17324D")
    BLUE_LIGHT = colors.HexColor("#EAF2F7")
    DARK = colors.HexColor("#263238")
    GREY = colors.HexColor("#6B7780")

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x, y, title.upper())
    c.setStrokeColor(BLUE_LIGHT)
    c.setLineWidth(0.6)
    c.line(x, y - 2 * mm, x + 86 * mm, y - 2 * mm)

    row_y = y - 7 * mm
    for label, value in lines:
        c.setFillColor(GREY)
        c.setFont("Helvetica", 8.5)
        c.drawString(x, row_y, label)
        c.setFillColor(DARK)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + 32 * mm, row_y, value or "—")
        row_y -= 5 * mm


def _draw_footer(c: canvas.Canvas, width: float, note: str | None = None) -> None:
    """Pie de página estándar."""
    GREY = colors.HexColor("#6B7780")
    LIGHT_GREY = colors.HexColor("#B8C1C7")
    footer_y = 11 * mm

    c.setStrokeColor(LIGHT_GREY)
    c.setLineWidth(0.5)
    c.line(14 * mm, footer_y + 5 * mm, width - 14 * mm, footer_y + 5 * mm)
    c.setFillColor(GREY)
    c.setFont("Helvetica", 7.5)
    c.drawString(14 * mm, footer_y, "NETLAND Corporación Inmobiliaria")
    if note:
        c.drawString(14 * mm, footer_y - 4 * mm, note[:160])
    c.drawRightString(width - 14 * mm, footer_y, datetime.now().strftime("Generado el %d/%m/%Y"))


# ============================================================================
# CONTRATO DE COMPRAVENTA
# ============================================================================

def generate_contract_pdf(
    contract_number: str,
    company_name: str,
    owner_name: str,
    owner_document: str,
    project_name: str,
    block_code: str | None,
    lot_code: str,
    lot_area_m2: float,
    price_per_m2: float,
    total_price: float,
    contract_date: str,
    start_date: str,
    payment_modality: str,
    advisor_name: str | None = None,
    notes: str | None = None,
    company_ruc: str | None = None,
    company_address: str | None = None,
    owner_address: str | None = None,
    owner_civil_status: str | None = None,
    payment_plan: dict | None = None,
    initial_vouchers: list | None = None,
) -> bytes:
    """
    Genera un CONTRATO DE COMPRAVENTA DE BIEN FUTURO legalmente válido para el Perú.
    Incluye texto justificado, detalles de pagos, y cláusulas completas para notario.
    """
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT
    from reportlab.platypus import Paragraph, Spacer, SimpleDocTemplate, PageBreak, Table, TableStyle
    from reportlab.lib import colors as rl_colors
    
    buffer = io.BytesIO()
    
    # Configurar documento con márgenes
    margin = 18 * mm
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )
    
    # Colores corporativos
    NAVY = colors.HexColor("#17324D")
    BLUE_LIGHT = colors.HexColor("#EAF2F7")
    DARK = colors.HexColor("#263238")
    TEXT = colors.HexColor("#37474F")
    GREY = colors.HexColor("#6B7780")
    
    # Estilos de párrafo
    style_title = ParagraphStyle(
        'Title',
        fontName='Helvetica-Bold',
        fontSize=14,
        textColor=NAVY,
        alignment=TA_CENTER,
        spaceAfter=12,
    )
    
    style_subtitle = ParagraphStyle(
        'Subtitle',
        fontName='Helvetica',
        fontSize=9,
        textColor=TEXT,
        alignment=TA_CENTER,
        spaceAfter=8,
    )
    
    style_clausula_title = ParagraphStyle(
        'ClausulaTitle',
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=NAVY,
        spaceAfter=6,
        spaceBefore=10,
    )
    
    style_body = ParagraphStyle(
        'Body',
        fontName='Helvetica',
        fontSize=8.5,
        textColor=TEXT,
        alignment=TA_JUSTIFY,
        leading=12,
        spaceAfter=3,
    )
    
    style_body_bold = ParagraphStyle(
        'BodyBold',
        parent=style_body,
        fontName='Helvetica-Bold',
    )
    
    style_footer = ParagraphStyle(
        'Footer',
        fontName='Helvetica',
        fontSize=7,
        textColor=GREY,
        alignment=TA_CENTER,
    )
    
    # Construir contenido
    story = []
    
    # =========================================================================
    # ENCABEZADO
    # =========================================================================
    
    story.append(Paragraph("CONTRATO DE COMPRAVENTA DE BIEN FUTURO", style_title))
    story.append(Paragraph(
        f"Conste por el presente documento que se suscribe en tres (03) ejemplares, el contrato de "
        f"compraventa de bien futuro N° <b>{contract_number}</b>, que celebran:",
        style_subtitle
    ))
    story.append(Spacer(1, 8 * mm))
    
    # =========================================================================
    # PARTES CONTRATANTES
    # =========================================================================
    
    inmobiliaria_text = (
        f"De una parte <b>{company_name.upper()}</b>, con R.U.C. N° <b>{company_ruc or 'XXXXXXXXXXX'}</b>, "
        f"con domicilio para estos efectos en {company_address or 'Lima, Perú'}, en adelante se le denominará "
        f"<b>\"LA INMOBILIARIA\"</b>; y de la otra parte:"
    )
    story.append(Paragraph(inmobiliaria_text, style_body))
    story.append(Spacer(1, 3 * mm))
    
    adquiriente_parts = [
        f"<b>{owner_name.upper()}</b>, identificado(a) con <b>{owner_document}</b>",
    ]
    if owner_civil_status:
        adquiriente_parts.append(f"de estado civil <b>{owner_civil_status.lower()}</b>")
    if owner_address:
        adquiriente_parts.append(f"con domicilio para estos efectos en {owner_address.upper()}")
    
    adquiriente_text = ", ".join(adquiriente_parts) + ', en adelante se le denominará <b>"EL ADQUIRIENTE"</b>, en los términos y condiciones siguientes:'
    story.append(Paragraph(adquiriente_text, style_body))
    story.append(Spacer(1, 6 * mm))
    
    # =========================================================================
    # CLÁUSULA PRIMERA: ANTECEDENTES
    # =========================================================================
    
    story.append(Paragraph("PRIMERA: ANTECEDENTES", style_clausula_title))
    story.append(Paragraph(
        f"<b>{company_name.upper()}</b> es titular del proyecto inmobiliario denominado <b>\"{project_name.upper()}\"</b>, "
        f"el cual se encuentra en proceso de habilitación urbana ante la Municipalidad correspondiente. LA INMOBILIARIA "
        f"declara que a la fecha de la celebración del presente contrato está realizando todos los trámites administrativos "
        f"pertinentes para la habilitación urbana del proyecto, que contará con las conexiones troncales de agua, desagüe, "
        f"pistas y veredas, redes de energía eléctrica, áreas verdes y aportes normativos conforme a la normativa vigente.",
        style_body
    ))
    
    # =========================================================================
    # CLÁUSULA SEGUNDA: OBJETO DEL CONTRATO
    # =========================================================================
    
    lote_completo = f"Lote {lot_code}, Manzana \"{block_code}\"" if block_code else f"Lote {lot_code}"
    
    story.append(Paragraph("SEGUNDA: OBJETO DEL CONTRATO", style_clausula_title))
    story.append(Paragraph(
        f"<b>2.1.-</b> Por el presente documento, LA INMOBILIARIA transfiere en favor de EL ADQUIRIENTE la propiedad del "
        f"<b>{lote_completo}</b>, con un área de <b>{lot_area_m2:.2f} m²</b> (metros cuadrados).",
        style_body
    ))
    story.append(Paragraph(
        f"<b>2.2.-</b> EL ADQUIRIENTE declara saber y aceptar que la extensión superficial y medida perimétrica del lote "
        f"materia del presente contrato está supeditada a los reajustes definitivos que consten en el plano de replanteo, "
        f"resultante luego de la recepción de obras de la urbanización. Se celebra el presente contrato como compraventa "
        f"<b>AD MESURAM</b>, por lo que cualquier diferencia de área que resulte del replanteo final será ajustada "
        f"proporcionalmente al precio pactado por metro cuadrado.",
        style_body
    ))
    story.append(Paragraph(
        f"<b>2.3.-</b> EL ADQUIRIENTE declara conocer que el lote de terreno tiene la condición de <b>bien futuro</b>, "
        f"por tanto, a la firma del presente contrato no se encontrará independizado a nivel municipal ni registral. "
        f"En virtud del presente contrato y de conformidad con el Artículo 1534° del Código Civil, LA INMOBILIARIA "
        f"queda obligada a transferir el derecho real de propiedad sobre el lote individualizado, y EL ADQUIRIENTE "
        f"queda obligado a cancelar la totalidad del precio pactado.",
        style_body
    ))
    story.append(Paragraph(
        f"<b>2.4.-</b> Las partes acuerdan que la transferencia de propiedad se producirá de pleno derecho una vez que "
        f"llegue a existir el lote materia del presente contrato, es decir cuando se obtenga la habilitación urbana, "
        f"se realice la independización registral del {lote_completo}, y se inscriba la declaratoria de fábrica "
        f"correspondiente. El proyecto contará con servicios de agua, desagüe, energía eléctrica, pistas, veredas y áreas verdes.",
        style_body
    ))
    
    # =========================================================================
    # CLÁUSULA TERCERA: PRECIO Y FORMA DE PAGO
    # =========================================================================
    
    story.append(Paragraph("TERCERA: PRECIO Y FORMA DE PAGO", style_clausula_title))
    
    precio_letras = _number_to_words(total_price)
    story.append(Paragraph(
        f"<b>3.1.-</b> Por medio del presente contrato, LA INMOBILIARIA da en venta garantizada a EL ADQUIRIENTE el lote "
        f"descrito en la cláusula segunda, por el precio pactado de común acuerdo de <b>{format_soles(total_price)}</b> "
        f"(<b>{precio_letras.upper()}</b>), equivalente a un precio de <b>{format_soles(price_per_m2)}</b> por metro cuadrado.",
        style_body
    ))
    
    # Detalles de forma de pago
    if payment_modality == "contado":
        story.append(Paragraph(
            f"<b>3.2.-</b> El pago se realizará <b>AL CONTADO</b> en una sola armada mediante transferencia bancaria "
            f"o depósito en la cuenta de LA INMOBILIARIA. EL ADQUIRIENTE deberá presentar el comprobante de pago "
            f"(voucher) con los siguientes datos:",
            style_body
        ))
        story.append(Spacer(1, 2 * mm))
        
        # Tabla de datos bancarios
        bank_data = [
            ["Concepto", "Detalle"],
            ["Beneficiario", company_name],
            ["RUC", company_ruc or "XXXXXXXXXXX"],
            ["Banco", "____________________"],
            ["N° de Cuenta", "____________________"],
            ["Monto", format_soles(total_price)],
            ["Fecha de operación", "____________________"],
            ["N° de operación", "____________________"],
        ]
        
        bank_table = Table(bank_data, colWidths=[45*mm, 85*mm])
        bank_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BLUE_LIGHT),
            ('TEXTCOLOR', (0, 0), (-1, 0), NAVY),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#DCE3E7")),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(bank_table)
        story.append(Spacer(1, 3 * mm))
        
    else:
        # Pago financiado
        if payment_plan:
            inicial = float(payment_plan.get("initial_payment", 0))
            saldo = float(payment_plan.get("financed_amount", 0))
            cuotas = int(payment_plan.get("installments", 0))
            cuota_mensual = float(payment_plan.get("installment_value", 0))
            
            story.append(Paragraph(
                f"<b>3.2.-</b> El pago se realizará en la modalidad de <b>VENTA FINANCIADA</b> de la siguiente manera:",
                style_body
            ))
            story.append(Spacer(1, 2 * mm))
            
            # Desglose detallado del pago inicial
            story.append(Paragraph(
                f"<b>(i) Cuota Inicial:</b> {format_soles(inicial)}, pagadera a la firma del presente contrato mediante "
                f"transferencia bancaria o depósito, presentando el comprobante correspondiente.",
                style_body
            ))
            story.append(Spacer(1, 2 * mm))
            
            # Mostrar vouchers si existen, sino mostrar tabla vacía
            if initial_vouchers and len(initial_vouchers) > 0:
                import requests
                from io import BytesIO
                
                story.append(Paragraph(
                    "<b>Comprobantes de Pago Inicial:</b>",
                    style_body
                ))
                story.append(Spacer(1, 2 * mm))
                
                # Crear tabla con vouchers (máximo 2 por fila)
                voucher_rows = []
                for i in range(0, len(initial_vouchers), 2):
                    row_data = []
                    for j in range(2):
                        idx = i + j
                        if idx < len(initial_vouchers):
                            voucher = initial_vouchers[idx]
                            
                            # Descargar imagen del voucher
                            voucher_content = []
                            try:
                                response = requests.get(voucher["image_url"], timeout=5)
                                if response.status_code == 200:
                                    img_data = BytesIO(response.content)
                                    img = ImageReader(img_data)
                                    
                                    # Añadir imagen (40mm de ancho)
                                    from reportlab.platypus import Image as RLImage
                                    voucher_img = RLImage(img_data, width=40*mm, height=30*mm)
                                    voucher_content.append(voucher_img)
                            except:
                                voucher_content.append(Paragraph("<i>[Imagen no disponible]</i>", style_body))
                            
                            # Añadir datos del voucher
                            voucher_text = f"""
                            <b>Monto:</b> {format_soles(voucher['amount'])}<br/>
                            <b>Fecha:</b> {voucher['date']}<br/>
                            <b>Método:</b> {voucher['method']}<br/>
                            """
                            if voucher['transaction']:
                                voucher_text += f"<b>N° Op:</b> {voucher['transaction']}<br/>"
                            if voucher['bank']:
                                voucher_text += f"<b>Banco:</b> {voucher['bank']}"
                            
                            voucher_content.append(Spacer(1, 1*mm))
                            voucher_content.append(Paragraph(voucher_text, ParagraphStyle(
                                'voucher_detail',
                                fontName='Helvetica',
                                fontSize=7,
                                leading=9,
                                textColor=TEXT
                            )))
                            
                            row_data.append(voucher_content)
                        else:
                            row_data.append("")
                    
                    voucher_rows.append(row_data)
                
                # Crear tabla con los vouchers
                voucher_table = Table(voucher_rows, colWidths=[65*mm, 65*mm])
                voucher_table.setStyle(TableStyle([
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#DCE3E7")),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ('LEFTPADDING', (0, 0), (-1, -1), 5),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                ]))
                story.append(voucher_table)
            else:
                # Tabla vacía para llenar manualmente
                inicial_data = [
                    ["Datos del Pago Inicial", ""],
                    ["Monto", format_soles(inicial)],
                    ["Fecha de pago", "____________________"],
                    ["Banco", "____________________"],
                    ["N° de operación", "____________________"],
                ]
                
                inicial_table = Table(inicial_data, colWidths=[50*mm, 80*mm])
                inicial_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), BLUE_LIGHT),
                    ('SPAN', (0, 0), (1, 0)),
                    ('TEXTCOLOR', (0, 0), (-1, 0), NAVY),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#DCE3E7")),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ]))
                story.append(inicial_table)
            
            story.append(Spacer(1, 3 * mm))
            
            story.append(Paragraph(
                f"<b>(ii) Saldo Financiado:</b> {format_soles(saldo)}, a cancelarse en <b>{cuotas} cuotas mensuales</b> "
                f"de {format_soles(cuota_mensual)} cada una, con vencimiento los días <b>05 de cada mes</b>, iniciando "
                f"el primer vencimiento treinta (30) días calendario después de la firma del presente contrato.",
                style_body
            ))
            story.append(Paragraph(
                f"<b>3.3.-</b> Las cuotas mensuales serán pagadas <b>sin intereses moratorios</b> durante el plazo pactado, "
                f"siempre que se cumplan puntualmente las fechas de vencimiento. EL ADQUIRIENTE se compromete a realizar "
                f"cada pago mediante transferencia o depósito bancario, presentando el comprobante respectivo a LA INMOBILIARIA.",
                style_body
            ))
        else:
            story.append(Paragraph(
                f"<b>3.2.-</b> El saldo del precio se financiará según el cronograma de pagos que se anexa al presente contrato "
                f"como parte integrante del mismo.",
                style_body
            ))
    
    # =========================================================================
    # CLÁUSULA CUARTA: GARANTÍA DEL CONTRATO
    # =========================================================================
    
    story.append(Paragraph("CUARTA: GARANTÍA DEL CONTRATO", style_clausula_title))
    story.append(Paragraph(
        f"La cuota inicial pactada constituye garantía del cumplimiento de las obligaciones contraídas por EL ADQUIRIENTE "
        f"en el presente contrato. En caso de incumplimiento por parte de EL ADQUIRIENTE, LA INMOBILIARIA podrá resolver "
        f"el contrato de pleno derecho, reteniendo el 30% de las sumas pagadas como penalidad, devolviendo el saldo restante "
        f"en un plazo de treinta (30) días calendario, quedando el lote liberado para su comercialización.",
        style_body
    ))
    
    # =========================================================================
    # CLÁUSULA QUINTA: ENTREGA DEL BIEN
    # =========================================================================
    
    story.append(Paragraph("QUINTA: ENTREGA DEL BIEN", style_clausula_title))
    story.append(Paragraph(
        f"<b>5.1.-</b> LA INMOBILIARIA se obliga a entregar el lote materia de venta una vez que hayan sido recepcionadas "
        f"las obras de habilitación urbana por la Municipalidad correspondiente, en un plazo máximo de <b>18 meses</b>, "
        f"contabilizados a partir de la firma del presente contrato. Para dicha fecha, el lote contará con una partida "
        f"registral definitiva debidamente inscrita en Registros Públicos.",
        style_body
    ))
    story.append(Paragraph(
        f"<b>5.2.-</b> Excepcionalmente, el plazo podrá ser prorrogado por un período adicional de hasta ciento ochenta (180) "
        f"días calendario por causas no imputables a las partes, tales como caso fortuito, fuerza mayor, o demoras de las "
        f"autoridades administrativas y registrales. LA INMOBILIARIA notificará por escrito a EL ADQUIRIENTE cualquier "
        f"prórroga con al menos treinta (30) días de anticipación.",
        style_body
    ))
    story.append(Paragraph(
        f"<b>5.3.-</b> A fin de formalizar la entrega del inmueble, LA INMOBILIARIA citará por escrito a EL ADQUIRIENTE, "
        f"señalando día, hora y lugar para el acto de entrega. Si EL ADQUIRIENTE no se presentara en la fecha señalada, "
        f"se considerará que la entrega ha sido efectuada, quedando el bien bajo su custodia y responsabilidad.",
        style_body
    ))
    
    # =========================================================================
    # CLÁUSULA SEXTA: CARGAS Y GRAVÁMENES
    # =========================================================================
    
    story.append(Paragraph("SEXTA: CARGAS Y GRAVÁMENES", style_clausula_title))
    story.append(Paragraph(
        f"LA INMOBILIARIA declara que el lote estará libre de toda carga, gravamen, derecho real de garantía, medida judicial "
        f"o extrajudicial, y en general de todo acto o circunstancia que impida, prive o limite la libre disponibilidad y/o "
        f"el derecho de propiedad, posesión o uso del bien. LA INMOBILIARIA se obliga al saneamiento por evicción, que "
        f"comprenderá todos los conceptos previstos en el artículo 1495° del Código Civil.",
        style_body
    ))
    
    # =========================================================================
    # CLÁUSULA SÉPTIMA: IMPUESTOS Y GASTOS
    # =========================================================================
    
    story.append(Paragraph("SÉPTIMA: IMPUESTOS Y GASTOS", style_clausula_title))
    story.append(Paragraph(
        f"<b>7.1.-</b> Son de cargo de LA INMOBILIARIA los tributos que se hubieran devengado hasta la fecha del presente "
        f"contrato, incluyendo el impuesto predial y arbitrios municipales hasta la fecha de transferencia.",
        style_body
    ))
    story.append(Paragraph(
        f"<b>7.2.-</b> Serán de cuenta de EL ADQUIRIENTE todos los tributos que se devenguen con posterioridad a la fecha "
        f"de celebración del presente contrato, así como todos los gastos notariales y registrales que originen la minuta "
        f"y posterior escritura pública que formalizará este contrato, dentro de los alcances del artículo 1364° del Código Civil.",
        style_body
    ))
    
    # =========================================================================
    # CLÁUSULA OCTAVA: RESOLUCIÓN DEL CONTRATO
    # =========================================================================
    
    story.append(Paragraph("OCTAVA: RESOLUCIÓN DEL CONTRATO", style_clausula_title))
    story.append(Paragraph(
        f"El presente contrato se resolverá de pleno derecho, sin necesidad de declaración judicial, si EL ADQUIRIENTE "
        f"incurre en mora en el pago de dos (2) cuotas consecutivas o tres (3) alternadas. En tal caso, LA INMOBILIARIA "
        f"quedará facultada para retener el treinta por ciento (30%) de las cuotas pagadas como penalidad, devolviendo "
        f"el saldo restante en un plazo de treinta (30) días calendario. Asimismo, EL ADQUIRIENTE deberá entregar el lote "
        f"libre de ocupantes y en las mismas condiciones en que lo recibió.",
        style_body
    ))
    
    # =========================================================================
    # CLÁUSULA NOVENA: PREVENCIÓN DE LAVADO DE ACTIVOS
    # =========================================================================
    
    story.append(Paragraph("NOVENA: PREVENCIÓN DE LAVADO DE ACTIVOS Y FINANCIAMIENTO DEL TERRORISMO", style_clausula_title))
    story.append(Paragraph(
        f"EL ADQUIRIENTE, en este acto y con arreglo a la legislación peruana sobre prevención de lavado de activos y "
        f"financiamiento del terrorismo (Ley N° 27693 y sus modificatorias), declara bajo juramento que: <b>(a)</b> Adquiere "
        f"para sí y es el beneficiario final del bien inmueble; <b>(b)</b> Las sumas de dinero que utiliza para el pago del "
        f"presente contrato tienen origen legítimo y no están vinculadas a actividades ilícitas; <b>(c)</b> La presente "
        f"compraventa tiene su fundamento económico en actividades lícitas; y <b>(d)</b> Autoriza a LA INMOBILIARIA a "
        f"verificar la información proporcionada y reportar cualquier operación sospechosa a las autoridades competentes.",
        style_body
    ))
    
    # =========================================================================
    # CLÁUSULA DÉCIMA: DATOS PERSONALES
    # =========================================================================
    
    story.append(Paragraph("DÉCIMA: PROTECCIÓN DE DATOS PERSONALES", style_clausula_title))
    story.append(Paragraph(
        f"EL ADQUIRIENTE autoriza expresamente a LA INMOBILIARIA para que, en cumplimiento de la Ley N° 29733 (Ley de "
        f"Protección de Datos Personales), utilice sus datos personales proporcionados en el presente contrato para: "
        f"<b>(a)</b> Gestionar la relación contractual; <b>(b)</b> Enviar información sobre el avance de la habilitación "
        f"urbana y entrega del lote; <b>(c)</b> Remitir estados de cuenta y recordatorios de pago; y <b>(d)</b> Cumplir "
        f"con obligaciones legales y normativas. EL ADQUIRIENTE podrá ejercer sus derechos de acceso, rectificación, "
        f"cancelación y oposición en cualquier momento.",
        style_body
    ))
    
    # =========================================================================
    # CLÁUSULA DÉCIMO PRIMERA: MEDIOS DE COMUNICACIÓN
    # =========================================================================
    
    story.append(Paragraph("DÉCIMO PRIMERA: USO DE CORREO ELECTRÓNICO Y WHATSAPP", style_clausula_title))
    story.append(Paragraph(
        f"Las partes acuerdan que las notificaciones, comunicaciones y avisos relacionados con el presente contrato podrán "
        f"ser realizadas a través de correo electrónico y/o mensajería instantánea (WhatsApp) a los datos de contacto "
        f"proporcionados por cada parte. Dichas comunicaciones tendrán plena validez y eficacia legal. Cualquier cambio "
        f"en los datos de contacto deberá ser notificado por escrito a la otra parte con al menos quince (15) días de anticipación.",
        style_body
    ))
    
    # =========================================================================
    # CLÁUSULA DÉCIMO SEGUNDA: SOLUCIÓN DE CONTROVERSIAS
    # =========================================================================
    
    story.append(Paragraph("DÉCIMO SEGUNDA: SOLUCIÓN DE CONTROVERSIAS", style_clausula_title))
    story.append(Paragraph(
        f"Las partes acuerdan que cualquier desavenencia, controversia o reclamo que pudiera surgir con relación al presente "
        f"contrato, que no pudiera resolverse mediante trato directo, será sometida a arbitraje de derecho en la ciudad de "
        f"Lima, de conformidad con el Reglamento del Centro de Arbitraje de la Cámara de Comercio de Lima. El laudo arbitral "
        f"será definitivo, inapelable y de obligatorio cumplimiento para ambas partes. El presente contrato se rige por las "
        f"leyes de la República del Perú.",
        style_body
    ))
    
    story.append(Spacer(1, 10 * mm))
    
    # =========================================================================
    # RESUMEN DEL INMUEBLE
    # =========================================================================
    
    story.append(Paragraph("RESUMEN DEL BIEN MATERIA DEL CONTRATO", style_clausula_title))
    story.append(Spacer(1, 3 * mm))
    
    resumen_data = [
        ["Proyecto inmobiliario:", project_name],
        ["Identificación del lote:", lote_completo],
        ["Área del terreno:", f"{lot_area_m2:.2f} m²"],
        ["Precio por m²:", format_soles(price_per_m2)],
        ["PRECIO TOTAL:", format_soles(total_price)],
        ["Modalidad de pago:", "Al contado" if payment_modality == "contado" else "Financiado"],
    ]
    
    resumen_table = Table(resumen_data, colWidths=[55*mm, 75*mm])
    resumen_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BLUE_LIGHT),
        ('TEXTCOLOR', (0, 0), (-1, -1), DARK),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (0, 4), (1, 4), 'Helvetica-Bold'),  # PRECIO TOTAL en negrita
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#DCE3E7")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(resumen_table)
    story.append(Spacer(1, 12 * mm))
    
    # =========================================================================
    # FIRMAS
    # =========================================================================
    
    # Formatear fecha
    try:
        fecha_obj = datetime.strptime(contract_date, "%Y-%m-%d")
        meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
        fecha_formato = f"{fecha_obj.day} de {meses[fecha_obj.month-1]} de {fecha_obj.year}"
    except:
        fecha_formato = contract_date
    
    story.append(Paragraph(
        f"En señal de conformidad las partes suscriben el presente documento en Lima, {fecha_formato}.",
        style_body_bold
    ))
    story.append(Spacer(1, 20 * mm))
    
    # Tabla de firmas
    firma_data = [
        ["", ""],
        ["_______________________________", "_______________________________"],
        ["EL ADQUIRIENTE", "LA INMOBILIARIA"],
        [owner_name[:50].upper(), company_name[:50]],
        [owner_document, f"RUC N° {company_ruc or ''}"],
    ]
    
    firma_table = Table(firma_data, colWidths=[80*mm, 80*mm])
    firma_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 2), (-1, 2), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTSIZE', (0, 4), (-1, 4), 7.5),
        ('TEXTCOLOR', (0, 2), (-1, 2), NAVY),
        ('TEXTCOLOR', (0, 4), (-1, 4), GREY),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(firma_table)
    
    # =========================================================================
    # PIE DE PÁGINA
    # =========================================================================
    
    def add_footer(canvas, doc):
        """Agrega pie de página en cada página"""
        canvas.saveState()
        footer_text = f"Contrato N° {contract_number} • {company_name} • RUC {company_ruc or ''}"
        footer_text2 = "Documento válido para elevar ante Notario Público e inscribir en Registros Públicos"
        
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(GREY)
        canvas.drawCentredString(A4[0] / 2, 12 * mm, footer_text)
        canvas.drawCentredString(A4[0] / 2, 8 * mm, footer_text2)
        canvas.restoreState()
    
    # Construir PDF
    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    
    return buffer.getvalue()
    
    # Colores corporativos
    NAVY = colors.HexColor("#17324D")
    BLUE_LIGHT = colors.HexColor("#EAF2F7")
    DARK = colors.HexColor("#263238")
    TEXT = colors.HexColor("#37474F")
    GREY = colors.HexColor("#6B7780")
    MUSTARD = colors.HexColor("#B58A3A")
    BORDER = colors.HexColor("#DCE3E7")
    
    margin = 15 * mm
    right_margin = width - 15 * mm
    content_width = right_margin - margin
    
    # =========================================================================
    # ENCABEZADO DEL CONTRATO
    # =========================================================================
    
    y = height - 20 * mm
    
    # Título principal
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, y, "CONTRATO DE COMPRAVENTA DE TERRENO")
    
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(width / 2, y, f"N° {contract_number}")
    
    y -= 10 * mm
    
    # Línea separadora
    c.setStrokeColor(MUSTARD)
    c.setLineWidth(1.5)
    c.line(margin, y, right_margin, y)
    
    y -= 12 * mm
    
    # =========================================================================
    # PARTES CONTRATANTES
    # =========================================================================
    
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "CONSTE POR EL PRESENTE DOCUMENTO:")
    
    y -= 8 * mm
    
    c.setFillColor(TEXT)
    c.setFont("Helvetica", 9)
    
    # Texto justificado - Primera parte (VENDEDOR)
    text_lines = [
        f"El contrato de compraventa de terreno que celebran de una parte {company_name.upper()}, con RUC N° {company_ruc or 'XXXXXXXXXX'}, ",
        f"con domicilio en {company_address or 'Lima, Perú'}, a quien en adelante se denominará EL VENDEDOR; ",
        f"y de la otra parte {owner_name.upper()}, identificado(a) con {owner_document}, ",
    ]
    
    if owner_civil_status:
        text_lines.append(f"de estado civil {owner_civil_status.lower()}, ")
    
    if owner_address:
        text_lines.append(f"con domicilio en {owner_address}, ")
    
    text_lines.append("a quien en adelante se denominará EL COMPRADOR; en los términos y condiciones siguientes:")
    
    for line in text_lines:
        if y < 40 * mm:  # Nueva página si es necesario
            c.showPage()
            y = height - 20 * mm
        c.drawString(margin, y, line)
        y -= 4.5 * mm
    
    y -= 5 * mm
    
    # =========================================================================
    # CLÁUSULA PRIMERA: OBJETO DEL CONTRATO
    # =========================================================================
    
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(margin, y, "PRIMERA: OBJETO DEL CONTRATO")
    
    y -= 6 * mm
    
    c.setFillColor(TEXT)
    c.setFont("Helvetica", 9)
    
    lote_completo = f"Manzana {block_code}, Lote {lot_code}" if block_code else f"Lote {lot_code}"
    
    clausula_1 = [
        f"EL VENDEDOR transfiere en venta real y enajenación perpetua a favor de EL COMPRADOR, un terreno ",
        f"identificado como {lote_completo}, ubicado en el proyecto inmobiliario {project_name}, ",
        f"con un área de {lot_area_m2:.2f} metros cuadrados ({lot_area_m2:.2f} m²), cuyos linderos y medidas perimétricas ",
        "constan en el plano de lotización debidamente aprobado por las autoridades competentes.",
    ]
    
    for line in clausula_1:
        if y < 40 * mm:
            c.showPage()
            y = height - 20 * mm
        c.drawString(margin, y, line)
        y -= 4.5 * mm
    
    y -= 5 * mm
    
    # =========================================================================
    # CLÁUSULA SEGUNDA: PRECIO Y FORMA DE PAGO
    # =========================================================================
    
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(margin, y, "SEGUNDA: PRECIO Y FORMA DE PAGO")
    
    y -= 6 * mm
    
    c.setFillColor(TEXT)
    c.setFont("Helvetica", 9)
    
    precio_letras = _number_to_words(total_price)
    
    clausula_2 = [
        f"El precio total pactado por la compraventa del inmueble descrito es de {format_soles(total_price)} ",
        f"({precio_letras.upper()}), equivalente a un precio de {format_soles(price_per_m2)} por metro cuadrado.",
    ]
    
    # Agregar forma de pago
    if payment_modality == "contado":
        clausula_2.append("El pago se realizará al contado en una sola armada al momento de la firma del contrato.")
    else:
        if payment_plan:
            inicial = float(payment_plan.get("initial_payment", 0))
            saldo = float(payment_plan.get("financed_amount", 0))
            cuotas = int(payment_plan.get("installments", 0))
            cuota_mensual = float(payment_plan.get("installment_value", 0))
            
            clausula_2.extend([
                f"El pago se realizará de la siguiente manera: (i) Cuota inicial de {format_soles(inicial)} a la firma del contrato; ",
                f"(ii) Saldo de {format_soles(saldo)} en {cuotas} cuotas mensuales de {format_soles(cuota_mensual)} cada una, ",
                "con vencimiento los días 05 de cada mes, sin intereses moratorios durante el plazo pactado."
            ])
        else:
            clausula_2.append("El saldo del precio se financiará según cronograma de pagos adjunto al presente contrato.")
    
    for line in clausula_2:
        if y < 40 * mm:
            c.showPage()
            y = height - 20 * mm
        c.drawString(margin, y, line)
        y -= 4.5 * mm
    
    y -= 5 * mm
    
    # =========================================================================
    # CLÁUSULA TERCERA: OBLIGACIONES DEL VENDEDOR
    # =========================================================================
    
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(margin, y, "TERCERA: OBLIGACIONES DEL VENDEDOR")
    
    y -= 6 * mm
    
    c.setFillColor(TEXT)
    c.setFont("Helvetica", 9)
    
    c.drawString(margin, y, "EL VENDEDOR se obliga a:")
    y -= 5 * mm
    
    obligaciones_vendedor = [
        "a) Entregar el terreno libre de gravámenes, cargas o limitaciones de dominio.",
        "b) Otorgar la escritura pública de compraventa ante Notario Público una vez cancelado el precio total.",
        "c) Garantizar el saneamiento legal del inmueble y responder por la evicción que pudiera producirse.",
        "d) Entregar copia del plano de lotización y memorias descriptivas del proyecto.",
    ]
    
    for obligacion in obligaciones_vendedor:
        if y < 40 * mm:
            c.showPage()
            y = height - 20 * mm
        c.drawString(margin + 5 * mm, y, obligacion)
        y -= 4.5 * mm
    
    y -= 5 * mm
    
    # =========================================================================
    # CLÁUSULA CUARTA: OBLIGACIONES DEL COMPRADOR
    # =========================================================================
    
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(margin, y, "CUARTA: OBLIGACIONES DEL COMPRADOR")
    
    y -= 6 * mm
    
    c.setFillColor(TEXT)
    c.setFont("Helvetica", 9)
    
    c.drawString(margin, y, "EL COMPRADOR se obliga a:")
    y -= 5 * mm
    
    obligaciones_comprador = [
        "a) Pagar el precio pactado en la forma y plazos establecidos en la cláusula segunda.",
        "b) Asumir los gastos notariales y registrales para la formalización de la compraventa.",
        "c) Respetar las normas urbanísticas y restricciones del proyecto inmobiliario.",
        "d) Cumplir con las obligaciones tributarias correspondientes al inmueble adquirido.",
    ]
    
    for obligacion in obligaciones_comprador:
        if y < 40 * mm:
            c.showPage()
            y = height - 20 * mm
        c.drawString(margin + 5 * mm, y, obligacion)
        y -= 4.5 * mm
    
    y -= 5 * mm
    
    # =========================================================================
    # CLÁUSULA QUINTA: RESOLUCIÓN DEL CONTRATO
    # =========================================================================
    
    if y < 60 * mm:
        c.showPage()
        y = height - 20 * mm
    
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(margin, y, "QUINTA: RESOLUCIÓN DEL CONTRATO")
    
    y -= 6 * mm
    
    c.setFillColor(TEXT)
    c.setFont("Helvetica", 9)
    
    clausula_5 = [
        "El presente contrato se resolverá de pleno derecho si EL COMPRADOR incurre en mora en el pago de dos (2) cuotas ",
        "consecutivas o tres (3) alternadas, quedando EL VENDEDOR facultado para retener el 30% de las cuotas pagadas como ",
        "penalidad, devolviendo el saldo restante. Asimismo, el contrato podrá resolverse por incumplimiento de las obligaciones ",
        "esenciales de cualquiera de las partes, previo requerimiento notarial con plazo de 15 días calendarios para subsanar."
    ]
    
    for line in clausula_5:
        if y < 40 * mm:
            c.showPage()
            y = height - 20 * mm
        c.drawString(margin, y, line)
        y -= 4.5 * mm
    
    y -= 5 * mm
    
    # =========================================================================
    # CLÁUSULA SEXTA: JURISDICCIÓN Y COMPETENCIA
    # =========================================================================
    
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(margin, y, "SEXTA: JURISDICCIÓN Y COMPETENCIA")
    
    y -= 6 * mm
    
    c.setFillColor(TEXT)
    c.setFont("Helvetica", 9)
    
    clausula_6 = [
        "Para efectos de cualquier controversia derivada del presente contrato, las partes se someten expresamente a la ",
        "jurisdicción de los Jueces y Tribunales del Distrito Judicial de Lima, renunciando al fuero de sus domicilios."
    ]
    
    for line in clausula_6:
        if y < 40 * mm:
            c.showPage()
            y = height - 20 * mm
        c.drawString(margin, y, line)
        y -= 4.5 * mm
    
    y -= 8 * mm
    
    # =========================================================================
    # DATOS DEL INMUEBLE (Cuadro resumen)
    # =========================================================================
    
    if y < 80 * mm:
        c.showPage()
        y = height - 20 * mm
    
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(margin, y, "DATOS DEL INMUEBLE Y MONTO DE LA OPERACIÓN")
    
    y -= 7 * mm
    
    # Cuadro resumen
    box_height = 35 * mm
    c.setFillColor(BLUE_LIGHT)
    c.roundRect(margin, y - box_height, content_width, box_height, 2 * mm, stroke=0, fill=1)
    
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.roundRect(margin, y - box_height, content_width, box_height, 2 * mm, stroke=1, fill=0)
    
    # Contenido del cuadro
    row_y = y - 8 * mm
    line_height = 6 * mm
    
    datos = [
        ("Proyecto:", project_name),
        ("Identificación del lote:", lote_completo),
        ("Área del terreno:", f"{lot_area_m2:.2f} m²"),
        ("Precio por m²:", format_soles(price_per_m2)),
        ("Precio total:", format_soles(total_price)),
    ]
    
    c.setFillColor(GREY)
    c.setFont("Helvetica-Bold", 8)
    for label, value in datos:
        c.drawString(margin + 4 * mm, row_y, label)
        c.setFillColor(DARK)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(margin + 55 * mm, row_y, value)
        c.setFillColor(GREY)
        c.setFont("Helvetica-Bold", 8)
        row_y -= line_height
    
    y -= box_height + 10 * mm
    
    # =========================================================================
    # FIRMAS
    # =========================================================================
    
    if y < 60 * mm:
        c.showPage()
        y = height - 20 * mm
    
    c.setFillColor(TEXT)
    c.setFont("Helvetica", 8.5)
    fecha_formato = datetime.strptime(contract_date, "%Y-%m-%d").strftime("%d de %B de %Y") if "-" in contract_date else contract_date
    c.drawCentredString(width / 2, y, f"Lima, {fecha_formato}")
    
    y -= 20 * mm
    
    # Líneas de firma
    firma_width = 70 * mm
    firma_left_x = margin + 10 * mm
    firma_right_x = width - margin - firma_width - 10 * mm
    
    c.setStrokeColor(NAVY)
    c.setLineWidth(0.8)
    c.line(firma_left_x, y, firma_left_x + firma_width, y)
    c.line(firma_right_x, y, firma_right_x + firma_width, y)
    
    y -= 5 * mm
    
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(firma_left_x + firma_width / 2, y, "EL COMPRADOR")
    c.drawCentredString(firma_right_x + firma_width / 2, y, "EL VENDEDOR")
    
    y -= 4 * mm
    
    c.setFillColor(TEXT)
    c.setFont("Helvetica", 8)
    c.drawCentredString(firma_left_x + firma_width / 2, y, owner_name[:60])
    c.drawCentredString(firma_right_x + firma_width / 2, y, company_name[:60])
    
    y -= 3.5 * mm
    
    c.setFillColor(GREY)
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(firma_left_x + firma_width / 2, y, owner_document)
    c.drawCentredString(firma_right_x + firma_width / 2, y, f"RUC {company_ruc or ''}")
    
    # =========================================================================
    # PIE DE PÁGINA
    # =========================================================================
    
    footer_y = 15 * mm
    c.setFillColor(GREY)
    c.setFont("Helvetica", 7)
    c.drawCentredString(width / 2, footer_y, f"Contrato N° {contract_number} • {company_name}")
    c.drawCentredString(width / 2, footer_y - 3.5 * mm, "Este documento tiene validez legal para ser elevado ante Notario Público")
    
    c.save()
    return buffer.getvalue()


# ============================================================================
# DOCUMENTO COMERCIAL (PROFORMA / BOLETA / FACTURA)
# ============================================================================

def generate_commercial_document_pdf(
    document_type: str,
    document_number: str,
    company_name: str,
    customer_name: str,
    customer_document: str,
    issue_date: str,
    items: list[dict],
    total_amount: float,
    company_ruc: str | None = None,
    company_address: str | None = None,
    note: str | None = None,
    payment_plan: dict | None = None,
    company_razon_social: str | None = None,
    company_accounts: list[str] | None = None,
    company_phone: str = "",
    footer_document: str | None = None,
) -> bytes:
    """Genera una proforma, boleta, factura o documento de venta en PDF con el
    estilo corporativo de las cotizaciones (logo, encabezado y pie de página)."""
    c, buffer, width, height = _prepare_pdf()

    now = datetime.now()
    generation_date = issue_date or now.strftime("%d/%m/%Y")
    generation_time = now.strftime("%H:%M")

    title = {
        "proforma": "PROFORMA",
        "boleta": "BOLETA DE VENTA",
        "factura": "FACTURA",
        "venta": "VENTA DE TERRENO",
    }.get(document_type, "DOCUMENTO DE VENTA")

    footer_label = footer_document or title.title()

    y, content_width, right_x = _draw_corporate_header(
        c,
        width,
        height,
        document_label=title,
        document_number=document_number,
        generation_date=generation_date,
        generation_time=generation_time,
        company_name=company_name,
        company_ruc=company_ruc,
        company_razon_social=company_razon_social,
        company_address=company_address,
        company_accounts=company_accounts,
    )

    margin_left = 18 * mm
    pal = _corporate_palette()
    navy = pal["navy"]
    blue = pal["blue"]
    blue_light = pal["blue_light"]
    mustard = pal["mustard"]
    dark = pal["dark"]
    text = pal["text"]
    grey = pal["grey"]
    border = pal["border"]
    white = colors.white

    # -------------------------------------------------------------------------
    # DATOS DEL CLIENTE (card estilo cotización)
    # -------------------------------------------------------------------------

    y -= 15 * mm

    c.setFillColor(blue_light)
    c.roundRect(margin_left, y - 5.5 * mm, 43 * mm, 6 * mm, 1.5 * mm, stroke=0, fill=1)
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 8.6)
    c.drawString(margin_left + 3 * mm, y - 3.7 * mm, "DATOS DEL CLIENTE")

    y -= 7 * mm

    card_height = 20 * mm
    c.setFillColor(white)
    c.setStrokeColor(border)
    c.setLineWidth(0.5)
    c.roundRect(margin_left, y - card_height, content_width, card_height, 2 * mm, stroke=1, fill=1)

    c.setFillColor(blue)
    c.roundRect(margin_left, y - card_height, 1.3 * mm, card_height, 0.7 * mm, stroke=0, fill=1)

    row_y = y - 7 * mm
    c.setFillColor(grey)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(margin_left + 5 * mm, row_y, "CLIENTE")
    c.setFillColor(dark)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(margin_left + 29 * mm, row_y, customer_name or "—")

    c.setFillColor(grey)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(width / 2, row_y, "DOCUMENTO")
    c.setFillColor(dark)
    c.setFont("Helvetica", 9.2)
    c.drawString(width / 2 + 29 * mm, row_y, customer_document or "—")

    row_y -= 8 * mm
    c.setFillColor(grey)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(margin_left + 5 * mm, row_y, "FECHA")
    c.setFillColor(text)
    c.setFont("Helvetica", 9.2)
    c.drawString(margin_left + 29 * mm, row_y, f"{generation_date} · {generation_time}")



    y -= card_height + 6 * mm

    # -------------------------------------------------------------------------
    # DETALLE DEL INMUEBLE / CONCEPTOS (Tabla profesional estilo factura SUNAT)
    # -------------------------------------------------------------------------

    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 8.6)
    c.drawString(margin_left, y - 3 * mm, "DETALLE DE LA OPERACIÓN")

    y -= 8 * mm

    # Encabezados de tabla estilo factura
    header_height = 7 * mm
    c.setFillColor(navy)
    c.rect(margin_left, y - header_height, content_width, header_height, stroke=0, fill=1)

    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 7.5)
    
    # Columnas: CANT | DESCRIPCIÓN | P.UNIT | SUBTOTAL
    col_cant_x = margin_left + 3 * mm
    col_desc_x = margin_left + 15 * mm
    col_unit_x = right_x - 55 * mm
    col_subtotal_x = right_x - 3 * mm
    
    c.drawString(col_cant_x, y - 4.5 * mm, "CANT.")
    c.drawString(col_desc_x, y - 4.5 * mm, "DESCRIPCIÓN")
    c.drawString(col_unit_x, y - 4.5 * mm, "P.UNITARIO")
    c.drawRightString(col_subtotal_x, y - 4.5 * mm, "SUBTOTAL")

    y -= header_height

    # Filas de conceptos
    row_amount = 0
    for idx, item in enumerate(items):
        row_height = 12 * mm
        description = str(item.get("description", ""))
        amount = float(item.get("amount", 0))
        quantity = item.get("quantity", 1)
        unit_price = amount / quantity if quantity > 0 else amount
        row_amount += amount

        # Fondo alternado
        if idx % 2 == 0:
            c.setFillColor(white)
        else:
            c.setFillColor(colors.HexColor("#F8F9FA"))
        c.rect(margin_left, y - row_height, content_width, row_height, stroke=0, fill=1)

        # Borde inferior sutil
        c.setStrokeColor(colors.HexColor("#E9ECEF"))
        c.setLineWidth(0.3)
        c.line(margin_left, y - row_height, right_x, y - row_height)

        text_y = y - 7 * mm
        
        # Cantidad
        c.setFillColor(text)
        c.setFont("Helvetica", 8.5)
        c.drawString(col_cant_x, text_y, str(quantity))
        
        # Descripción
        c.setFillColor(dark)
        c.setFont("Helvetica", 9)
        
        # Dividir descripción en líneas si es muy larga
        description_lines = description.splitlines()
        if len(description_lines) > 2:
            description_lines = description_lines[:2]
        
        for lnum, line in enumerate(description_lines):
            # Truncar si es muy largo
            max_chars = 65
            if len(line) > max_chars:
                line = line[:max_chars-3] + "..."
            c.drawString(col_desc_x, text_y - lnum * 3.8 * mm, line)
        
        # Precio unitario
        c.setFillColor(text)
        c.setFont("Helvetica", 8.5)
        c.drawString(col_unit_x, text_y, format_soles(unit_price))
        
        # Subtotal
        c.setFillColor(dark)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawRightString(col_subtotal_x, text_y, format_soles(amount))

        y -= row_height

    # -------------------------------------------------------------------------
    # RESUMEN (Subtotal, IGV, Total) - Estilo factura real
    # -------------------------------------------------------------------------
    
    y -= 3 * mm
    
    # Área de resumen con fondo
    summary_height = 28 * mm
    summary_width = 65 * mm
    summary_x = right_x - summary_width
    
    c.setFillColor(colors.HexColor("#F8F9FA"))
    c.roundRect(summary_x, y - summary_height, summary_width, summary_height, 2 * mm, stroke=0, fill=1)
    
    # Borde del resumen
    c.setStrokeColor(border)
    c.setLineWidth(0.5)
    c.roundRect(summary_x, y - summary_height, summary_width, summary_height, 2 * mm, stroke=1, fill=0)
    
    # Calcular montos (Perú: normalmente sin IGV para terrenos, pero lo dejamos preparado)
    subtotal = total_amount / 1.18  # Si tuviera IGV
    igv = total_amount - subtotal
    
    # Para inmobiliaria de terrenos, generalmente no hay IGV, así que:
    subtotal_real = total_amount
    igv_real = 0.00
    
    row_y = y - 7 * mm
    line_height = 6 * mm
    
    # Subtotal (Operación Gravada / Exonerada)
    c.setFillColor(grey)
    c.setFont("Helvetica", 8.5)
    c.drawString(summary_x + 4 * mm, row_y, "Op. Exonerada:")
    c.setFillColor(dark)
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(right_x - 4 * mm, row_y, format_soles(subtotal_real))
    
    row_y -= line_height
    
    # IGV 18% (normalmente 0 para terrenos)
    c.setFillColor(grey)
    c.setFont("Helvetica", 8.5)
    c.drawString(summary_x + 4 * mm, row_y, "IGV (18%):")
    c.setFillColor(dark)
    c.setFont("Helvetica", 9)
    c.drawRightString(right_x - 4 * mm, row_y, format_soles(igv_real))
    
    row_y -= line_height
    
    # Línea separadora
    c.setStrokeColor(mustard)
    c.setLineWidth(1)
    c.line(summary_x + 4 * mm, row_y + 2 * mm, right_x - 4 * mm, row_y + 2 * mm)
    
    row_y -= line_height + 1 * mm
    
    # TOTAL
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(summary_x + 4 * mm, row_y, "TOTAL:")
    c.setFillColor(mustard)
    c.setFont("Helvetica-Bold", 13)
    c.drawRightString(right_x - 4 * mm, row_y, format_soles(total_amount))

    y -= summary_height + 3 * mm
    
    # Monto en letras (requisito SUNAT)
    c.setFillColor(grey)
    c.setFont("Helvetica-Oblique", 8)
    amount_in_words = _number_to_words(total_amount)
    c.drawString(margin_left, y, f"SON: {amount_in_words.upper()}")

    y -= 10 * mm
    
    # -------------------------------------------------------------------------
    # OBSERVACIONES E INFORMACIÓN ADICIONAL (Estilo profesional)
    # -------------------------------------------------------------------------
    
    if note or document_type in ["boleta", "factura"]:
        # Fondo sutil para la sección
        obs_height = 20 * mm if note else 15 * mm
        c.setFillColor(colors.HexColor("#FAFBFC"))
        c.roundRect(margin_left, y - obs_height, content_width, obs_height, 2 * mm, stroke=0, fill=1)
        
        # Borde
        c.setStrokeColor(colors.HexColor("#E9ECEF"))
        c.setLineWidth(0.4)
        c.roundRect(margin_left, y - obs_height, content_width, obs_height, 2 * mm, stroke=1, fill=0)
        
        obs_y = y - 5 * mm
        
        # Título
        c.setFillColor(navy)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(margin_left + 4 * mm, obs_y, "OBSERVACIONES:")
        
        obs_y -= 5 * mm
        
        # Contenido de observaciones
        c.setFillColor(text)
        c.setFont("Helvetica", 7.8)
        
        if note:
            # Nota personalizada
            note_lines = note.split('\n')
            for line in note_lines[:3]:  # Máximo 3 líneas
                c.drawString(margin_left + 4 * mm, obs_y, line[:100])
                obs_y -= 3.5 * mm
        else:
            # Observaciones estándar para documentos fiscales
            if document_type == "boleta":
                c.drawString(margin_left + 4 * mm, obs_y, "• Operación exonerada del IGV según Art. 2° Inc. b) Ley N° 28194")
                obs_y -= 3.5 * mm
                c.drawString(margin_left + 4 * mm, obs_y, "• Venta de terreno sin construir")
            elif document_type == "factura":
                c.drawString(margin_left + 4 * mm, obs_y, "• Operación exonerada del IGV según Art. 2° Inc. b) Ley N° 28194")
                obs_y -= 3.5 * mm
                c.drawString(margin_left + 4 * mm, obs_y, "• Primera venta de inmueble realizada por el constructor")
            else:
                c.drawString(margin_left + 4 * mm, obs_y, "• Documento referencial, no constituye comprobante de pago")
                obs_y -= 3.5 * mm
                c.drawString(margin_left + 4 * mm, obs_y, "• Precios y condiciones sujetos a disponibilidad")
        
        y -= obs_height + 3 * mm

    y -= 9 * mm

    # -------------------------------------------------------------------------
    # CONDICIONES DE PAGO (Estilo profesional e informativo)
    # -------------------------------------------------------------------------

    if payment_plan:
        c.setFillColor(blue_light)
        c.roundRect(margin_left, y - 5.5 * mm, 60 * mm, 6 * mm, 1.5 * mm, stroke=0, fill=1)
        c.setFillColor(navy)
        c.setFont("Helvetica-Bold", 8.6)
        c.drawString(margin_left + 3 * mm, y - 3.7 * mm, "FORMA DE PAGO")

        y -= 8 * mm

        modality = (payment_plan.get("modality") or "Financiado").lower()
        
        if "contado" in modality:
            plan_lines = [
                ("Modalidad", "Pago al contado"),
                ("Total a pagar", format_soles(total_amount)),
            ]
        else:
            initial = float(payment_plan.get("initial_payment") or 0)
            financed = float(payment_plan.get("financed_amount") or 0)
            installments = int(payment_plan.get("installments") or 0)
            installment_val = float(payment_plan.get("installment_value") or 0)
            
            plan_lines = [
                ("Modalidad", "Financiamiento directo"),
                ("Cuota inicial", format_soles(initial)),
                ("Saldo a financiar", format_soles(financed)),
                ("N° de cuotas", f"{installments} cuotas mensuales"),
                ("Cuota mensual", format_soles(installment_val)),
            ]

        plan_height = 5 * mm + len(plan_lines) * 6.5 * mm
        
        # Fondo de la tarjeta
        c.setFillColor(white)
        c.setStrokeColor(border)
        c.roundRect(margin_left, y - plan_height, content_width, plan_height, 2 * mm, stroke=1, fill=1)

        # Barra lateral de color
        c.setFillColor(mustard)
        c.roundRect(margin_left, y - plan_height, 1.5 * mm, plan_height, 0.7 * mm, stroke=0, fill=1)

        row_y = y - 6 * mm
        
        for label, value in plan_lines:
            c.setFillColor(grey)
            c.setFont("Helvetica-Bold", 7)
            c.drawString(margin_left + 5 * mm, row_y, label.upper())
            c.setFillColor(dark)
            c.setFont("Helvetica-Bold", 9)
            c.drawString(margin_left + 35 * mm, row_y, value)
            row_y -= 6 * mm

        y -= plan_height + 6 * mm

    # -------------------------------------------------------------------------
    # OBSERVACIONES
    # -------------------------------------------------------------------------

    if note:
        y -= 8 * mm

        c.setFillColor(pal["mustard_light"])
        c.roundRect(margin_left, y - 5.5 * mm, 48 * mm, 6 * mm, 1.5 * mm, stroke=0, fill=1)
        c.setFillColor(navy)
        c.setFont("Helvetica-Bold", 8.6)
        c.drawString(margin_left + 3 * mm, y - 3.7 * mm, "OBSERVACIONES")

        y -= 9 * mm
        note_style = ParagraphStyle(
            "netland_notes_doc",
            fontName="Helvetica",
            fontSize=8.2,
            leading=10.5,
            textColor=text,
        )
        note_para = Paragraph(note.replace("\n", "<br/>"), note_style)
        note_width = content_width - 8 * mm
        _, note_height = note_para.wrap(note_width, 25 * mm)
        note_box_height = max(note_height + 8 * mm, 16 * mm)

        c.setFillColor(white)
        c.setStrokeColor(border)
        c.roundRect(margin_left, y - note_box_height, content_width, note_box_height, 2 * mm, stroke=1, fill=1)
        c.setFillColor(mustard)
        c.roundRect(margin_left, y - note_box_height, 1.3 * mm, note_box_height, 0.7 * mm, stroke=0, fill=1)
        note_para.drawOn(c, margin_left + 5 * mm, y - note_height - 4 * mm)

    # -------------------------------------------------------------------------
    # PIE DE PÁGINA
    # -------------------------------------------------------------------------

    _draw_corporate_footer(
        c,
        width,
        footer_document=footer_label,
        document_number=document_number,
        generation_date=generation_date,
        generation_time=generation_time,
        phone=company_phone,
    )

    c.save()

    return buffer.getvalue()


# ============================================================================
# CRONOGRAMA DE PAGOS
# ============================================================================

def generate_payment_schedule_pdf(
    contract_number: str,
    company_name: str,
    owner_name: str,
    owner_document: str,
    project_name: str,
    block_code: str | None,
    lot_code: str,
    contract_date: str,
    payment_modality: str,
    total_price: float,
    initial_payment: float,
    financed_amount: float,
    installment_amount: float,
    number_of_installments: int,
    installments: list[dict],
    company_ruc: str | None = None,
    company_razon_social: str | None = None,
    company_address: str | None = None,
    company_accounts: list[str] | None = None,
    company_phone: str = "",
) -> bytes:
    """
    Genera el cronograma de pagos de un contrato en PDF con el mismo estilo
    corporativo de las cotizaciones (encabezado y pie de página compartidos).
    """
    c, buffer, width, height = _prepare_pdf()

    now = datetime.now()
    generation_date = now.strftime("%d/%m/%Y")
    generation_time = now.strftime("%H:%M")

    document_label = "CRONOGRAMA DE PAGOS"
    document_number = contract_number

    y, content_width, right_x = _draw_corporate_header(
        c,
        width,
        height,
        document_label=document_label,
        document_number=document_number,
        generation_date=generation_date,
        generation_time=generation_time,
        company_name=company_name,
        company_ruc=company_ruc,
        company_razon_social=company_razon_social,
        company_address=company_address,
        company_accounts=company_accounts,
    )

    margin_left = 18 * mm
    pal = _corporate_palette()
    navy = pal["navy"]
    blue_light = pal["blue_light"]
    mustard = pal["mustard"]
    dark = pal["dark"]
    text = pal["text"]
    grey = pal["grey"]
    border = pal["border"]
    white = colors.white

    # -------------------------------------------------------------------------
    # DATOS DEL CONTRATO (card estilo cotización)
    # -------------------------------------------------------------------------

    y -= 15 * mm

    c.setFillColor(blue_light)
    c.roundRect(margin_left, y - 5.5 * mm, 52 * mm, 6 * mm, 1.5 * mm, stroke=0, fill=1)
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 8.6)
    c.drawString(margin_left + 3 * mm, y - 3.7 * mm, "DATOS DEL CONTRATO")

    y -= 7 * mm

    modality_label = "Financiado" if payment_modality == "financiado" else "Contado"

    card_lines = [
        ("PROPIETARIO", owner_name or "—"),
        ("DOCUMENTO", owner_document or "—"),
        ("PROYECTO", project_name or "—"),
        ("LOTE", f"{block_code + ' - ' if block_code else ''}{lot_code}"),
        ("MODALIDAD", modality_label),
        ("FECHA DE CONTRATO", contract_date or "—"),
    ]

    card_height = 6 * mm + len(card_lines) * 6 * mm + 5 * mm
    c.setFillColor(white)
    c.setStrokeColor(border)
    c.setLineWidth(0.5)
    c.roundRect(margin_left, y - card_height, content_width, card_height, 2 * mm, stroke=1, fill=1)

    c.setFillColor(pal["blue"])
    c.roundRect(margin_left, y - card_height, 1.3 * mm, card_height, 0.7 * mm, stroke=0, fill=1)

    row_y = y - 7 * mm
    for label, value in card_lines:
        c.setFillColor(grey)
        c.setFont("Helvetica-Bold", 6.8)
        c.drawString(margin_left + 5 * mm, row_y, label)
        c.setFillColor(dark)
        c.setFont("Helvetica-Bold", 8.8)
        c.drawRightString(right_x - 5 * mm, row_y, str(value))
        row_y -= 6 * mm

    y -= card_height + 6 * mm

    # -------------------------------------------------------------------------
    # CONDICIONES DEL FINANCIAMIENTO
    # -------------------------------------------------------------------------

    c.setFillColor(blue_light)
    c.roundRect(margin_left, y - 5.5 * mm, 52 * mm, 6 * mm, 1.5 * mm, stroke=0, fill=1)
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 8.6)
    c.drawString(margin_left + 3 * mm, y - 3.7 * mm, "PLAN DE FINANCIAMIENTO")

    y -= 7 * mm

    plan_lines = [
        ("Precio total", format_soles(total_price)),
        ("Cuota inicial", format_soles(initial_payment)),
        ("Monto financiado", format_soles(financed_amount)),
        ("N° de cuotas", str(number_of_installments)),
        ("Cuota mensual", format_soles(installment_amount)),
    ]
    if payment_modality == "contado":
        plan_lines = [
            ("Precio total", format_soles(total_price)),
            ("Modalidad", "Pago al contado"),
        ]

    plan_height = 7 * mm + len(plan_lines) * 6 * mm + 5 * mm
    c.setFillColor(white)
    c.setStrokeColor(border)
    c.roundRect(margin_left, y - plan_height, content_width, plan_height, 2 * mm, stroke=1, fill=1)

    c.setFillColor(mustard)
    c.roundRect(margin_left, y - plan_height, 1.3 * mm, plan_height, 0.7 * mm, stroke=0, fill=1)

    row_y = y - 7 * mm
    for label, value in plan_lines:
        c.setFillColor(grey)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(margin_left + 5 * mm, row_y, label.upper())
        c.setFillColor(dark)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(margin_left + 35 * mm, row_y, value)
        row_y -= 6 * mm

    y -= plan_height + 7 * mm

    # -------------------------------------------------------------------------
    # TABLA DE CUOTAS (con paginación)
    # -------------------------------------------------------------------------

    bottom_limit = 30 * mm

    def _draw_schedule_header():
        nonlocal y
        c.setFillColor(blue_light)
        c.roundRect(margin_left, y - 5.5 * mm, 52 * mm, 6 * mm, 1.5 * mm, stroke=0, fill=1)
        c.setFillColor(navy)
        c.setFont("Helvetica-Bold", 8.6)
        c.drawString(margin_left + 3 * mm, y - 3.7 * mm, "CRONOGRAMA DE CUOTAS")
        y -= 7 * mm

        header_height = 8 * mm
        col_widths = [18 * mm, 26 * mm, 30 * mm, 28 * mm, 28 * mm, 30 * mm]
        col_labels = ["CUOTA", "VENCIMIENTO", "PROGRAMADO", "PAGADO", "SALDO CAPITAL", "ESTADO"]

        c.setFillColor(navy)
        c.roundRect(margin_left, y - header_height, content_width, header_height, 1.5 * mm, stroke=0, fill=1)

        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 7)
        x_cursor = margin_left
        for label, col_w in zip(col_labels, col_widths):
            if label in ("PROGRAMADO", "PAGADO", "SALDO"):
                c.drawRightString(x_cursor + col_w - 2 * mm, y - 5 * mm, label)
            elif label == "ESTADO":
                c.drawCentredString(x_cursor + col_w / 2, y - 5 * mm, label)
            else:
                c.drawString(x_cursor + 2 * mm, y - 5 * mm, label)
            x_cursor += col_w

        y -= header_height

    def _draw_schedule_footer():
        nonlocal y
        c.setFillColor(grey)
        c.setFont("Helvetica", 8.5)
        y -= 4 * mm
        c.setFont("Helvetica", 7.5)
        c.drawString(
            margin_left + 3 * mm,
            y,
            "* El saldo muestra el capital pendiente sobre el monto financiado total después de cada cuota.",
        )
        y -= 5 * mm

    def _new_page():
        nonlocal y
        _draw_corporate_footer(
            c,
            width,
            footer_document="Cronograma de cuotas",
            document_number=document_number,
            generation_date=generation_date,
            generation_time=generation_time,
            phone=company_phone,
        )
        c.showPage()
        y, _, _ = _draw_corporate_header(
            c,
            width,
            height,
            document_label=document_label,
            document_number=document_number + f" · Pág. {c.getPageNumber()}",
            generation_date=generation_date,
            generation_time=generation_time,
            company_name=company_name,
            company_ruc=company_ruc,
            company_razon_social=company_razon_social,
            company_address=company_address,
            company_accounts=company_accounts,
        )
        y -= 15 * mm
        _draw_schedule_header()

    status_labels = {
        "pagada": "PAGADA",
        "pendiente": "PENDIENTE",
        "parcial": "PAGO PARCIAL",
        "vencida": "VENCIDA",
        "anulada": "ANULADA",
    }

    def _status_color(state: str):
        if state == "pagada":
            return colors.HexColor("#16a34a")
        if state == "vencida":
            return colors.HexColor("#dc2626")
        if state == "parcial":
            return colors.HexColor("#f59e0b")
        if state == "anulada":
            return colors.HexColor("#9ca3af")
        return colors.HexColor("#0891b2")

    row_height = 7 * mm
    col_widths = [18 * mm, 26 * mm, 30 * mm, 28 * mm, 28 * mm, 30 * mm]

    # Saldo amortizado: capital pendiente sobre el monto financiado total.
    total_scheduled = sum(float(i.get("scheduled_amount", 0)) for i in installments)
    total_paid = sum(float(i.get("paid_amount", 0)) for i in installments)
    total_balance = sum(float(i.get("balance", 0)) for i in installments)
    rounding_diff = financed_amount - total_scheduled
    running = 0.0
    saldo_after = []
    for ix, inst in enumerate(installments):
        amortization = float(inst.get("scheduled_amount", 0))
        if ix == len(installments) - 1:
            amortization += rounding_diff
        running += amortization
        saldo_after.append(max(0.0, financed_amount - running))

    _draw_schedule_header()

    for idx, inst in enumerate(installments):
        if y - row_height < bottom_limit:
            _new_page()

        if idx % 2 == 0:
            c.setFillColor(white)
        else:
            c.setFillColor(pal["blue_pale"])
        c.setStrokeColor(border)
        c.setLineWidth(0.5)
        c.rect(margin_left, y - row_height, content_width, row_height, stroke=1, fill=1)

        state = str(inst.get("status", "pendiente"))
        state_label = status_labels.get(state, state.upper())
        text_y = y - 4.8 * mm
        x_cursor = margin_left

        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(dark)
        c.drawString(x_cursor + 2 * mm, text_y, f"{int(inst.get('installment_number', 0)):02d}")
        x_cursor += col_widths[0]

        c.setFont("Helvetica", 8)
        c.setFillColor(text)
        due_date = inst.get("due_date") or ""
        if not isinstance(due_date, str):
            due_date = due_date.strftime("%d/%m/%Y") if hasattr(due_date, "strftime") else str(due_date)
        c.drawString(x_cursor + 2 * mm, text_y, str(due_date))
        x_cursor += col_widths[1]

        c.setFillColor(text)
        c.drawRightString(x_cursor + col_widths[2] - 2 * mm, text_y, format_soles(float(inst.get("scheduled_amount", 0))))
        x_cursor += col_widths[2]

        c.drawRightString(x_cursor + col_widths[3] - 2 * mm, text_y, format_soles(float(inst.get("paid_amount", 0))))
        x_cursor += col_widths[3]

        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(dark)
        saldo_val = saldo_after[idx] if idx < len(saldo_after) else 0.0
        c.drawRightString(x_cursor + col_widths[4] - 2 * mm, text_y, format_soles(saldo_val))
        x_cursor += col_widths[4]

        c.setFillColor(_status_color(state))
        c.setFont("Helvetica-Bold", 7.5)
        label_w = c.stringWidth(state_label, "Helvetica-Bold", 7.5)
        c.drawCentredString(x_cursor + col_widths[5] / 2, text_y, state_label)

        y -= row_height

    # Fila de totales del cronograma
    if installments:
        if y - row_height < bottom_limit:
            _new_page()

        c.setFillColor(pal["blue_pale"])
        c.setStrokeColor(border)
        c.setLineWidth(0.5)
        c.rect(margin_left, y - row_height, content_width, row_height, stroke=1, fill=1)

        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(navy)
        c.drawString(margin_left + 2 * mm, y - 4.8 * mm, "TOTALES")

        x_cursor = margin_left + col_widths[0] + col_widths[1]
        c.drawRightString(x_cursor + col_widths[2] - 2 * mm, y - 4.8 * mm, format_soles(total_scheduled))
        x_cursor += col_widths[2]
        c.setFillColor(colors.HexColor("#16a34a"))
        c.drawRightString(x_cursor + col_widths[3] - 2 * mm, y - 4.8 * mm, format_soles(total_paid))
        x_cursor += col_widths[3]
        c.setFillColor(navy)
        c.drawRightString(x_cursor + col_widths[4] - 2 * mm, y - 4.8 * mm, format_soles(total_balance))

        y -= row_height

    _draw_schedule_footer()

    _draw_corporate_footer(
        c,
        width,
        footer_document="Cronograma de cuotas",
        document_number=document_number,
        generation_date=generation_date,
        generation_time=generation_time,
        phone=company_phone,
    )

    c.save()

    return buffer.getvalue()