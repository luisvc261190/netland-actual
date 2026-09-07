"""
Servicios de lógica de negocio para Propietarios y Cobranzas
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple
from dateutil.relativedelta import relativedelta

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.pricing import compute_payment_plan, lot_gross_price
from app.domain.models import Client, Lot, Project, Block, Advisor
from app.domain.owners_models import (
    Owner,
    Contract,
    PropertyOwnership,
    CashPayment,
    FinancingPlan,
    Installment,
    Payment,
    PaymentAllocation,
    ImportBatch,
    ImportError,
    ContractDocument,
)


class OwnersService:
    """Servicio para gestión de propietarios"""

    @staticmethod
    def create_owner(db: Session, owner_data: dict, user_id: Optional[int] = None) -> Owner:
        """Crear propietario"""
        owner = Owner(**owner_data)
        if user_id:
            owner.created_by = user_id
        db.add(owner)
        db.commit()
        db.refresh(owner)
        return owner

    @staticmethod
    def get_owner_by_document(
        db: Session, document_type: str, document_number: str
    ) -> Optional[Owner]:
        """Buscar propietario por documento"""
        return db.query(Owner).filter(
            Owner.document_type == document_type,
            Owner.document_number == document_number
        ).first()

    @staticmethod
    def get_owner_with_summary(db: Session, owner_id: int) -> Optional[dict]:
        """Obtener propietario con resumen de propiedades"""
        owner = db.query(Owner).options(
            joinedload(Owner.client)
        ).filter(Owner.id == owner_id).first()
        
        if not owner:
            return None

        # Obtener contratos activos
        contracts = db.query(Contract).filter(
            Contract.owner_id == owner_id,
            Contract.status == "activo"
        ).all()

        total_purchased = sum(c.total_price for c in contracts)
        
        # Calcular totales pagados y deuda
        total_paid = Decimal("0.00")
        outstanding_balance = Decimal("0.00")
        overdue_debt = Decimal("0.00")

        for contract in contracts:
            if contract.payment_modality == "contado":
                cash = db.query(CashPayment).filter(
                    CashPayment.contract_id == contract.id
                ).first()
                if cash:
                    total_paid += cash.amount_paid
                    outstanding_balance += cash.balance
            else:
                financing = db.query(FinancingPlan).filter(
                    FinancingPlan.contract_id == contract.id
                ).first()
                if financing:
                    total_paid += (financing.financed_amount - financing.outstanding_balance)
                    outstanding_balance += financing.outstanding_balance
                    
                    # Calcular deuda vencida
                    overdue_installments = db.query(Installment).filter(
                        Installment.financing_plan_id == financing.id,
                        Installment.status.in_(["pendiente", "parcial", "vencida"]),
                        Installment.due_date < date.today()
                    ).all()
                    overdue_debt += sum(i.balance for i in overdue_installments)

        return {
            "owner": owner,
            "client": owner.client,
            "total_properties": len(contracts),
            "total_purchased": total_purchased,
            "total_paid": total_paid,
            "outstanding_balance": outstanding_balance,
            "overdue_debt": overdue_debt,
            "contracts": contracts
        }


class ContractsService:
    """Servicio para gestión de contratos"""

    @staticmethod
    def generate_contract_number(db: Session) -> str:
        """Generar número de contrato único"""
        year = datetime.now().year
        # Obtener el último número del año
        last_contract = db.query(Contract).filter(
            Contract.contract_number.like(f"CTR-{year}-%")
        ).order_by(Contract.contract_number.desc()).first()
        
        if last_contract:
            last_num = int(last_contract.contract_number.split("-")[-1])
            new_num = last_num + 1
        else:
            new_num = 1
        
        return f"CTR-{year}-{new_num:05d}"

    @staticmethod
    def create_contract(
        db: Session,
        contract_data: dict,
        co_owners: Optional[List[dict]] = None,
        user_id: Optional[int] = None
    ) -> Contract:
        """Crear contrato con posibles copropietarios"""
        # Generar número de contrato
        if "contract_number" not in contract_data:
            contract_data["contract_number"] = ContractsService.generate_contract_number(db)
        
        # Crear contrato
        contract = Contract(**contract_data)
        if user_id:
            contract.created_by = user_id
        
        db.add(contract)
        db.flush()  # Para obtener el ID

        # Crear ownership principal (100% si no hay copropietarios)
        main_ownership = PropertyOwnership(
            owner_id=contract.owner_id,
            lot_id=contract.lot_id,
            contract_id=contract.id,
            ownership_percentage=Decimal("100.00") if not co_owners else Decimal("0.00"),
            role="titular",
            created_by=user_id
        )
        db.add(main_ownership)

        # Crear copropietarios si existen
        if co_owners:
            for co_owner in co_owners:
                ownership = PropertyOwnership(
                    owner_id=co_owner["owner_id"],
                    lot_id=contract.lot_id,
                    contract_id=contract.id,
                    ownership_percentage=co_owner["percentage"],
                    role=co_owner.get("role", "copropietario"),
                    created_by=user_id
                )
                db.add(ownership)

        # Actualizar estado del lote a "sold"
        lot = db.query(Lot).filter(Lot.id == contract.lot_id).first()
        if lot:
            lot.status = "sold"

        db.commit()
        db.refresh(contract)
        return contract

    @staticmethod
    def get_contract_detail(db: Session, contract_id: int) -> Optional[dict]:
        """Obtener detalle completo del contrato"""
        contract = db.query(Contract).options(
            joinedload(Contract.owner).joinedload(Owner.client),
            joinedload(Contract.project),
            joinedload(Contract.lot).joinedload(Lot.block),
            joinedload(Contract.advisor)
        ).filter(Contract.id == contract_id).first()

        if not contract:
            return None

        # Obtener copropietarios
        ownerships = db.query(PropertyOwnership).options(
            joinedload(PropertyOwnership.owner).joinedload(Owner.client)
        ).filter(
            PropertyOwnership.contract_id == contract_id,
            PropertyOwnership.owner_id != contract.owner_id
        ).all()

        co_owners = [{
            "owner_id": o.owner_id,
            "name": f"{o.owner.first_name} {o.owner.paternal_surname}".strip() if o.owner.person_type == "natural" else o.owner.business_name,
            "percentage": float(o.ownership_percentage),
            "role": o.role
        } for o in ownerships]

        # Obtener información de pago
        cash_payment = None
        financing = None
        collection_status = "al_dia"
        total_paid = Decimal("0.00")
        outstanding_balance = Decimal("0.00")
        overdue_amount = Decimal("0.00")

        if contract.payment_modality == "contado":
            cash = db.query(CashPayment).filter(
                CashPayment.contract_id == contract_id
            ).first()
            if cash:
                cash_payment = {
                    "total_amount": float(cash.total_amount),
                    "amount_paid": float(cash.amount_paid),
                    "balance": float(cash.balance),
                    "status": cash.status
                }
                total_paid = cash.amount_paid
                outstanding_balance = cash.balance
                if cash.status != "pagado":
                    collection_status = "pendiente"
        else:
            fin = db.query(FinancingPlan).filter(
                FinancingPlan.contract_id == contract_id
            ).first()
            if fin:
                # Contar cuotas
                installments_paid = db.query(func.count(Installment.id)).filter(
                    Installment.financing_plan_id == fin.id,
                    Installment.status == "pagada"
                ).scalar()
                
                installments_pending = db.query(func.count(Installment.id)).filter(
                    Installment.financing_plan_id == fin.id,
                    Installment.status.in_(["pendiente", "parcial"])
                ).scalar()
                
                installments_overdue = db.query(func.count(Installment.id)).filter(
                    Installment.financing_plan_id == fin.id,
                    Installment.status == "vencida"
                ).scalar()

                # Próximo vencimiento
                next_installment = db.query(Installment).filter(
                    Installment.financing_plan_id == fin.id,
                    Installment.status.in_(["pendiente", "parcial"])
                ).order_by(Installment.due_date).first()

                financing = {
                    "total_price": float(fin.total_price),
                    "initial_payment": float(fin.initial_payment),
                    "financed_amount": float(fin.financed_amount),
                    "number_of_installments": fin.number_of_installments,
                    "installment_amount": float(fin.installment_amount),
                    "frequency": fin.frequency,
                    "outstanding_balance": float(fin.outstanding_balance),
                    "installments_paid": installments_paid,
                    "installments_pending": installments_pending,
                    "installments_overdue": installments_overdue,
                    "next_due_date": next_installment.due_date.isoformat() if next_installment else None
                }
                
                total_paid = fin.financed_amount - fin.outstanding_balance
                outstanding_balance = fin.outstanding_balance
                
                # Determinar estado de cobranza
                if installments_overdue > 0:
                    collection_status = "vencido"
                    # Calcular monto vencido
                    overdue_installments = db.query(Installment).filter(
                        Installment.financing_plan_id == fin.id,
                        Installment.status == "vencida"
                    ).all()
                    overdue_amount = sum(i.balance for i in overdue_installments)
                elif next_installment and (next_installment.due_date - date.today()).days <= 7:
                    collection_status = "proximo_vencer"
                else:
                    collection_status = "al_dia"

        return {
            "contract": contract,
            "owner_name": f"{contract.owner.first_name} {contract.owner.paternal_surname}".strip() if contract.owner.person_type == "natural" else contract.owner.business_name,
            "owner_document": f"{contract.owner.document_type} {contract.owner.document_number}",
            "project_name": contract.project.short_name,
            "block_code": contract.lot.block.code if contract.lot.block else None,
            "lot_code": contract.lot.code,
            "advisor_name": contract.advisor.name if contract.advisor else None,
            "co_owners": co_owners,
            "cash_payment": cash_payment,
            "financing": financing,
            "collection_status": collection_status,
            "total_paid": float(total_paid),
            "outstanding_balance": float(outstanding_balance),
            "overdue_amount": float(overdue_amount)
        }


class FinancingService:
    """Servicio para financiamiento y cuotas"""

    @staticmethod
    def create_financing_with_schedule(
        db: Session,
        financing_data: dict,
        user_id: Optional[int] = None
    ) -> FinancingPlan:
        """Crear plan de financiamiento y generar cronograma"""
        # Crear plan
        financing = FinancingPlan(**financing_data)
        financing.outstanding_balance = financing.financed_amount
        
        db.add(financing)
        db.flush()

        # Generar cronograma
        FinancingService.generate_installment_schedule(
            db, financing.id, financing.first_installment_date,
            financing.number_of_installments, financing.installment_amount,
            financing.frequency
        )

        db.commit()
        db.refresh(financing)
        return financing

    @staticmethod
    def generate_installment_schedule(
        db: Session,
        financing_plan_id: int,
        start_date: date,
        num_installments: int,
        installment_amount: Decimal,
        frequency: str = "mensual"
    ):
        """Generar cronograma de cuotas"""
        current_date = start_date
        
        for i in range(1, num_installments + 1):
            installment = Installment(
                financing_plan_id=financing_plan_id,
                installment_number=i,
                due_date=current_date,
                scheduled_amount=installment_amount,
                paid_amount=Decimal("0.00"),
                balance=installment_amount,
                status="pendiente",
                days_overdue=0
            )
            db.add(installment)
            
            # Calcular siguiente fecha según frecuencia
            if frequency == "mensual":
                current_date = current_date + relativedelta(months=1)
            elif frequency == "quincenal":
                current_date = current_date + timedelta(days=15)
            elif frequency == "semanal":
                current_date = current_date + timedelta(days=7)

    @staticmethod
    def update_overdue_status(db: Session):
        """Actualizar estado de cuotas vencidas"""
        today = date.today()
        
        # Obtener cuotas pendientes o parciales vencidas
        overdue_installments = db.query(Installment).filter(
            Installment.status.in_(["pendiente", "parcial"]),
            Installment.due_date < today
        ).all()

        for installment in overdue_installments:
            installment.status = "vencida"
            installment.days_overdue = (today - installment.due_date).days

        db.commit()


class PaymentsService:
    """Servicio para pagos y distribución"""

    @staticmethod
    def register_payment(
        db: Session,
        payment_data: dict,
        allocations: Optional[List[dict]] = None,
        user_id: Optional[int] = None
    ) -> Payment:
        """Registrar pago y distribuirlo a cuotas"""
        # Crear pago
        payment = Payment(**payment_data)
        if user_id:
            payment.created_by = user_id
        
        db.add(payment)
        db.flush()

        # Obtener contrato para determinar modalidad
        contract = db.query(Contract).filter(
            Contract.id == payment.contract_id
        ).first()

        if not contract:
            raise ValueError("Contrato no encontrado")

        if contract.payment_modality == "contado":
            # Aplicar a pago al contado
            cash = db.query(CashPayment).filter(
                CashPayment.contract_id == contract.id
            ).first()
            if cash:
                cash.amount_paid += payment.amount
                cash.balance = cash.total_amount - cash.amount_paid
                if cash.balance <= 0:
                    cash.balance = Decimal("0.00")
                    cash.status = "pagado"
                    cash.payment_date = payment.payment_date
        else:
            # Distribuir a cuotas
            if allocations:
                # Distribución manual
                applied_sum = Decimal("0.00")
                excess = Decimal("0.00")
                for alloc in allocations:
                    alloc_amount = Decimal(str(alloc["amount"]))
                    applied_sum += alloc_amount
                    excess += PaymentsService._allocate_to_installment(
                        db, payment.id, alloc["installment_id"], alloc_amount
                    )

                # Propagar el remanente del pago (lo que supera las cuotas marcadas)
                # y el excedente de cada cuota a las siguientes cuotas pendientes.
                remaining = payment.amount - applied_sum + excess
                if remaining > 0:
                    PaymentsService._distribute_amount(db, payment, remaining)
            else:
                # Distribución automática (cuota más antigua pendiente)
                PaymentsService._auto_allocate_payment(db, payment)

        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def _allocate_to_installment(
        db: Session,
        payment_id: int,
        installment_id: int,
        amount: Decimal
    ) -> Decimal:
        """Aplicar monto a una cuota específica y devolver el excedente no usado."""
        installment = db.query(Installment).filter(
            Installment.id == installment_id
        ).first()

        if not installment:
            raise ValueError(f"Cuota {installment_id} no encontrada")

        # Limitar el monto al saldo pendiente de la cuota
        applied = min(amount, installment.balance)
        excess = amount - applied

        if applied <= 0:
            return excess

        # Crear asignación
        allocation = PaymentAllocation(
            payment_id=payment_id,
            installment_id=installment_id,
            allocated_amount=applied
        )
        db.add(allocation)

        # Actualizar cuota
        installment.paid_amount += applied
        installment.balance = installment.scheduled_amount - installment.paid_amount

        # Actualizar estado
        if installment.balance <= 0:
            installment.balance = Decimal("0.00")
            installment.status = "pagada"
            installment.payment_date = date.today()
        elif installment.paid_amount > 0:
            installment.status = "parcial"

        # Actualizar saldo del financiamiento
        financing = db.query(FinancingPlan).filter(
            FinancingPlan.id == installment.financing_plan_id
        ).first()
        if financing:
            financing.outstanding_balance -= applied
            if financing.outstanding_balance < 0:
                financing.outstanding_balance = Decimal("0.00")

        return excess

    @staticmethod
    def _distribute_amount(db: Session, payment: Payment, amount: Decimal):
        """Aplicar un monto a las cuotas pendientes más antiguas."""
        # Obtener financiamiento del contrato
        contract = db.query(Contract).filter(
            Contract.id == payment.contract_id
        ).first()

        financing = db.query(FinancingPlan).filter(
            FinancingPlan.contract_id == contract.id
        ).first()

        if not financing:
            raise ValueError("Plan de financiamiento no encontrado")

        # Obtener cuotas pendientes ordenadas por fecha
        pending_installments = db.query(Installment).filter(
            Installment.financing_plan_id == financing.id,
            Installment.status.in_(["pendiente", "parcial", "vencida"]),
            Installment.balance > 0
        ).order_by(Installment.due_date).all()

        remaining_amount = amount

        for installment in pending_installments:
            if remaining_amount <= 0:
                break

            # Calcular cuánto aplicar a esta cuota
            amount_to_apply = min(remaining_amount, installment.balance)

            # Aplicar el monto
            excess = PaymentsService._allocate_to_installment(
                db, payment.id, installment.id, amount_to_apply
            )

            remaining_amount -= amount_to_apply - excess

    @staticmethod
    def _auto_allocate_payment(db: Session, payment: Payment):
        """Distribución automática del pago a las cuotas más antiguas"""
        PaymentsService._distribute_amount(db, payment, payment.amount)

    @staticmethod
    def cancel_payment(
        db: Session,
        payment_id: int,
        reason: str,
        user_id: Optional[int] = None
    ) -> Payment:
        """Anular un pago y revertir sus asignaciones"""
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        
        if not payment:
            raise ValueError("Pago no encontrado")
        
        if payment.is_cancelled:
            raise ValueError("El pago ya está anulado")

        # Obtener asignaciones
        allocations = db.query(PaymentAllocation).filter(
            PaymentAllocation.payment_id == payment_id
        ).all()

        # Revertir cada asignación
        for allocation in allocations:
            installment = db.query(Installment).filter(
                Installment.id == allocation.installment_id
            ).first()

            if installment:
                # Revertir monto de la cuota
                installment.paid_amount -= allocation.allocated_amount
                installment.balance = installment.scheduled_amount - installment.paid_amount

                # Actualizar estado
                if installment.paid_amount <= 0:
                    installment.paid_amount = Decimal("0.00")
                    installment.balance = installment.scheduled_amount
                    installment.status = "pendiente"
                    installment.payment_date = None
                elif installment.balance > 0:
                    installment.status = "parcial"

                # Revertir saldo del financiamiento
                financing = db.query(FinancingPlan).filter(
                    FinancingPlan.id == installment.financing_plan_id
                ).first()
                if financing:
                    financing.outstanding_balance += allocation.allocated_amount

        # Marcar pago como anulado
        payment.is_cancelled = True
        payment.cancelled_at = datetime.now()
        payment.cancellation_reason = reason
        if user_id:
            payment.cancelled_by = user_id

        db.commit()
        db.refresh(payment)
        return payment


class CollectionsService:
    """Servicio para cobranzas y reportes"""

    @staticmethod
    def get_dashboard_stats(db: Session) -> dict:
        """Obtener estadísticas del dashboard de cobranzas"""
        today = date.today()
        first_day_month = date(today.year, today.month, 1)
        
        # Total de contratos activos
        active_contracts = db.query(func.count(Contract.id)).filter(
            Contract.status == "activo"
        ).scalar()

        # Cartera total (suma de saldos pendientes)
        total_portfolio = Decimal("0.00")
        total_collected = Decimal("0.00")
        total_overdue = Decimal("0.00")

        # Contratos al contado
        cash_contracts = db.query(CashPayment).join(Contract).filter(
            Contract.status == "activo"
        ).all()
        
        for cash in cash_contracts:
            total_portfolio += cash.total_amount
            total_collected += cash.amount_paid

        # Contratos financiados
        financings = db.query(FinancingPlan).join(Contract).filter(
            Contract.status == "activo"
        ).all()

        for fin in financings:
            total_portfolio += fin.financed_amount
            total_collected += (fin.financed_amount - fin.outstanding_balance)
            
            # Calcular deuda vencida
            overdue = db.query(func.sum(Installment.balance)).filter(
                Installment.financing_plan_id == fin.id,
                Installment.status == "vencida"
            ).scalar()
            if overdue:
                total_overdue += overdue

        total_pending = total_portfolio - total_collected

        # Cobranzas de hoy
        collections_today = db.query(func.sum(Payment.amount)).filter(
            Payment.payment_date == today,
            Payment.is_cancelled == False
        ).scalar() or Decimal("0.00")

        # Cobranzas del mes
        collections_month = db.query(func.sum(Payment.amount)).filter(
            Payment.payment_date >= first_day_month,
            Payment.is_cancelled == False
        ).scalar() or Decimal("0.00")

        # Vencimientos próximos (7 días)
        upcoming_7_days = db.query(func.sum(Installment.scheduled_amount)).filter(
            Installment.status.in_(["pendiente", "parcial"]),
            Installment.due_date.between(today, today + timedelta(days=7))
        ).scalar() or Decimal("0.00")

        # Contratos con deuda vencida
        overdue_contracts = db.query(func.count(func.distinct(Contract.id))).join(
            FinancingPlan
        ).join(Installment).filter(
            Contract.status == "activo",
            Installment.status == "vencida"
        ).scalar()

        return {
            "total_portfolio": float(total_portfolio),
            "total_collected": float(total_collected),
            "total_pending": float(total_pending),
            "total_overdue": float(total_overdue),
            "collections_today": float(collections_today),
            "collections_month": float(collections_month),
            "upcoming_7_days": float(upcoming_7_days),
            "overdue_contracts": overdue_contracts,
            "active_contracts": active_contracts
        }

    @staticmethod
    def get_collection_items(
        db: Session,
        filters: dict = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[dict]:
        """Obtener listado de items para cobranza."""
        query = db.query(Contract).options(
            joinedload(Contract.owner).joinedload(Owner.client),
            joinedload(Contract.project),
            joinedload(Contract.lot).joinedload(Lot.block)
        ).filter(Contract.status == "activo")

        if filters:
            if filters.get("project_id"):
                query = query.filter(Contract.project_id == filters["project_id"])

            if filters.get("search"):
                search_term = f"%{filters['search']}%"
                query = query.join(Owner).join(Client).filter(
                    or_(
                        Client.name.ilike(search_term),
                        Owner.document_number.ilike(search_term),
                        Contract.contract_number.ilike(search_term)
                    )
                )

        contracts = query.all()

        today = date.today()
        items = [CollectionsService._compute_collection_item(db, contract, today) for contract in contracts]

        # El estado de cobranza se calcula por ítem (no es SQL), se filtra después.
        status_filter = filters.get("status") if filters else None
        if status_filter:
            items = [item for item in items if item["collection_status"] == status_filter]

        return items[skip : skip + limit]

    @staticmethod
    def _compute_collection_item(db: Session, contract: Contract, today: date) -> dict:
        """Calcula el detalle de cobranza de un contrato activo."""
        owner = contract.owner
        owner_name = (
            f"{owner.first_name} {owner.paternal_surname}".strip()
            if owner.person_type == "natural"
            else owner.business_name
        )
        owner_phone = owner.client.phone or owner.secondary_phone or ""

        item = {
            "contract_id": contract.id,
            "contract_number": contract.contract_number,
            "owner_name": owner_name,
            "owner_document": f"{owner.document_type} {owner.document_number}",
            "owner_phone": owner_phone,
            "project_name": contract.project.short_name,
            "block_code": contract.lot.block.code if contract.lot.block else None,
            "lot_code": contract.lot.code,
            "payment_modality": contract.payment_modality,
            "current_installment": None,
            "next_due_date": None,
            "installment_amount": None,
            "outstanding_balance": Decimal("0.00"),
            "overdue_amount": Decimal("0.00"),
            "days_overdue": 0,
            "overdue_installments": 0,
            "collection_status": "al_dia",
            # Campos adicionales para el módulo de ventas
            "total_price": Decimal("0.00"),
            "paid_amount": Decimal("0.00"),
            "payment_status": "pendiente",
        }

        if contract.payment_modality == "contado":
            cash = db.query(CashPayment).filter(
                CashPayment.contract_id == contract.id
            ).first()
            if cash:
                item["total_price"] = cash.total_amount
                item["outstanding_balance"] = cash.balance
                item["paid_amount"] = cash.amount_paid
                if cash.status != "pagado":
                    item["collection_status"] = "pendiente"
                item["payment_status"] = cash.status if cash.status in ("pagado", "pendiente") else "pendiente"
        else:
            financing = db.query(FinancingPlan).filter(
                FinancingPlan.contract_id == contract.id
            ).first()

            if financing:
                item["total_price"] = financing.total_price
                item["outstanding_balance"] = financing.outstanding_balance
                item["installment_amount"] = financing.installment_amount
                item["paid_amount"] = financing.financed_amount - financing.outstanding_balance
                item["payment_status"] = (
                    "pagado"
                    if financing.outstanding_balance <= 0
                    else "parcial"
                    if financing.outstanding_balance < financing.financed_amount
                    else "pendiente"
                )

                next_inst = db.query(Installment).filter(
                    Installment.financing_plan_id == financing.id,
                    Installment.status.in_(["pendiente", "parcial"])
                ).order_by(Installment.due_date).first()

                if next_inst:
                    item["current_installment"] = next_inst.installment_number
                    item["next_due_date"] = next_inst.due_date
                    if next_inst.due_date < today:
                        item["days_overdue"] = (today - next_inst.due_date).days

                overdue_insts = db.query(Installment).filter(
                    Installment.financing_plan_id == financing.id,
                    Installment.status == "vencida"
                ).all()
                item["overdue_installments"] = len(overdue_insts)
                item["overdue_amount"] = sum(i.balance for i in overdue_insts)

                if item["overdue_installments"] > 0:
                    item["collection_status"] = "vencido"
                elif next_inst and (next_inst.due_date - today).days <= 7:
                    item["collection_status"] = "proximo_vencer"

        return item


class SalesService:
    """Servicio para el módulo de Ventas (vista comercial sobre contratos)."""

    @staticmethod
    def get_sales(
        db: Session,
        filters: dict = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[dict]:
        """Lista operaciones de venta con estado comercial y de pago.

        Una venta equivale a un contrato de compra-venta (es el documento legal
        que cierra la operación y marca el lote como vendido).
        """
        query = db.query(Contract).options(
            joinedload(Contract.owner).joinedload(Owner.client),
            joinedload(Contract.project),
            joinedload(Contract.lot).joinedload(Lot.block)
        )
        filters = filters or {}

        if filters.get("project_id"):
            query = query.filter(Contract.project_id == filters["project_id"])
        if filters.get("status"):
            query = query.filter(Contract.status == filters["status"])
        if filters.get("payment_modality"):
            query = query.filter(Contract.payment_modality == filters["payment_modality"])

        if filters.get("search"):
            search_term = f"%{filters['search']}%"
            query = query.join(Owner).join(Client).filter(
                or_(
                    Client.name.ilike(search_term),
                    Owner.document_number.ilike(search_term),
                    Contract.contract_number.ilike(search_term),
                )
            )

        contracts = query.order_by(Contract.contract_date.desc()).all()

        today = date.today()
        sales = []
        for contract in contracts:
            detail = CollectionsService._compute_collection_item(db, contract, today)
            owner = contract.owner
            sales.append({
                "sale_id": contract.id,
                "contract_id": contract.id,
                "contract_number": contract.contract_number,
                "sale_date": contract.contract_date.isoformat(),
                "owner_name": detail["owner_name"],
                "owner_document": detail["owner_document"],
                "owner_phone": detail["owner_phone"],
                "project_name": contract.project.short_name,
                "block_code": detail["block_code"],
                "lot_code": detail["lot_code"],
                "lot_area_m2": float(contract.lot_area_m2),
                "price_per_m2": float(contract.price_per_m2),
                "total_price": contract.total_price,
                "payment_modality": contract.payment_modality,
                "sale_status": contract.status,
                "payment_status": detail["payment_status"],
                "paid_amount": detail["paid_amount"],
                "pending_amount": detail["outstanding_balance"],
                "collection_status": detail["collection_status"],
            })

        if filters.get("payment_status"):
            sales = [s for s in sales if s["payment_status"] == filters["payment_status"]]

        return sales[skip : skip + limit]

    @staticmethod
    def create_sale(
        db: Session,
        sale_data: dict,
        user_id: Optional[int] = None
    ) -> Contract:
        """Registra una venta completa y de forma atómica.

        Una venta = un contrato de compraventa. Este método se encarga de
        resolver (o crear) el cliente, el propietario titular y el contrato,
        además de validar que el lote esté disponible para la venta.
        """
        # --- Lote ---
        lot = db.query(Lot).filter(Lot.id == sale_data["lot_id"]).first()
        if not lot:
            raise ValueError("El lote seleccionado no existe")
        if lot.status not in ("available", "reserved"):
            raise ValueError(f"El lote {lot.code} no está disponible para la venta")
        if lot.project_id != sale_data["project_id"]:
            raise ValueError("El lote no pertenece al proyecto seleccionado")

        # --- Cliente ---
        client = None
        if sale_data.get("client_id"):
            client = db.query(Client).filter(Client.id == sale_data["client_id"]).first()
            if not client:
                raise ValueError("El cliente seleccionado no existe")

        if client is None:
            client_name = sale_data.get("business_name") or (
                f"{sale_data.get('first_name', '') or ''} "
                f"{sale_data.get('paternal_surname', '') or ''}"
            ).strip()
            if not client_name:
                raise ValueError("Indique el nombre del comprador (cliente)")

            client = Client(
                name=client_name[:120],
                last_name="",
                phone=(sale_data.get("client_phone") or "")[:30],
                whatsapp=(sale_data.get("client_whatsapp") or sale_data.get("client_phone") or "")[:30],
                email=sale_data.get("client_email") or "",
                notes="",
            )
            db.add(client)
            db.flush()

        # --- Propietario titular (reutilizar si ya existe por documento) ---
        owner = OwnersService.get_owner_by_document(
            db, sale_data["document_type"], sale_data["document_number"]
        )
        if owner is None:
            # Un cliente solo puede tener un propietario (unique client_id en owners)
            existing_by_client = db.query(Owner).filter(
                Owner.client_id == client.id, Owner.id != (owner.id if owner else 0)
            ).first()
            if existing_by_client:
                raise ValueError(
                    "El cliente seleccionado ya ha sido registrado como propietario "
                    f"({existing_by_client.document_type} {existing_by_client.document_number}). "
                    "Usa el documento del propietario existente o elige otro cliente."
                )

            person_type = sale_data.get("person_type", "natural")
            if person_type == "natural" and not (sale_data.get("first_name") or "").strip():
                raise ValueError("El nombre del comprador es obligatorio para persona natural")
            if person_type == "juridica" and not (sale_data.get("business_name") or "").strip():
                raise ValueError("La razón social es obligatoria para persona jurídica")

            owner = Owner(
                client_id=client.id,
                person_type=person_type,
                document_type=sale_data["document_type"],
                document_number=sale_data["document_number"],
                first_name=(sale_data.get("first_name") or "").strip() or None,
                paternal_surname=(sale_data.get("paternal_surname") or "").strip() or None,
                maternal_surname=(sale_data.get("maternal_surname") or "").strip() or None,
                business_name=(sale_data.get("business_name") or "").strip() or None,
                secondary_phone=(sale_data.get("secondary_phone") or "").strip() or None,
                is_active=True,
            )
            if user_id:
                owner.created_by = user_id
            db.add(owner)
            db.flush()

        # --- Datos del lote: autocompletar área y precios desde el lote ---
        lot_area_m2 = sale_data.get("lot_area_m2") or lot.area_m2
        total_price = sale_data.get("total_price") or lot.normal_price_soles or lot.price
        price_per_m2 = sale_data.get("price_per_m2") or lot.price_per_m2

        if not lot_area_m2 or Decimal(lot_area_m2) <= 0:
            raise ValueError("El lote no tiene un área válida; indíquela manualmente")
        lot_area_m2 = Decimal(str(lot_area_m2))

        if price_per_m2 is None and total_price:
            price_per_m2 = Decimal(str(total_price)) / lot_area_m2
        if price_per_m2 is None:
            raise ValueError("No se pudo determinar el precio por m² del lote")
        price_per_m2 = Decimal(str(price_per_m2))

        if not total_price or Decimal(str(total_price)) <= 0:
            raise ValueError("No se pudo determinar el precio total del lote")
        total_price = Decimal(str(total_price))

        # --- Pricing (misma lógica de precios que las cotizaciones) ---
        esquina_surcharge = Decimal(str(sale_data.get("esquina_surcharge") or 0))
        frente_parque_surcharge = Decimal(str(sale_data.get("frente_parque_surcharge") or 0))
        frente_a_pista_surcharge = Decimal(str(sale_data.get("frente_a_pista_surcharge") or 0))
        discount_type = sale_data.get("discount_type") or "none"
        discount_value = Decimal(str(sale_data.get("discount_value") or 0))
        payment_type = "credit" if sale_data["payment_modality"] == "financiado" else "cash"
        has_pricing = any([
            esquina_surcharge, frente_parque_surcharge, frente_a_pista_surcharge,
            discount_type != "none",
        ])

        if has_pricing:
            gross = lot_gross_price(
                lot_area_m2 * price_per_m2,
                esquina_surcharge=esquina_surcharge,
                frente_parque_surcharge=frente_parque_surcharge,
                frente_a_pista_surcharge=frente_a_pista_surcharge,
            )
        else:
            gross = float(total_price)

        plan = compute_payment_plan(
            gross_price=gross,
            discount_type=discount_type if has_pricing else "none",
            discount_value=discount_value,
            payment_type=payment_type,
            initial_payment=float(sale_data.get("initial_payment") or 0),
            installments=int(sale_data.get("number_of_installments") or 12),
        )
        total_price = Decimal(str(round(plan["final_price"], 2)))

        # --- Contrato de compraventa ---
        contract = ContractsService.create_contract(
            db,
            {
                "owner_id": owner.id,
                "project_id": sale_data["project_id"],
                "lot_id": lot.id,
                "advisor_id": sale_data.get("advisor_id"),
                "contract_date": sale_data["contract_date"],
                "start_date": sale_data["start_date"],
                "lot_area_m2": lot_area_m2,
                "price_per_m2": price_per_m2,
                "total_price": total_price,
                "payment_modality": sale_data["payment_modality"],
                "status": "activo",
                "notes": sale_data.get("notes"),
                "esquina_surcharge": esquina_surcharge,
                "frente_parque_surcharge": frente_parque_surcharge,
                "frente_a_pista_surcharge": frente_a_pista_surcharge,
                "discount_type": discount_type,
                "discount_value": discount_value,
            },
            user_id=user_id,
        )

        # --- Plan de pagos (misma lógica financiera que las cotizaciones) ---
        if sale_data["payment_modality"] == "financiado":
            initial_payment = Decimal(str(round(plan["initial_payment"], 2)))
            num_installments = plan["installment_count"]
            financed_amount = Decimal(str(round(plan["financed_amount"], 2)))
            installment_amount = Decimal(str(round(plan["installment_value"], 2)))
            if financed_amount <= 0:
                raise ValueError(
                    "La cuota inicial debe ser menor al precio total para una venta financiada"
                )
            first_date = sale_data.get("first_installment_date") or sale_data["start_date"]
            last_date = first_date + relativedelta(months=num_installments - 1)

            plan = FinancingPlan(
                contract_id=contract.id,
                total_price=total_price,
                initial_payment=initial_payment,
                financed_amount=financed_amount,
                number_of_installments=num_installments,
                installment_amount=installment_amount,
                frequency="mensual",
                first_installment_date=first_date,
                last_installment_date=last_date,
                interest_rate=Decimal("0.00"),
                total_interest=Decimal("0.00"),
                outstanding_balance=financed_amount,
            )
            db.add(plan)
            db.flush()
            FinancingService.generate_installment_schedule(
                db, plan.id, first_date, num_installments, installment_amount, "mensual"
            )
            db.commit()
            db.refresh(contract)
        elif sale_data["payment_modality"] == "contado":
            from app.domain.owners_models import CashPayment

            cash = CashPayment(
                contract_id=contract.id,
                total_amount=total_price,
                amount_paid=Decimal("0.00"),
                balance=total_price,
                payment_date=None,
                status="pendiente",
            )
            db.add(cash)
            db.commit()
            db.refresh(contract)

        return contract
