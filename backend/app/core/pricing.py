"""
Motor único de pricing para cotizaciones y ventas.

Centraliza el cálculo de:
  - precio bruto del lote (base + recargos)
  - descuento (porcentaje o monto fijo)
  - precio final
  - plan de pagos (cuota inicial, saldo y cuotas)

Cotizaciones y ventas usan estas funciones para que nunca diverjan.
"""


def round2(value: float) -> float:
    """Redondeo estándar a 2 decimales (mismo comportamiento que round)."""
    return round(float(value), 2)


def lot_gross_price(
    base_lot_price,
    *,
    esquina_surcharge=0,
    frente_parque_surcharge=0,
    frente_a_pista_surcharge=0,
) -> float:
    """Precio bruto del lote = precio base + recargos (redondeado a 2 dec.)."""
    gross = (
        float(base_lot_price)
        + float(esquina_surcharge or 0)
        + float(frente_parque_surcharge or 0)
        + float(frente_a_pista_surcharge or 0)
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
    """
    gross = float(gross_price)

    discount_amount = 0.0
    if discount_type == "percentage":
        discount_amount = gross * (float(discount_value or 0) / 100)
    elif discount_type == "fixed":
        discount_amount = float(discount_value or 0)

    final_price = max(gross - discount_amount, 0)

    initial = round2(float(initial_payment or 0))
    balance = max(final_price - initial, 0)

    if payment_type == "cash":
        installment_count = 0
        installment_value = 0
    else:
        installment_count = int(installments or 0)
        installment_value = (
            round2(balance / installment_count) if installment_count > 0 else 0
        )

    return {
        "gross_price": round2(gross),
        "discount_amount": discount_amount,
        "final_price": final_price,
        "initial_payment": initial,
        "installment_count": installment_count,
        "installment_value": installment_value,
        "financed_amount": round2(balance),
    }