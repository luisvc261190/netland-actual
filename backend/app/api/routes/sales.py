"""
API Routes para el módulo de Ventas.

Las ventas se modelan como contratos de compra-venta: el contrato es el
documento legal que cierra la operación, marca el lote como vendido y da
origen a la titularidad del propietario. Este módulo expone esa información
con foco comercial (estados de pago, montos cobrados y pendientes).
"""
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.pricing import compute_payment_plan, lot_gross_price
from app.domain.models import SiteConfig, User
from app.domain.owners_models import Contract
from app.infrastructure.owners_service import ContractsService, SalesService
from app.infrastructure.pdf_service import generate_commercial_document_pdf
from app.schemas.owners import SaleCreate, SaleItem

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_sale(
    sale_data: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra una venta completa desde el módulo de Ventas.

    Resuelve (o crea) al cliente y al propietario titular, valida que el lote
    esté disponible y genera el contrato de compraventa. La operación es
    atómica: si algo falla no se crea ni el contrato ni la titularidad.
    """
    import tempfile
    import base64
    from pathlib import Path
    from app.infrastructure.cloudinary_service import upload_file
    from app.domain.owners_models import Payment
    from app.core.config import settings
    
    try:
        sale_dict = sale_data.dict()
        initial_vouchers = sale_dict.pop("initial_vouchers", None)
        
        contract = SalesService.create_sale(db, sale_dict, user_id=current_user.id)
        
        # Procesar vouchers iniciales si existen
        vouchers_processed = 0
        if initial_vouchers:
            for voucher_data in initial_vouchers:
                # Crear registro de pago
                payment = Payment(
                    contract_id=contract.id,
                    payer_id=contract.owner_id,
                    payment_date=voucher_data.get("payment_date"),
                    amount=voucher_data.get("amount", 0),
                    payment_method="transferencia",  # Asumimos transferencia si hay voucher
                    transaction_number=voucher_data.get("transaction_number"),
                    bank_name=voucher_data.get("bank_name"),
                    notes="Pago inicial - Voucher subido al crear contrato",
                    created_by=current_user.id
                )
                
                # Si hay archivo en base64, subirlo a Cloudinary
                file_data = voucher_data.get("file_data")
                file_name = voucher_data.get("file_name")
                
                if file_data and settings.is_cloudinary_configured:
                    try:
                        # Decodificar base64 y guardar temporalmente
                        file_content = base64.b64decode(
                            file_data.split(",")[1] if "," in file_data else file_data
                        )
                        
                        with tempfile.NamedTemporaryFile(
                            delete=False, 
                            suffix=Path(file_name or "voucher.jpg").suffix
                        ) as tmp:
                            tmp.write(file_content)
                            tmp_path = tmp.name
                        
                        try:
                            result = upload_file(
                                tmp_path,
                                folder=f"vouchers/contract_{contract.id}",
                                resource_type="auto"
                            )
                            payment.receipt_url = result.get("url")
                            payment.receipt_public_id = result.get("public_id")
                        finally:
                            Path(tmp_path).unlink(missing_ok=True)
                    except Exception as e:
                        # Si falla la subida, continuamos sin el voucher
                        print(f"Error uploading voucher: {e}")
                
                db.add(payment)
                vouchers_processed += 1
            
            db.commit()
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    response = {
        "message": f"Venta registrada · Contrato {contract.contract_number}",
        "contract_id": contract.id,
        "contract_number": contract.contract_number,
        "owner_id": contract.owner_id,
        "lot_id": contract.lot_id,
    }
    
    if vouchers_processed > 0:
        response["vouchers_uploaded"] = vouchers_processed
    
    return response


@router.get("/", response_model=List[SaleItem])
def list_sales(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    project_id: Optional[int] = Query(None, description="Filtrar por proyecto"),
    status: Optional[str] = Query(None, description="Estado del contrato: activo | cancelado | resuelto | anulado"),
    payment_modality: Optional[str] = Query(None, description="contado | financiado"),
    payment_status: Optional[str] = Query(None, description="pendiente | parcial | pagado"),
    search: Optional[str] = Query(None, description="Buscar por propietario, documento o contrato"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista de ventas con estado comercial y de pago."""
    filters = {}
    if project_id:
        filters["project_id"] = project_id
    if status:
        filters["status"] = status
    if payment_modality:
        filters["payment_modality"] = payment_modality
    if payment_status:
        filters["payment_status"] = payment_status
    if search:
        filters["search"] = search

    return SalesService.get_sales(db, filters, skip, limit)


@router.get("/{contract_id}/pdf")
def generate_sale_pdf(
        contract_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ):
        """PDF de la venta con el mismo modelo comercial que los documentos emitidos del contrato."""
        contract = db.get(Contract, contract_id)
        if not contract:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada.")

        detail = ContractsService.get_contract_detail(db, contract.id)

        config = {
            c.key: c.value
            for c in db.query(SiteConfig).filter(
                SiteConfig.key.in_(
                    [
                        "company_ruc",
                        "company_razon_social",
                        "company_address",
                        "company_bank_accounts",
                    ]
                )
            ).all()
        }

        financing = detail.get("financing") or {}
        payment_type = "credit" if contract.payment_modality == "financiado" else "cash"

        esq = float(contract.esquina_surcharge or 0)
        frente_parque = float(contract.frente_parque_surcharge or 0)
        frente_pista = float(contract.frente_a_pista_surcharge or 0)
        disc_type = contract.discount_type or "none"
        disc_value = float(contract.discount_value or 0)

        # Pricing de venta = mismo motor que las cotizaciones (base + recargos - descuento)
        has_pricing = esq or frente_parque or frente_pista or disc_value > 0 or disc_type != "none"
        if has_pricing:
            base = (
                float(contract.price_per_m2) * float(contract.lot_area_m2)
                if contract.price_per_m2 and contract.lot_area_m2
                else 0
            )
            gross_lot_price = lot_gross_price(
                base,
                esquina_surcharge=esq,
                frente_parque_surcharge=frente_parque,
                frente_a_pista_surcharge=frente_pista,
            )
        else:
            base = float(contract.total_price or 0)
            gross_lot_price = base

        pdf_plan = compute_payment_plan(
            gross_price=gross_lot_price,
            discount_type=disc_type if has_pricing else "none",
            discount_value=disc_value,
            payment_type=payment_type,
            initial_payment=float(financing.get("initial_payment") or 0),
            installments=int(financing.get("number_of_installments") or 12),
        )

        lot_description = (
            f"Lote {detail.get('lot_code') or ''} · {detail.get('project_name') or 'Netland'}\n"
            f"Manzana: {detail.get('block_code') or '—'} · "
            f"Área: {float(contract.lot_area_m2):,.2f} m²"
        )
        items = [{"description": lot_description, "amount": round(base, 2)}]
        if esq > 0:
            items.append({"description": "Recargo lote en esquina", "amount": round(esq, 2)})
        if frente_parque > 0:
            items.append({"description": "Recargo frente a parque", "amount": round(frente_parque, 2)})
        if frente_pista > 0:
            items.append({"description": "Recargo frente a pista", "amount": round(frente_pista, 2)})
        if round(pdf_plan["discount_amount"], 2) > 0:
            desc_label = (
                f"Descuento ({float(disc_value):g}%)"
                if disc_type == "percentage"
                else f"Descuento (S/ {float(disc_value):,.2f})"
            )
            items.append({
                "description": desc_label,
                "amount": -round(pdf_plan["discount_amount"], 2),
            })

        total_amount = pdf_plan["final_price"] if has_pricing else float(contract.total_price or 0)

        payment_plan_info = {
            "modality": "Contado" if payment_type == "cash" else "Financiado",
            "initial_payment": round(pdf_plan["initial_payment"], 2),
            "financed_amount": round(pdf_plan["financed_amount"], 2),
            "installments": pdf_plan["installment_count"],
            "installment_value": round(pdf_plan["installment_value"], 2),
        }

        pdf = generate_commercial_document_pdf(
            document_type="venta",
            document_number=contract.contract_number,
            company_name=config.get("company_razon_social")
            or "NETLAND CORPORACION INMOBILIARIA S.A.C.",
            company_ruc=config.get("company_ruc") or "20610742468",
            company_address=config.get("company_address")
            or "Urb. Magisterial Mz. B Lote. 3, (cerca al Grifo Primax) - San Vicente de Cañete, Lima, Perú",
            customer_name=detail.get("owner_name"),
            customer_document=detail.get("owner_document"),
            issue_date=contract.contract_date.strftime("%d/%m/%Y")
            if contract.contract_date
            else datetime.now().strftime("%d/%m/%Y"),
            items=items,
            total_amount=total_amount,
            note=contract.notes or "",
            payment_plan=payment_plan_info,
        )

        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{contract.contract_number}.pdf"'
            },
        )