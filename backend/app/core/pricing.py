"""
Motor único de pricing para cotizaciones y ventas.

Centraliza el cálculo de:
  - precio bruto del lote (base + recargos)
  - descuento (porcentaje o monto fijo)
  - precio final
  - plan de pagos (cuota inicial, saldo y cuotas)

Toda operación monetaria usa Decimal con ROUND_HALF_UP (redondeo sobre
centavos, estándar financiero peruano) para que la suma de las cuotas
coincida exactamente con el monto financiado.

Cotizaciones y ventas usan estas funciones para que nunca diverjan.
"""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

CENT = Decimal("0.01")


def _d(value) -> Decimal:
    """Convierte a Decimal de forma segura."""
    if value is None or value == "":
        value = 0
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Valor monetario inválido: {value!r}") from exc


def decimal2(value) -> Decimal:
    """Redondeo monetario a 2 decimales con ROUND_HALF_UP."""
    return _d(value).quantize(CENT, rounding=ROUND_HALF_UP)


def round2(value) -> float:
    """Redondeo monetario a 2 decimales (float, para respuestas API)."""
    return float(decimal2(value))


def lot_gross_price(
    base_lot_price,
    *,
    esquina_surcharge=0,
    frente_parque_surcharge=0,
    frente_a_pista_surcharge=0,
) -> float:
    """Precio bruto del lote = precio base + recargos (redondeado a 2 dec.)."""
    gross = (
        _d(base_lot_price)
        + _d(esquina_surcharge)
        + _d(frente_parque_surcharge)
        + _d(frente_a_pista_surcharge)
    )
    return round2(gross)


def compute_payment_plan(
    *,
    gross_price,
    discount_type: str = "none",
    discount_value=0,
    payment_type: str = "credit",
    initial_payment=0,
    installments: int = 12,
) -> dict:
    """
    Calcula descuento, precio final y plan de pagos a partir del precio bruto.

    - discount_type: "none" | "percentage" | "fixed"
    - payment_type: "credit" | "cash"
    - El descuento se calcula sobre el precio bruto (base + recargos).
    - En "cash" no hay cuotas; el total se paga completo.
    - En "credit" todas las cuotas son iguales EXCEPTO la última, que absorbe
      la diferencia de redondeo para que sum(cuotas) == monto financiado.
    """
    gross = decimal2(gross_price)

    discount_amount = Decimal("0.00")
    if discount_type == "percentage":
        discount_amount = decimal2(gross * (_d(discount_value) / 100))
    elif discount_type == "fixed":
        discount_amount = decimal2(discount_value)

    final_price = max(gross - discount_amount, Decimal("0.00"))

    initial = decimal2(initial_payment)
    balance = max(final_price - initial, Decimal("0.00"))

    if payment_type == "cash":
        installment_count = 0
        installment_value = Decimal("0.00")
        last_installment_value = Decimal("0.00")
    else:
        installment_count = int(installments or 0)
        installment_value = Decimal("0.00")
        last_installment_value = Decimal("0.00")
        if installment_count > 0:
            base = decimal2(balance / installment_count)
            installment_value = base
            last = decimal2(balance - base * (installment_count - 1))
            last_installment_value = last if last >= CENT else base

    return {
        "gross_price": float(gross),
        "discount_amount": float(discount_amount),
        "final_price": float(final_price),
        "initial_payment": float(initial),
        "installment_count": installment_count,
        "installment_value": float(installment_value),
        "last_installment_value": float(last_installment_value),
        "financed_amount": float(balance),
    }