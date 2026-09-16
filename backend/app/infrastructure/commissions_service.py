"""
Servicio de negocio para el módulo de Comisiones y Planillas.
Gestiona la lógica de creación, pago, anulación y eliminación lógica
de comisiones de venta y mensualidades de asesores.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.domain.commission_models import AdvisorCommission, CommissionPayment
from app.domain.models import Advisor
from app.domain.owners_models import Contract


class CommissionsService:
    """Operaciones de negocio del módulo de comisiones."""

    # ------------------------------------------------------------------
    # Config (AdvisorCommission)
    # ------------------------------------------------------------------

    @staticmethod
    def create_config(
        db: Session,
        data: dict[str, Any],
        user_id: int | None = None,
    ) -> AdvisorCommission:
        advisor = db.get(Advisor, data["advisor_id"])
        if not advisor or advisor.deleted_at is not None:
            raise ValueError("Asesor no encontrado.")
        project_id = data["project_id"]

        # Verificar duplicado activo (mismo par sin eliminar)
        existing = (
            db.query(AdvisorCommission)
            .filter(
                AdvisorCommission.advisor_id == advisor.id,
                AdvisorCommission.project_id == project_id,
                AdvisorCommission.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            if existing.is_active:
                raise ValueError(
                    "Ya existe un porcentaje de comisión activo para este asesor y proyecto."
                )
            # Reactivar el existente en lugar de crear uno nuevo
            existing.commission_percent = data["commission_percent"]
            existing.is_active = True
            existing.updated_by = user_id
            db.commit()
            db.refresh(existing)
            return existing

        config = AdvisorCommission(
            advisor_id=advisor.id,
            project_id=project_id,
            commission_percent=data["commission_percent"],
            is_active=data.get("is_active", True),
            created_by=user_id,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        return config

    @staticmethod
    def update_config(
        db: Session,
        config_id: int,
        data: dict[str, Any],
        user_id: int | None = None,
    ) -> AdvisorCommission:
        config = db.get(AdvisorCommission, config_id)
        if not config or config.deleted_at is not None:
            raise ValueError("Configuración no encontrada.")
        for key, value in data.items():
            if value is not None:
                setattr(config, key, value)
        config.updated_by = user_id
        db.commit()
        db.refresh(config)
        return config

    @staticmethod
    def soft_delete_config(db: Session, config_id: int) -> None:
        config = db.get(AdvisorCommission, config_id)
        if not config or config.deleted_at is not None:
            raise ValueError("Configuración no encontrada.")
        config.deleted_at = datetime.utcnow()
        db.commit()

    @staticmethod
    def restore_config(db: Session, config_id: int) -> AdvisorCommission:
        config = db.get(AdvisorCommission, config_id)
        if not config:
            raise ValueError("Configuración no encontrada.")
        if config.deleted_at is None and config.is_active:
            return config

        # Verificar que no haya otro activo activo
        duplicate = (
            db.query(AdvisorCommission)
            .filter(
                AdvisorCommission.advisor_id == config.advisor_id,
                AdvisorCommission.project_id == config.project_id,
                AdvisorCommission.deleted_at.is_(None),
                AdvisorCommission.is_active == True,  # noqa: E712
                AdvisorCommission.id != config.id,
            )
            .first()
        )
        if duplicate:
            raise ValueError(
                "Ya existe otra configuración activa para este asesor y proyecto."
            )
        config.deleted_at = None
        config.is_active = True
        db.commit()
        db.refresh(config)
        return config

    # ------------------------------------------------------------------
    # Pagos de comisión / mensualidades
    # ------------------------------------------------------------------

    @staticmethod
    def build_and_create_payment(
        db: Session,
        data: dict[str, Any],
        user_id: int | None = None,
    ) -> dict[str, Any]:
        """Construye y guarda un registro de pago de comisión o mensualidad."""
        payment_type = data["payment_type"]
        contract_id = data.get("contract_id")
        advisor_id = data.get("advisor_id")
        project_id = data.get("project_id")

        # --- 1. Resolver contrato (opcional) ---
        contract = None
        contract_number = None
        if contract_id:
            contract = db.get(Contract, contract_id)
            if not contract:
                raise ValueError("Contrato no encontrado.")
            contract_number = contract.contract_number
            if payment_type == "comision":
                existing = (
                    db.query(CommissionPayment)
                    .filter(
                        CommissionPayment.contract_id == contract_id,
                        CommissionPayment.payment_type == "comision",
                        CommissionPayment.deleted_at.is_(None),
                    )
                    .first()
                )
                if existing:
                    raise ValueError(
                        f"El contrato {contract.contract_number} ya tiene una comisión "
                        f"generada ({'auto' if existing.origin == 'auto' else 'manual'}, "
                        f"estado {existing.payment_status}). Revisa el módulo de comisiones."
                    )
            if not advisor_id:
                advisor_id = contract.advisor_id
            if not project_id:
                project_id = contract.project_id

        if not advisor_id:
            raise ValueError("Selecciona un asesor para el registro.")

        advisor = db.get(Advisor, advisor_id)
        if not advisor or advisor.deleted_at is not None:
            raise ValueError("Asesor no encontrado.")

        project_name = None
        if project_id:
            from app.domain.models import Project as ProjectModel

            proj = db.get(ProjectModel, project_id)
            project_name = proj.name if proj else None

        # --- 2. Snapshot del asesor ---
        advisor_name = advisor.name
        document_type = advisor.document_type or "DNI"
        document_number = advisor.document_number or ""
        bank_name = advisor.bank_name or ""
        account_number = advisor.account_number or ""

        base_amount = None
        percent_applied = None
        concept = data.get("concept", "")

        # --- 3. Calcular monto ---
        if payment_type == "comision":
            base = data.get("base_amount") or (
                contract.total_price if contract else None
            )
            if base is None:
                raise ValueError(
                    "Indica el monto base de la comisión o vincula a un contrato."
                )
            base_amount = base

            percent = data.get("percent_applied")
            if not percent and advisor and project_id:
                config = (
                    db.query(AdvisorCommission)
                    .filter(
                        AdvisorCommission.advisor_id == advisor.id,
                        AdvisorCommission.project_id == project_id,
                        AdvisorCommission.is_active == True,  # noqa: E712
                        AdvisorCommission.deleted_at.is_(None),
                    )
                    .first()
                )
                if config:
                    percent = config.commission_percent

            if not percent:
                raise ValueError(
                    "Configura el porcentaje de comisión para este asesor y proyecto "
                    "o indícalo manualmente."
                )
            percent_applied = percent

            computed_amount = (base_amount * percent_applied / Decimal("100")).quantize(
                Decimal("0.01")
            )
            # Usar monto explícito si se provee; si no, usar el calculado
            final_amount = data.get("amount") or computed_amount

        else:  # mensualidad
            final_amount = data.get("amount")
            if not final_amount and advisor.base_salary:
                final_amount = advisor.base_salary
            if not final_amount:
                raise ValueError(
                    "Indica el monto de la mensualidad o configura el sueldo base del asesor."
                )

        if not concept:
            if payment_type == "comision":
                concept = f"Comisión - {project_name or 'Sin proyecto'}"
            else:
                period = data.get("payment_period", "")
                concept = f"Mensualidad {period}" if period else "Mensualidad"

        payment = CommissionPayment(
            payment_type=payment_type,
            advisor_id=advisor.id,
            project_id=project_id,
            contract_id=contract_id,
            contract_number=contract_number,
            project_name=project_name,
            percent_applied=percent_applied,
            base_amount=base_amount,
            amount=final_amount,
            concept=concept,
            payment_period=data.get("payment_period"),
            advisor_name=advisor_name,
            document_type=document_type,
            document_number=document_number,
            bank_name=bank_name,
            account_number=account_number,
            payment_status="pendiente",
            origin="manual",
            amount_paid=Decimal("0.00"),
            notes=data.get("notes"),
            created_by=user_id,
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def auto_generate_for_contract(
        db: Session,
        contract: Contract,
        user_id: int | None = None,
    ) -> CommissionPayment | None:
        """Genera automáticamente la comisión del asesor al registrar una venta.

        Se basa en la configuración de comisión activa del asesor para el
        proyecto del contrato. Si el asesor no tiene una configuración activa
        (o no está vigente), retorna None sin generar el registro.
        """
        if not contract.advisor_id:
            return None

        advisor = db.get(Advisor, contract.advisor_id)
        if not advisor or advisor.deleted_at is not None:
            return None

        config = (
            db.query(AdvisorCommission)
            .filter(
                AdvisorCommission.advisor_id == advisor.id,
                AdvisorCommission.project_id == contract.project_id,
                AdvisorCommission.is_active == True,  # noqa: E712
                AdvisorCommission.deleted_at.is_(None),
            )
            .first()
        )
        if not config:
            return None

        project_name = None
        if contract.project_id:
            from app.domain.models import Project as ProjectModel

            proj = db.get(ProjectModel, contract.project_id)
            project_name = proj.name if proj else None

        base_amount = contract.total_price
        amount = (base_amount * config.commission_percent / Decimal("100")).quantize(
            Decimal("0.01")
        )

        payment = CommissionPayment(
            payment_type="comision",
            advisor_id=advisor.id,
            project_id=contract.project_id,
            contract_id=contract.id,
            contract_number=contract.contract_number,
            project_name=project_name,
            percent_applied=config.commission_percent,
            base_amount=base_amount,
            amount=amount,
            concept=f"Comisión - {project_name or 'Sin proyecto'}",
            payment_period=contract.contract_date.strftime("%Y-%m"),
            advisor_name=advisor.name,
            document_type=advisor.document_type or "DNI",
            document_number=advisor.document_number or "",
            bank_name=advisor.bank_name or "",
            account_number=advisor.account_number or "",
            payment_status="pendiente",
            origin="auto",
            amount_paid=Decimal("0.00"),
            notes="Comisión generada automáticamente al registrar la venta.",
            created_by=user_id,
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def update_payment(
        db: Session,
        payment_id: int,
        data: dict[str, Any],
        user_id: int | None = None,
    ) -> CommissionPayment:
        payment = db.get(CommissionPayment, payment_id)
        if not payment or payment.deleted_at is not None:
            raise ValueError("Registro de comisión no encontrado.")
        if payment.payment_status not in ("pendiente", "parcial"):
            raise ValueError(
                "Solo se puede editar un registro de comisión en estado pendiente o parcial."
            )

        # Si cambian advisor o project, actualizar snapshot
        advisor_id = data.get("advisor_id")
        project_id = data.get("project_id") or payment.project_id
        if advisor_id and advisor_id != payment.advisor_id:
            advisor = db.get(Advisor, advisor_id)
            if not advisor or advisor.deleted_at is not None:
                raise ValueError("Asesor no encontrado.")
            payment.advisor_id = advisor.id
            payment.advisor_name = advisor.name
            payment.document_type = advisor.document_type or "DNI"
            payment.document_number = advisor.document_number or ""
            payment.bank_name = advisor.bank_name or ""
            payment.account_number = advisor.account_number or ""
        if project_id != payment.project_id:
            from app.domain.models import Project as ProjectModel

            proj = db.get(ProjectModel, project_id)
            payment.project_id = project_id
            payment.project_name = proj.name if proj else None

        # Actualizar campos editables
        for key in ("base_amount", "percent_applied", "concept", "payment_period", "notes"):
            if key in data and data[key] is not None:
                setattr(payment, key, data[key])

        # Recalcular monto si se cambiaron base/percent y tipo es comision
        if payment.payment_type == "comision":
            if "amount" in data and data["amount"] is not None:
                payment.amount = data["amount"]
            elif payment.base_amount and payment.percent_applied:
                payment.amount = (
                    payment.base_amount * payment.percent_applied / Decimal("100")
                ).quantize(Decimal("0.01"))
        else:
            if "amount" in data and data["amount"] is not None:
                payment.amount = data["amount"]

        if payment.amount <= 0:
            raise ValueError("El monto a pagar debe ser mayor a cero.")
        if payment.amount < payment.amount_paid:
            raise ValueError(
                "El monto no puede ser menor al monto ya pagado "
                f"(S/ {payment.amount_paid})."
            )

        payment.updated_by = user_id
        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def pay(
        db: Session,
        payment_id: int,
        data: dict[str, Any],
        user_id: int | None = None,
    ) -> CommissionPayment:
        payment = db.get(CommissionPayment, payment_id)
        if not payment or payment.deleted_at is not None:
            raise ValueError("Registro de comisión no encontrado.")
        if payment.payment_status == "pagado":
            raise ValueError("Este registro ya fue marcado como pagado.")
        if payment.payment_status == "anulado":
            raise ValueError("No se puede registrar el pago de un registro anulado.")

        # Monto a pagar en esta operación (parcial o el saldo completo)
        paid_so_far = payment.amount_paid or Decimal("0.00")
        remaining = Decimal(payment.amount) - paid_so_far
        pay_amount = Decimal(str(data.get("amount"))) if data.get("amount") else remaining
        pay_amount = pay_amount.quantize(Decimal("0.01"))
        if pay_amount <= 0:
            raise ValueError("El monto a pagar debe ser mayor a cero.")
        if pay_amount > remaining:
            raise ValueError(
                f"El monto a pagar (S/ {pay_amount}) supera el saldo pendiente "
                f"(S/ {remaining})."
            )

        new_paid = (paid_so_far + pay_amount).quantize(Decimal("0.01"))
        payment.amount_paid = new_paid
        payment.payment_status = "pagado" if new_paid >= Decimal(payment.amount) else "parcial"
        payment.payment_date = data.get("payment_date") or date.today().isoformat()
        payment.payment_method = data.get("payment_method") or "transferencia"
        if data.get("transaction_number"):
            payment.transaction_number = data["transaction_number"]
        if data.get("notes"):
            existing = payment.notes or ""
            payment.notes = f"{existing}\nPago de S/ {pay_amount}: {data['notes']}".strip()
        payment.updated_by = user_id
        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def cancel(
        db: Session,
        payment_id: int,
        cancellation_reason: str,
        user_id: int | None = None,
    ) -> CommissionPayment:
        payment = db.get(CommissionPayment, payment_id)
        if not payment or payment.deleted_at is not None:
            raise ValueError("Registro de comisión no encontrado.")
        if payment.payment_status == "anulado":
            raise ValueError("Este registro ya está anulado.")
        payment.payment_status = "anulado"
        payment.cancelled_at = datetime.utcnow()
        payment.cancellation_reason = cancellation_reason
        payment.cancelled_by = user_id
        payment.updated_by = user_id
        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def reactivate(
        db: Session,
        payment_id: int,
        user_id: int | None = None,
    ) -> CommissionPayment:
        payment = db.get(CommissionPayment, payment_id)
        if not payment or payment.deleted_at is not None:
            raise ValueError("Registro de comisión no encontrado.")
        if payment.payment_status != "anulado":
            raise ValueError("Solo se pueden reactivar registros anulados.")
        payment.payment_status = "pendiente"
        payment.amount_paid = Decimal("0.00")
        payment.cancelled_at = None
        payment.cancellation_reason = None
        payment.cancelled_by = None
        payment.updated_by = user_id
        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def soft_delete_payment(db: Session, payment_id: int) -> None:
        payment = db.get(CommissionPayment, payment_id)
        if not payment or payment.deleted_at is not None:
            raise ValueError("Registro de comisión no encontrado.")
        if payment.payment_status != "pendiente":
            raise ValueError(
                "Solo se pueden eliminar registros en estado pendiente. "
                "Si es necesario, anula el registro primero."
            )
        payment.deleted_at = datetime.utcnow()
        db.commit()

    @staticmethod
    def serialize_payment(row: CommissionPayment, db: Session | None = None) -> dict[str, Any]:
        """Serializa un CommissionPayment a diccionario para la API."""
        advisor_is_external = False
        if row.advisor_id and db is not None:
            from app.domain.models import Advisor as AdvisorModel

            advisor = db.get(AdvisorModel, row.advisor_id)
            if advisor:
                advisor_is_external = advisor.is_external

        return {
            "id": row.id,
            "payment_type": row.payment_type,
            "advisor_id": row.advisor_id,
            "project_id": row.project_id,
            "contract_id": row.contract_id,
            "contract_number": row.contract_number,
            "project_name": row.project_name,
            "percent_applied": float(row.percent_applied) if row.percent_applied is not None else None,
            "base_amount": float(row.base_amount) if row.base_amount is not None else None,
            "amount": float(row.amount),
            "amount_paid": float(row.amount_paid or 0),
            "balance": float((Decimal(row.amount) - Decimal(row.amount_paid or 0)).quantize(Decimal("0.01"))),
            "origin": row.origin,
            "concept": row.concept,
            "payment_period": row.payment_period,
            "advisor_name": row.advisor_name,
            "advisor_is_external": advisor_is_external,
            "document_type": row.document_type,
            "document_number": row.document_number,
            "bank_name": row.bank_name,
            "account_number": row.account_number,
            "payment_status": row.payment_status,
            "payment_date": row.payment_date.isoformat() if row.payment_date else None,
            "payment_method": row.payment_method,
            "transaction_number": row.transaction_number,
            "notes": row.notes,
            "cancelled_at": row.cancelled_at.isoformat() if row.cancelled_at else None,
            "cancellation_reason": row.cancellation_reason,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }

    @staticmethod
    def serialize_config(row: AdvisorCommission) -> dict[str, Any]:
        """Serializa un AdvisorCommission a diccionario para la API."""
        return {
            "id": row.id,
            "advisor_id": row.advisor_id,
            "project_id": row.project_id,
            "advisor_name": row.advisor.name if row.advisor else "—",
            "project_name": row.project.name if row.project else "—",
            "commission_percent": float(row.commission_percent),
            "is_active": row.is_active,
            "deleted_at": row.deleted_at.isoformat() if row.deleted_at else None,
        }
