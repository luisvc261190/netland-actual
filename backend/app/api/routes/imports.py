"""
Importación y exportación masiva de propietarios y pagos desde Excel.
Flujo en dos pasos: preview (subir y validar) -> confirm (aplicar).
"""
import logging
import re
import tempfile
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from openpyxl import Workbook
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.domain.models import Block, Client, Lot, Project, User
from app.domain.owners_models import (
    Contract,
    FinancingPlan,
    ImportBatch,
    ImportError,
    Installment,
    Owner,
    Payment,
)
from app.infrastructure.owners_service import (
    ContractsService,
    FinancingService,
    PaymentsService,
)

router = APIRouter(tags=["imports"])
logger = logging.getLogger("netland.imports")

IMPORT_DIR = Path(tempfile.gettempdir()) / "netland_imports"


# ============================================================================
# SCHEMAS LOCALES
# ============================================================================

class ImportPreviewResponse(BaseModel):
    batch_id: int
    file_name: str
    total_rows: int
    valid_rows: int
    import_type: str
    columns: List[str]
    mapping: Dict[str, str]
    preview_rows: List[Dict[str, Any]]
    errors: List[Dict[str, Any]]


class ImportConfirmRequest(BaseModel):
    batch_id: int
    mapping: Optional[Dict[str, str]] = None


class ImportResult(BaseModel):
    batch_id: int
    import_type: str
    imported: int
    skipped: int
    failed: int
    errors: List[str]
    warnings: List[str]


# ============================================================================
# HELPERS
# ============================================================================

def _normalize(text: Any) -> str:
    """Normaliza texto de encabezados: mayúsculas, sin acentos, espacios simples."""
    if text is None:
        return ""
    text = str(text)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = text.upper()
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _clean_value(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.date().isoformat()
    text = str(value).strip()
    if text.lower() == "nan":
        return None
    return text


def _to_decimal(value: Any) -> Optional[Decimal]:
    if value is None:
        return None
    text = str(value).replace(",", "").replace("S/", "").replace("$", "").strip()
    try:
        return Decimal(text)
    except (InvalidOperation, ValueError):
        return None


# Mapeo de campos destino -> posibles encabezados (normalizados)
FIELDS_ALIASES: Dict[str, List[str]] = {
    "document_number": [
        "DOCUMENTO", "NUMERO DOCUMENTO", "NRO DOCUMENTO", "N° DOCUMENTO",
        "NRO DOC", "N° DOC", "N DOC", "DOC", "DNI", "RUC", "CARNET",
        "NUM DOCUMENTO", "NO DOCUMENTO", "NU DOCUMENTO", "CEDULA", "DNI/RUC",
    ],
    "document_type": ["TIPO DOCUMENTO", "TIPO DOC", "TIPO DOCUM", "TIPO", "DOC TIPO"],
    "first_name": ["NOMBRES", "NOMBRE(S)", "NOMBRE", "PRIMER NOMBRE", "NOMBRES COMPLETOS"],
    "paternal_surname": [
        "APELLIDO PATERNO", "APELL PATERNO", "APELLIDO1", "APELLIDO 1",
        "PRIMER APELLIDO", "APELLIDO PAT",
    ],
    "maternal_surname": [
        "APELLIDO MATERNO", "APELL MATERNO", "APELLIDO2", "APELLIDO 2",
        "SEGUNDO APELLIDO", "APELLIDO MAT",
    ],
    "business_name": ["RAZON SOCIAL", "RAZON SOCIAL", "EMPRESA", "NOMBRE COMERCIAL", "RAZON"],
    "phone": [
        "TELEFONO", "CELULAR", "MOVIL", "TEL", "CONTACTO", "TELEFONO/CELULAR",
        "TELEFONO CONTACTO", "TELF",
    ],
    "email": ["CORREO", "EMAIL", "E-MAIL", "MAIL", "CORREO ELECTRONICO", "CORREO ELECTRONICO (RUC)"],
    "address": ["DIRECCION", "DIRE", "DIR"],
    "district": ["DISTRITO"],
    "province": ["PROVINCIA"],
    "department": ["DEPARTAMENTO", "DEPARTAMENTO/REGION", "REGION"],
    "birth_date": ["FECHA NACIMIENTO", "FECHA DE NACIMIENTO", "NACIMIENTO", "F. NACIMIENTO"],
}

# Campos para importación de pagos
PAYMENT_FIELDS: Dict[str, List[str]] = {
    "document_number": ["DOCUMENTO", "NUMERO DOCUMENTO", "NRO DOCUMENTO", "N° DOCUMENTO", "DNI", "RUC", "DOC"],
    "contract_number": ["CONTRATO", "NRO CONTRATO", "N° CONTRATO", "NUMERO CONTRATO", "N DE CONTRATO", "COD CONTRATO"],
    "amount": ["MONTO", "IMPORTE", "MONTO PAGADO", "MONTO (S/)"],
    "payment_date": ["FECHA PAGO", "FECHA DE PAGO", "FECHA"],
    "payment_method": ["METODO", "MEDIO DE PAGO", "METODO PAGO", "FORMA PAGO", "FORMA DE PAGO"],
    "due_date": ["VENCIMIENTO", "FECHA VENCIMIENTO", "VENCIMIENTO CUOTA"],
    "transaction_number": ["TRANSACCION", "NRO TRANSACCION", "N° TRANSACCION", "OPERACION"],
    "bank_name": ["BANCO", "ENTIDAD"],
}


def _build_mapping(columns: List[str], field_aliases: Dict[str, List[str]]) -> Dict[str, str]:
    """Detecta automáticamente el mapeo columna -> campo."""
    mapping: Dict[str, str] = {}
    used_targets: set = set()

    normalized = {col: _normalize(col) for col in columns}

    # Primero las coincidencias exactas
    for col, norm in normalized.items():
        if not norm:
            continue
        for field, aliases in field_aliases.items():
            if field in used_targets:
                continue
            if norm in [a.upper() for a in aliases] or norm == field.replace("_", " "):
                mapping[col] = field
                used_targets.add(field)
                break

    # Después comparaciones por subcadena y singularidad de apellidos
    for col, norm in normalized.items():
        if not norm or col in mapping:
            continue
        best_field = None
        for field, aliases in field_aliases.items():
            if field in used_targets:
                continue
            if any(alias in norm for alias in aliases if len(alias) >= 4):
                best_field = field
                break
        if best_field:
            mapping[col] = best_field
            used_targets.add(best_field)

    return mapping


def _parse_excel(path: Path, filename: str) -> pd.DataFrame:
    if filename.lower().endswith(".csv"):
        return pd.read_csv(path)
    workbook = pd.read_excel(path, header=None)
    header_row = None
    for idx in range(min(15, len(workbook))):
        non_empty = workbook.iloc[idx].notna().sum()
        if non_empty >= 2:
            joined = " ".join(str(v) for v in workbook.iloc[idx].dropna().values).upper()
            if any(k in joined for k in ("DOCUMENTO", "NOMBRE", "RAZON", "DNI", "CONTRATO", "MONTO")):
                header_row = idx
                break
    if header_row is not None:
        df = pd.read_excel(path, header=header_row)
    else:
        df = workbook  # sin encabezados detectables
        df.columns = [f"COLUMNA_{i+1}" for i in range(len(df.columns))]
    df.columns = [str(c).strip() for c in df.columns]
    return df


def _save_upload(file: UploadFile) -> Path:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="El archivo debe ser .xlsx, .xls o .csv")
    IMPORT_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename).suffix.lower()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=IMPORT_DIR)
    content = file.file.read()
    tmp.write(content)
    tmp.close()
    return Path(tmp.name)


def _build_workbook(headers: List[str], rows: List[List[Any]], title: str) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = title
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    sheet.freeze_panes = "A2"
    for index, header in enumerate(headers, start=1):
        column_letter = chr(64 + index) if index <= 26 else chr(64 + index // 26) + chr(64 + index % 26)
        sheet.column_dimensions[column_letter].width = max(18, len(header) + 4)
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _xlsx_response(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


def owner_display_name(owner: Owner) -> str:
    if owner.person_type == "juridica":
        return owner.business_name or ""
    parts = [p for p in (owner.first_name, owner.paternal_surname, owner.maternal_surname) if p]
    return " ".join(parts)


# ============================================================================
# IMPORTACIÓN DE PROPIETARIOS
# ============================================================================

def _validate_owner_row(data: Dict[str, Any], row_index: int) -> Optional[str]:
    doc_type = (data.get("document_type") or "").upper().replace(" ", "")
    if doc_type not in ("DNI", "RUC", "CE", "PASAPORTE", "OTRO"):
        doc_type = "RUC" if str(data.get("document_number") or "").isdigit() and len(str(data.get("document_number"))) >= 11 else "DNI"

    if not data.get("document_number"):
        return f"Fila {row_index}: Falta el documento"
    person_type = "juridica" if doc_type == "RUC" or data.get("business_name") else "natural"
    if person_type == "natural" and not data.get("first_name"):
        return f"Fila {row_index}: Falta el nombre"
    if person_type == "juridica" and not data.get("business_name"):
        return f"Fila {row_index}: Falta la razón social"
    return None


@router.post("/owners/import/preview", response_model=ImportPreviewResponse, dependencies=[Depends(require_admin)])
def preview_owners_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sube el Excel, detecta columnas y valida filas sin guardar nada definitivo."""
    import pandas as pd

    tmp_path = _save_upload(file)
    batch = ImportBatch(
        import_type="owners",
        file_name=file.filename,
        total_rows=0,
        status="pending",
        imported_by=current_user.id,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    stored_path = IMPORT_DIR / f"batch_{batch.id}{tmp_path.suffix}"
    tmp_path.rename(stored_path)

    try:
        df = _parse_excel(stored_path, file.filename)
        if len(df.columns) == 0:
            raise HTTPException(status_code=400, detail="El archivo Excel está vacío o no tiene columnas")
        df = df.dropna(how="all")

        columns = [str(c) for c in df.columns]
        mapping = _build_mapping(columns, FIELDS_ALIASES)

        records: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []
        for idx, row in df.iterrows():
            record: Dict[str, Any] = {}
            for col, field in mapping.items():
                record[field] = _clean_value(row.get(col))
            record["_row"] = idx + 2
            msg = _validate_owner_row(record, idx + 2)
            if msg:
                errors.append({"row": idx + 2, "message": msg})
            records.append(record)

        batch.total_rows = len(records)
        batch.failed_rows = len(errors)
        db.commit()

        preview_rows = [
            {k: v for k, v in rec.items() if k != "_row"}
            for rec in records[:15]
        ]

        return ImportPreviewResponse(
            batch_id=batch.id,
            file_name=file.filename,
            total_rows=len(records),
            valid_rows=len(records) - len(errors),
            import_type="owners",
            columns=columns,
            mapping=mapping,
            preview_rows=preview_rows,
            errors=errors[:50],
        )
    except HTTPException:
        raise
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="El archivo Excel está vacío")
    except Exception as exc:
        logger.exception("Error en preview importación propietarios")
        raise HTTPException(status_code=500, detail=f"Error al procesar el archivo: {exc}")


@router.post("/owners/import/confirm", response_model=ImportResult, dependencies=[Depends(require_admin)])
def confirm_owners_import(
    payload: ImportConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirma la importación de propietarios previsualizada."""
    batch = db.query(ImportBatch).filter(ImportBatch.id == payload.batch_id).first()
    if not batch or batch.import_type != "owners":
        raise HTTPException(status_code=404, detail="Lote de importación no encontrado")

    files = list(IMPORT_DIR.glob(f"batch_{batch.id}.*"))
    if not files:
        raise HTTPException(status_code=400, detail="El archivo del lote ya no está disponible. Vuelve a subirlo.")

    stored_path = files[0]
    batch.status = "processing"
    db.commit()

    try:
        df = _parse_excel(stored_path, batch.file_name)
        df = df.dropna(how="all")
        columns = [str(c) for c in df.columns]
        mapping = payload.mapping or _build_mapping(columns, FIELDS_ALIASES)

        imported = 0
        skipped = 0
        failed = 0
        errors: List[str] = []
        warnings: List[str] = []

        for idx, row in df.iterrows():
            row_no = idx + 2
            record: Dict[str, Any] = {}
            for col, field in mapping.items():
                if field.startswith("_"):
                    continue
                record[field] = _clean_value(row.get(col))

            doc_type = (record.get("document_type") or "").upper().replace(" ", "")
            if doc_type not in ("DNI", "RUC", "CE", "PASAPORTE", "OTRO"):
                doc_number = str(record.get("document_number") or "")
                doc_type = "RUC" if doc_number.isdigit() and len(doc_number) == 11 else "DNI"

            record["document_type"] = doc_type
            person_type = "juridica" if doc_type == "RUC" or record.get("business_name") else "natural"
            record["person_type"] = person_type

            msg = _validate_owner_row(record, row_no)
            if msg:
                failed += 1
                errors.append(msg)
                _store_error(db, batch.id, row_no, "documento", msg)
                continue

            # Normalizar nombres (apellidos en filas separadas o combinadas)
            if person_type == "natural" and not record.get("first_name"):
                record["first_name"] = record.get("first_name") or ""
            if record.get("first_name") and isinstance(record.get("first_name"), str) and not (record.get("paternal_surname") or record.get("maternal_surname")):
                parts = [p for p in re.split(r"\s+", record["first_name"].strip()) if p]
                if len(parts) > 1:
                    record["maternal_surname"] = parts[-1] if len(parts) > 2 else None
                    if len(parts) > 2:
                        record["paternal_surname"] = parts[-2]
                        record["first_name"] = " ".join(parts[:-2])
                    else:
                        record["first_name"] = parts[0]

            existing = OwnersServiceLookup.get_by_document(db, doc_type, record["document_number"])
            if existing:
                skipped += 1
                warnings.append(f"Fila {row_no}: Ya existe el propietario con {doc_type} {record['document_number']}")
                continue

            client_name = (
                " ".join(p for p in (record.get("first_name"), record.get("paternal_surname"), record.get("maternal_surname")) if p)
                if person_type == "natural"
                else record.get("business_name") or ""
            )
            client = Client(
                name=client_name,
                phone=record.get("phone") or "",
                email=record.get("email") or "",
            )
            db.add(client)
            db.flush()

            owner = Owner(
                client_id=client.id,
                person_type=person_type,
                document_type=doc_type,
                document_number=record["document_number"],
                first_name=record.get("first_name"),
                paternal_surname=record.get("paternal_surname"),
                maternal_surname=record.get("maternal_surname"),
                business_name=record.get("business_name") if person_type == "juridica" else None,
                secondary_phone=None,
                address=record.get("address"),
                district=record.get("district"),
                province=record.get("province"),
                department=record.get("department"),
                is_active=True,
                notes="Importado desde Excel",
                created_by=current_user.id,
            )
            db.add(owner)
            imported += 1

        batch.successful_rows = imported
        batch.failed_rows = failed + skipped
        batch.status = "completed"
        batch.completed_at = datetime.utcnow()
        db.commit()

        return ImportResult(
            batch_id=batch.id,
            import_type="owners",
            imported=imported,
            skipped=skipped,
            failed=failed,
            errors=errors[:100],
            warnings=warnings[:100],
        )
    except Exception as exc:
        db.rollback()
        batch.status = "failed"
        db.commit()
        logger.exception("Error confirmando importación de propietarios")
        raise HTTPException(status_code=500, detail=f"Error al importar: {exc}")
    finally:
        stored_path.unlink(missing_ok=True)


def _store_error(db: Session, batch_id: int, row_number: int, field: str, message: str):
    db.add(ImportError(
        batch_id=batch_id,
        row_number=row_number,
        field_name=field,
        error_message=message,
    ))


class OwnersServiceLookup:
    @staticmethod
    def get_by_document(db: Session, doc_type: str, doc_number: str) -> Optional[Owner]:
        return db.query(Owner).filter(
            Owner.document_type == doc_type,
            Owner.document_number == doc_number,
        ).first()


@router.get("/owners/import/template", dependencies=[Depends(require_admin)])
def owners_template():
    """Descarga plantilla .xlsx para importar propietarios."""
    headers = [
        "DOCUMENTO", "TIPO DOCUMENTO", "NOMBRES", "APELLIDO PATERNO",
        "APELLIDO MATERNO", "RAZON SOCIAL", "TELEFONO", "CORREO",
        "DIRECCION", "DISTRITO", "PROVINCIA", "DEPARTAMENTO",
    ]
    rows = [
        ["46123456", "DNI", "CARLOS", "QUISPE", "RAMOS", None, "999100200", "carlos@mail.com", "Av. Los Alamos 120", "Chiclayo", "Chiclayo", "Lambayeque"],
        ["20512345671", "RUC", None, None, None, "INVERSIONES ANDINA S.A.C.", "971000300", "ventas@andina.com", "Jr. Lima 45", "Arequipa", "Arequipa", "Arequipa"],
    ]
    return _xlsx_response(_build_workbook(headers, rows, "Propietarios"), "plantilla-propietarios.xlsx")


@router.get("/owners/export", dependencies=[Depends(require_admin)])
def export_owners(db: Session = Depends(get_db)):
    """Exporta todos los propietarios a Excel."""
    owners = db.query(Owner).order_by(Owner.id).all()
    headers = [
        "ID", "TIPO PERSONA", "TIPO DOCUMENTO", "DOCUMENTO", "NOMBRES",
        "APELLIDO PATERNO", "APELLIDO MATERNO", "RAZON SOCIAL", "TELEFONO",
        "EMAIL", "DIRECCION", "DISTRITO", "PROVINCIA", "DEPARTAMENTO", "ACTIVO",
    ]
    rows = []
    for o in owners:
        client = o.client
        rows.append([
            o.id, o.person_type, o.document_type, o.document_number,
            o.first_name or "", o.paternal_surname or "", o.maternal_surname or "",
            o.business_name or "", o.secondary_phone or (client.phone if client else "") or "",
            (client.email if client else "") or "", o.address or "", o.district or "",
            o.province or "", o.department or "", "SI" if o.is_active else "NO",
        ])
    return _xlsx_response(_build_workbook(headers, rows, "Propietarios"), "propietarios.xlsx")


# ============================================================================
# IMPORTACIÓN DE PAGOS
# ============================================================================

@router.post("/payments/import/preview", response_model=ImportPreviewResponse, dependencies=[Depends(require_admin)])
def preview_payments_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Previsualiza importación de pagos históricos desde Excel."""
    import pandas as pd

    tmp_path = _save_upload(file)
    batch = ImportBatch(
        import_type="payments",
        file_name=file.filename,
        total_rows=0,
        status="pending",
        imported_by=current_user.id,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    stored_path = IMPORT_DIR / f"batch_{batch.id}{tmp_path.suffix}"
    tmp_path.rename(stored_path)

    try:
        df = _parse_excel(stored_path, file.filename)
        if len(df.columns) == 0:
            raise HTTPException(status_code=400, detail="El archivo Excel está vacío")
        df = df.dropna(how="all")

        columns = [str(c) for c in df.columns]
        mapping = _build_mapping(columns, PAYMENT_FIELDS)

        errors: List[Dict[str, Any]] = []
        for idx, row in df.iterrows():
            record: Dict[str, Any] = {}
            for col, field in mapping.items():
                record[field] = _clean_value(row.get(col))
            if not record.get("document_number"):
                errors.append({"row": idx + 2, "message": f"Fila {idx + 2}: Falta el documento"})
            if not record.get("contract_number"):
                errors.append({"row": idx + 2, "message": f"Fila {idx + 2}: Falta el número de contrato"})
            if not record.get("amount") or _to_decimal(record.get("amount")) is None or _to_decimal(record.get("amount")) <= 0:
                errors.append({"row": idx + 2, "message": f"Fila {idx + 2}: Monto inválido"})
            if not record.get("payment_date"):
                errors.append({"row": idx + 2, "message": f"Fila {idx + 2}: Falta la fecha de pago"})

        batch.total_rows = len(df)
        batch.failed_rows = len(errors)
        db.commit()

        preview_rows = []
        for _, row in df.head(15).iterrows():
            preview_rows.append({f: _clean_value(row.get(c)) for c, f in mapping.items()})

        return ImportPreviewResponse(
            batch_id=batch.id,
            file_name=file.filename,
            total_rows=len(df),
            valid_rows=len(df) - len(errors),
            import_type="payments",
            columns=columns,
            mapping=mapping,
            preview_rows=preview_rows,
            errors=errors[:50],
        )
    except HTTPException:
        raise
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="El archivo Excel está vacío")
    except Exception as exc:
        logger.exception("Error en preview importación de pagos")
        db.delete(batch)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Error al procesar el archivo: {exc}")


@router.post("/payments/import/confirm", response_model=ImportResult, dependencies=[Depends(require_admin)])
def confirm_payments_import(
    payload: ImportConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirma la importación de pagos históricos."""
    from app.domain.owners_models import FinancingPlan, Installment

    batch = db.query(ImportBatch).filter(ImportBatch.id == payload.batch_id).first()
    if not batch or batch.import_type != "payments":
        raise HTTPException(status_code=404, detail="Lote de importación no encontrado")

    files = list(IMPORT_DIR.glob(f"batch_{batch.id}.*"))
    if not files:
        raise HTTPException(status_code=400, detail="El archivo del lote ya no está disponible. Vuelve a subirlo.")

    stored_path = files[0]
    batch.status = "processing"
    db.commit()

    try:
        df = _parse_excel(stored_path, batch.file_name)
        df = df.dropna(how="all")
        columns = [str(c) for c in df.columns]
        mapping = payload.mapping or _build_mapping(columns, PAYMENT_FIELDS)

        imported = 0
        skipped = 0
        failed = 0
        errors: List[str] = []
        warnings: List[str] = []

        for idx, row in df.iterrows():
            row_no = idx + 2
            record: Dict[str, Any] = {}
            for col, field in mapping.items():
                record[field] = _clean_value(row.get(col))

            doc_type = (record.get("document_type") or "").upper().replace(" ", "")
            doc_number = str(record.get("document_number") or "")
            if doc_type not in ("DNI", "RUC", "CE", "PASAPORTE", "OTRO"):
                doc_type = "RUC" if doc_number.isdigit() and len(doc_number) == 11 else "DNI"

            amount = _to_decimal(record.get("amount"))
            if not doc_number or not record.get("contract_number") or amount is None or amount <= 0:
                failed += 1
                msg = f"Fila {row_no}: Datos incompletos (documento, contrato y monto son obligatorios)"
                errors.append(msg)
                _store_error(db, batch.id, row_no, "datos", msg)
                continue

            try:
                payment_date = date.fromisoformat(str(record["payment_date"][:10]))
            except (ValueError, KeyError, TypeError):
                failed += 1
                msg = f"Fila {row_no}: Fecha de pago inválida: {record.get('payment_date')}"
                errors.append(msg)
                _store_error(db, batch.id, row_no, "payment_date", msg)
                continue

            owner = _OwnersServiceLookup.get_by_document(db, doc_type, doc_number)
            if not owner:
                failed += 1
                msg = f"Fila {row_no}: No existe propietario con {doc_type} {doc_number}"
                errors.append(msg)
                _store_error(db, batch.id, row_no, "owner", msg)
                continue

            contract = db.query(Contract).filter(
                Contract.contract_number == str(record["contract_number"]).strip()
            ).first()
            if not contract:
                failed += 1
                msg = f"Fila {row_no}: No existe el contrato {record['contract_number']}"
                errors.append(msg)
                _store_error(db, batch.id, row_no, "contract", msg)
                continue

            if not (contract.owner_id == owner.id or any(c.owner_id == owner.id for c in [contract])):
                warnings.append(f"Fila {row_no}: El propietario {doc_number} no es titular del contrato {contract.contract_number}")

            allocations = None
            if record.get("due_date"):
                try:
                    due_date = date.fromisoformat(str(record["due_date"][:10]))
                    financing = db.query(FinancingPlan).filter(FinancingPlan.contract_id == contract.id).first()
                    if financing:
                        installment = db.query(Installment).filter(
                            Installment.financing_plan_id == financing.id,
                            Installment.due_date == due_date,
                        ).first()
                        if installment:
                            allocations = [{"installment_id": installment.id, "amount": float(amount)}]
                except (ValueError, TypeError):
                    pass

            payment_method = str(record.get("payment_method") or "transferencia").lower().strip()
            valid_methods = {"efectivo", "transferencia", "deposito", "cheque", "tarjeta", "yape", "plin", "otro"}
            if payment_method not in valid_methods:
                payment_method = "otro"

            try:
                payment = PaymentsService.register_payment(
                    db,
                    {
                        "contract_id": contract.id,
                        "payer_id": owner.id,
                        "payment_date": payment_date,
                        "amount": amount,
                        "payment_method": payment_method,
                        "transaction_number": record.get("transaction_number"),
                        "bank_name": record.get("bank_name"),
                        "notes": "Importado desde Excel",
                    },
                    allocations=allocations,
                    user_id=current_user.id,
                )
                payment.is_imported = True
                payment.import_batch_id = batch.id
                db.commit()
                imported += 1
            except Exception as exc:
                db.rollback()
                failed += 1
                msg = f"Fila {row_no}: {exc}"
                errors.append(msg)
                _store_error(db, batch.id, row_no, "pago", msg)

        batch.successful_rows = imported
        batch.failed_rows = failed + skipped
        batch.status = "completed"
        batch.completed_at = datetime.utcnow()
        db.commit()

        return ImportResult(
            batch_id=batch.id,
            import_type="payments",
            imported=imported,
            skipped=skipped,
            failed=failed,
            errors=errors[:100],
            warnings=warnings[:100],
        )
    except Exception as exc:
        db.rollback()
        batch.status = "failed"
        db.commit()
        logger.exception("Error confirmando importación de pagos")
        raise HTTPException(status_code=500, detail=f"Error al importar: {exc}")
    finally:
        stored_path.unlink(missing_ok=True)


@router.get("/payments/export", dependencies=[Depends(require_admin)])
def export_payments(db: Session = Depends(get_db)):
    """Exporta pagos a Excel."""
    payments = db.query(Payment).order_by(Payment.payment_date.desc()).limit(10000).all()
    headers = [
        "ID", "CONTRATO", "DOCUMENTO", "PROPIETARIO", "FECHA PAGO", "MONTO",
        "METODO", "TRANSACCION", "BANCO", "ESTADO",
    ]
    rows = []
    for p in payments:
        rows.append([
            p.id, p.contract.contract_number if p.contract else "",
            f"{p.payer.document_type} {p.payer.document_number}" if p.payer else "",
            owner_display_name(p.payer) if p.payer else "",
            p.payment_date.isoformat() if p.payment_date else "",
            float(p.amount), p.payment_method, p.transaction_number or "",
            p.bank_name or "", "ANULADO" if p.is_cancelled else "REGISTRADO",
        ])
    return _xlsx_response(_build_workbook(headers, rows, "Pagos"), "pagos.xlsx")


# ============================================================================
# IMPORTACIÓN GENÉRICA (CLIENTES, CONTRATOS/VENTAS, FINANCIAMIENTO, CUOTAS)
# ============================================================================

CLIENT_FIELDS: Dict[str, List[str]] = {
    "name": ["NOMBRES", "NOMBRE", "CLIENTE", "NOMBRE COMPLETO", "RAZON SOCIAL", "EMPRESA"],
    "last_name": ["APELLIDOS", "APELLIDO", "APELLIDO PATERNO"],
    "phone": ["TELEFONO", "CELULAR", "TEL", "CONTACTO", "TELEFONO/CELULAR"],
    "whatsapp": ["WHATSAPP", "WSP", "CELULAR WHATSAPP"],
    "email": ["CORREO", "EMAIL", "E-MAIL", "MAIL", "CORREO ELECTRONICO"],
    "notes": ["NOTAS", "OBSERVACIONES"],
}

CONTRACT_IMPORT_FIELDS: Dict[str, List[str]] = {
    "document_number": ["DOCUMENTO", "DOC", "DNI", "RUC", "NUMERO DOCUMENTO", "NRO DOCUMENTO", "N° DOCUMENTO"],
    "document_type": ["TIPO DOCUMENTO", "TIPO DOC", "TIPO"],
    "contract_number": ["CONTRATO", "NRO CONTRATO", "N° CONTRATO", "NUMERO CONTRATO", "COD CONTRATO"],
    "project": ["PROYECTO", "NOMBRE CORTO", "PROYECTO (NOMBRE CORTO)"],
    "block_code": ["MANZANA", "BLOQUE", "MZ", "MANZANA/BLOQUE"],
    "lot_code": ["LOTE", "CODIGO LOTE", "CODIGO", "N° LOTE", "N LOTE"],
    "contract_date": ["FECHA CONTRATO", "FECHA DE CONTRATO", "FECHA COMPRA", "FECHA VENTA"],
    "start_date": ["FECHA INICIO", "FECHA DE INICIO", "INICIO CONTRATO"],
    "area_m2": ["AREA", "AREA M2", "AREA (M2)", "M2", "SUPERFICIE"],
    "price_per_m2": ["PRECIO M2", "PRECIO POR M2", "VALOR M2", "PRECIO/M2"],
    "total_price": ["PRECIO TOTAL", "TOTAL", "PRECIO", "MONTO TOTAL", "PRECIO VENTA"],
    "modality": ["MODALIDAD", "FORMA PAGO", "MODALIDAD PAGO"],
}

FINANCING_IMPORT_FIELDS: Dict[str, List[str]] = {
    "contract_number": ["CONTRATO", "NRO CONTRATO", "N° CONTRATO", "NUMERO CONTRATO", "COD CONTRATO"],
    "total_price": ["PRECIO TOTAL", "TOTAL", "PRECIO"],
    "initial_payment": ["CUOTA INICIAL", "INICIAL", "ENTRADA", "CUOTA INICIAL (S/)"],
    "financed_amount": ["MONTO FINANCIADO", "FINANCIADO", "FINANCIAMIENTO", "FINANCIADO (S/)"],
    "number_of_installments": ["N CUOTAS", "NUMERO DE CUOTAS", "N° CUOTAS", "CUOTAS", "NRO CUOTAS", "N DE CUOTAS"],
    "installment_amount": ["MONTO CUOTA", "CUOTA", "VALOR CUOTA", "MONTO DE CUOTA"],
    "frequency": ["FRECUENCIA", "PERIODICIDAD"],
    "first_installment_date": ["FECHA INICIO CUOTAS", "PRIMER VENCIMIENTO", "FECHA PRIMERA CUOTA", "INICIO CUOTAS"],
    "last_installment_date": ["FECHA FINAL", "ULTIMO VENCIMIENTO", "FECHA ULTIMA CUOTA", "FIN CUOTAS"],
    "interest_rate": ["TASA INTERES", "INTERES", "TASA", "TASA DE INTERES"],
}

INSTALLMENT_IMPORT_FIELDS: Dict[str, List[str]] = {
    "contract_number": ["CONTRATO", "NRO CONTRATO", "N° CONTRATO", "NUMERO CONTRATO", "COD CONTRATO"],
    "installment_number": ["N CUOTA", "NUMERO CUOTA", "N° CUOTA", "CUOTA N", "NRO CUOTA", "# CUOTA"],
    "due_date": ["VENCIMIENTO", "FECHA VENCIMIENTO", "FECHA", "FECHA VENCIMIENTO CUOTA"],
    "amount": ["MONTO", "MONTO CUOTA", "IMPORTE", "VALOR", "MONTO (S/)"],
}


def _parse_date(value: Any) -> Optional[date]:
    """Convierte texto/fecha a date con varios formatos comunes."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, pd.Timestamp):
        return value.date()
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    return None


def _infer_document_type(doc_number: Any) -> str:
    text = str(doc_number or "").strip()
    if text.isdigit() and len(text) == 11:
        return "RUC"
    return "DNI"


def _run_preview(
    db: Session,
    current_user: User,
    file: UploadFile,
    import_type: str,
    field_aliases: Dict[str, List[str]],
    validator,
) -> ImportPreviewResponse:
    """Flujo genérico de previsualización para los importes nuevos."""
    tmp_path = _save_upload(file)
    batch = ImportBatch(
        import_type=import_type,
        file_name=file.filename,
        total_rows=0,
        status="pending",
        imported_by=current_user.id,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    stored_path = IMPORT_DIR / f"batch_{batch.id}{tmp_path.suffix}"
    tmp_path.rename(stored_path)

    try:
        df = _parse_excel(stored_path, file.filename)
        if len(df.columns) == 0:
            raise HTTPException(status_code=400, detail="El archivo Excel está vacío o no tiene columnas")
        df = df.dropna(how="all")

        columns = [str(c) for c in df.columns]
        mapping = _build_mapping(columns, field_aliases)

        records: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []
        for idx, row in df.iterrows():
            record: Dict[str, Any] = {}
            for col, field in mapping.items():
                record[field] = _clean_value(row.get(col))
            msg = validator(record, idx + 2)
            if msg:
                errors.append({"row": idx + 2, "message": msg})
            records.append(record)

        batch.total_rows = len(records)
        batch.failed_rows = len(errors)
        db.commit()

        preview_rows = [
            {k: v for k, v in rec.items() if k != "_row"}
            for rec in records[:15]
        ]

        return ImportPreviewResponse(
            batch_id=batch.id,
            file_name=file.filename,
            total_rows=len(records),
            valid_rows=len(records) - len(errors),
            import_type=import_type,
            columns=columns,
            mapping=mapping,
            preview_rows=preview_rows,
            errors=errors[:50],
        )
    except HTTPException:
        raise
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="El archivo Excel está vacío")
    except Exception as exc:
        logger.exception("Error en preview importación %s", import_type)
        db.delete(batch)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Error al procesar el archivo: {exc}")


def _run_confirm(
    db: Session,
    current_user: User,
    payload: ImportConfirmRequest,
    import_type: str,
    field_aliases: Dict[str, List[str]],
    validator,
    processor,
) -> ImportResult:
    """Flujo genérico de confirmación para los importes nuevos."""
    batch = db.query(ImportBatch).filter(ImportBatch.id == payload.batch_id).first()
    if not batch or batch.import_type != import_type:
        raise HTTPException(status_code=404, detail="Lote de importación no encontrado")

    files = list(IMPORT_DIR.glob(f"batch_{batch.id}.*"))
    if not files:
        raise HTTPException(status_code=400, detail="El archivo del lote ya no está disponible. Vuelve a subirlo.")

    stored_path = files[0]
    batch.status = "processing"
    db.commit()

    imported = 0
    skipped = 0
    failed = 0
    errors: List[str] = []
    warnings: List[str] = []

    try:
        df = _parse_excel(stored_path, batch.file_name)
        df = df.dropna(how="all")
        columns = [str(c) for c in df.columns]
        mapping = payload.mapping or _build_mapping(columns, field_aliases)

        for idx, row in df.iterrows():
            row_no = idx + 2
            record: Dict[str, Any] = {}
            for col, field in mapping.items():
                if field.startswith("_"):
                    continue
                record[field] = _clean_value(row.get(col))

            msg = validator(record, row_no)
            if msg:
                failed += 1
                errors.append(msg)
                _store_error(db, batch.id, row_no, "datos", msg)
                continue

            try:
                warning = processor(db, record, row_no, current_user.id, batch.id)
                if warning:
                    skipped += 1
                    warnings.append(f"Fila {row_no}: {warning}")
                else:
                    imported += 1
            except Exception as exc:
                db.rollback()
                failed += 1
                msg = f"Fila {row_no}: {exc}"
                errors.append(msg)
                _store_error(db, batch.id, row_no, "proceso", msg)

        batch.successful_rows = imported
        batch.failed_rows = failed + skipped
        batch.status = "completed"
        batch.completed_at = datetime.utcnow()
        db.commit()

        return ImportResult(
            batch_id=batch.id,
            import_type=import_type,
            imported=imported,
            skipped=skipped,
            failed=failed,
            errors=errors[:100],
            warnings=warnings[:100],
        )
    except Exception as exc:
        db.rollback()
        batch.status = "failed"
        db.commit()
        logger.exception("Error confirmando importación %s", import_type)
        raise HTTPException(status_code=500, detail=f"Error al importar: {exc}")
    finally:
        stored_path.unlink(missing_ok=True)


# ============================================================================
# VALIDADORES Y PROCESADORES DE CADA TIPO
# ============================================================================

def _validate_client_row(record: Dict[str, Any], row_index: int) -> Optional[str]:
    if not record.get("name") and not record.get("last_name"):
        return f"Fila {row_index}: Falta el nombre del cliente"
    return None


def _import_client_row(db: Session, record: Dict[str, Any], row_no: int, user_id: int, batch_id: int) -> Optional[str]:
    name = str(record.get("name") or "").strip()
    last_name = str(record.get("last_name") or "").strip()
    if not name:
        name, last_name = last_name, ""
    phone = str(record.get("phone") or "").strip()

    existing = None
    if phone:
        existing = db.query(Client).filter(Client.phone == phone, Client.name == name).first()
    if existing:
        return "Ya existe un cliente con ese nombre y teléfono"

    client = Client(
        name=name,
        last_name=last_name,
        phone=phone,
        whatsapp=str(record.get("whatsapp") or "").strip(),
        email=str(record.get("email") or "").strip(),
        notes=str(record.get("notes") or "").strip() or None,
    )
    db.add(client)
    db.flush()
    return None


def _validate_contract_row(record: Dict[str, Any], row_index: int) -> Optional[str]:
    if not record.get("document_number"):
        return f"Fila {row_index}: Falta el documento del propietario"
    if not record.get("contract_number"):
        return f"Fila {row_index}: Falta el número de contrato"
    if not record.get("project"):
        return f"Fila {row_index}: Falta el proyecto"
    if not record.get("lot_code"):
        return f"Fila {row_index}: Falta el código del lote"
    if _to_decimal(record.get("total_price")) is None or _to_decimal(record.get("total_price")) <= 0:
        return f"Fila {row_index}: Precio total inválido"
    if _to_decimal(record.get("area_m2")) is None or _to_decimal(record.get("area_m2")) <= 0:
        return f"Fila {row_index}: Área inválida"
    return None


def _import_contract_row(db: Session, record: Dict[str, Any], row_no: int, user_id: int, batch_id: int) -> Optional[str]:
    doc_number = str(record.get("document_number") or "")
    doc_type = str(record.get("document_type") or "").upper().replace(" ", "") or _infer_document_type(doc_number)
    if doc_type not in ("DNI", "RUC", "CE", "PASAPORTE", "OTRO"):
        doc_type = _infer_document_type(doc_number)

    owner = OwnersServiceLookup.get_by_document(db, doc_type, doc_number)
    if not owner:
        raise ValueError(f"No existe propietario con {doc_type} {doc_number}")

    project_name = str(record.get("project") or "").strip()
    project = (
        db.query(Project)
        .filter(or_(Project.short_name == project_name, Project.name == project_name))
        .first()
    )
    if not project:
        raise ValueError(f"No existe el proyecto '{project_name}'")

    lot_code = str(record.get("lot_code") or "").strip()
    block_code = str(record.get("block_code") or "").strip()
    lot_query = db.query(Lot).filter(Lot.project_id == project.id, Lot.code == lot_code)
    if block_code:
        lot_query = lot_query.join(Block).filter(Block.code == block_code)
    lot = lot_query.first()
    if not lot:
        raise ValueError(f"No existe el lote '{lot_code}' en el proyecto '{project_name}'")

    contract_date = _parse_date(record.get("contract_date")) or date.today()
    start_date = _parse_date(record.get("start_date")) or contract_date
    modality_raw = str(record.get("modality") or "").lower().strip()
    if "credito" in modality_raw or "financ" in modality_raw:
        modality = "financiado"
    elif "contado" in modality_raw or modality_raw in ("contado", "financiado"):
        modality = "contado"
    else:
        modality = "financiado"

    contract_number = str(record.get("contract_number") or "").strip()
    if db.query(Contract).filter(Contract.contract_number == contract_number).first():
        return f"El contrato {contract_number} ya existe"

    contract = ContractsService.create_contract(
        db,
        {
            "contract_number": contract_number,
            "owner_id": owner.id,
            "project_id": project.id,
            "lot_id": lot.id,
            "contract_date": contract_date,
            "start_date": start_date,
            "lot_area_m2": _to_decimal(record["area_m2"]),
            "price_per_m2": _to_decimal(record.get("price_per_m2")) or Decimal("0.00"),
            "total_price": _to_decimal(record["total_price"]),
            "payment_modality": modality,
            "status": "activo",
            "notes": "Importado desde Excel",
        },
        user_id=user_id,
    )
    contract.is_imported = True
    contract.import_batch_id = batch_id
    db.commit()
    return None


def _validate_financing_row(record: Dict[str, Any], row_index: int) -> Optional[str]:
    if not record.get("contract_number"):
        return f"Fila {row_index}: Falta el número de contrato"
    if _to_decimal(record.get("financed_amount")) is None or _to_decimal(record.get("financed_amount")) <= 0:
        return f"Fila {row_index}: Monto financiado inválido"
    try:
        if int(record.get("number_of_installments") or 0) <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return f"Fila {row_index}: Número de cuotas inválido"
    if _to_decimal(record.get("installment_amount")) is None or _to_decimal(record.get("installment_amount")) <= 0:
        return f"Fila {row_index}: Monto de cuota inválido"
    if not _parse_date(record.get("first_installment_date")):
        return f"Fila {row_index}: Falta la fecha de inicio de cuotas"
    return None


def _import_financing_row(db: Session, record: Dict[str, Any], row_no: int, user_id: int, batch_id: int) -> Optional[str]:
    contract = db.query(Contract).filter(Contract.contract_number == str(record.get("contract_number") or "").strip()).first()
    if not contract:
        raise ValueError(f"No existe el contrato {record.get('contract_number')}")
    if db.query(FinancingPlan).filter(FinancingPlan.contract_id == contract.id).first():
        return f"El contrato {contract.contract_number} ya tiene un plan de financiamiento"

    first_date = _parse_date(record.get("first_installment_date"))
    last_date = _parse_date(record.get("last_installment_date")) or first_date
    frequency = str(record.get("frequency") or "mensual").lower().strip()
    if frequency not in ("mensual", "quincenal", "semanal", "personalizada"):
        frequency = "mensual"

    FinancingService.create_financing_with_schedule(
        db,
        {
            "contract_id": contract.id,
            "total_price": _to_decimal(record.get("total_price")) or Decimal("0.00"),
            "initial_payment": _to_decimal(record.get("initial_payment")) or Decimal("0.00"),
            "financed_amount": _to_decimal(record["financed_amount"]),
            "number_of_installments": int(record["number_of_installments"]),
            "installment_amount": _to_decimal(record["installment_amount"]),
            "frequency": frequency,
            "first_installment_date": first_date,
            "last_installment_date": last_date,
            "interest_rate": _to_decimal(record.get("interest_rate")) or Decimal("0.00"),
            "total_interest": Decimal("0.00"),
        },
        user_id=user_id,
    )
    return None


def _validate_installment_row(record: Dict[str, Any], row_index: int) -> Optional[str]:
    if not record.get("contract_number"):
        return f"Fila {row_index}: Falta el número de contrato"
    try:
        if int(record.get("installment_number") or 0) <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return f"Fila {row_index}: Número de cuota inválido"
    if not _parse_date(record.get("due_date")):
        return f"Fila {row_index}: Falta la fecha de vencimiento"
    if _to_decimal(record.get("amount")) is None or _to_decimal(record.get("amount")) <= 0:
        return f"Fila {row_index}: Monto inválido"
    return None


def _import_installment_row(db: Session, record: Dict[str, Any], row_no: int, user_id: int, batch_id: int) -> Optional[str]:
    contract = db.query(Contract).filter(Contract.contract_number == str(record.get("contract_number") or "").strip()).first()
    if not contract:
        raise ValueError(f"No existe el contrato {record.get('contract_number')}")
    financing = db.query(FinancingPlan).filter(FinancingPlan.contract_id == contract.id).first()
    if not financing:
        raise ValueError(f"El contrato {contract.contract_number} no tiene plan de financiamiento")

    number = int(record["installment_number"])
    if db.query(Installment).filter(Installment.financing_plan_id == financing.id, Installment.installment_number == number).first():
        return f"La cuota {number} del contrato {contract.contract_number} ya existe"

    amount = _to_decimal(record["amount"])
    db.add(Installment(
        financing_plan_id=financing.id,
        installment_number=number,
        due_date=_parse_date(record["due_date"]),
        scheduled_amount=amount,
        paid_amount=Decimal("0.00"),
        balance=amount,
        status="pendiente",
        days_overdue=0,
    ))
    db.flush()
    return None


# ============================================================================
# ENDPOINTS: CLIENTES
# ============================================================================

@router.post("/clients/import/preview", response_model=ImportPreviewResponse, dependencies=[Depends(require_admin)])
def preview_clients_import(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Previsualiza la importación de clientes."""
    return _run_preview(db, current_user, file, "clients", CLIENT_FIELDS, _validate_client_row)


@router.post("/clients/import/confirm", response_model=ImportResult, dependencies=[Depends(require_admin)])
def confirm_clients_import(payload: ImportConfirmRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Confirma la importación de clientes."""
    return _run_confirm(db, current_user, payload, "clients", CLIENT_FIELDS, _validate_client_row, _import_client_row)


@router.get("/clients/import/template", dependencies=[Depends(require_admin)])
def clients_template():
    """Plantilla de clientes."""
    headers = ["NOMBRES", "APELLIDOS", "TELEFONO", "WHATSAPP", "CORREO", "NOTAS"]
    rows = [["CARLOS", "QUISPE RAMOS", "999100200", "999100200", "carlos@mail.com", "Cliente de la feria"]]
    return _xlsx_response(_build_workbook(headers, rows, "Clientes"), "plantilla-clientes.xlsx")


@router.get("/clients/export", dependencies=[Depends(require_admin)])
def export_clients(db: Session = Depends(get_db)):
    """Exporta clientes a Excel."""
    clients = db.query(Client).order_by(Client.id).all()
    headers = ["ID", "NOMBRES", "APELLIDOS", "TELEFONO", "WHATSAPP", "CORREO"]
    rows = [[c.id, c.name, c.last_name or "", c.phone or "", c.whatsapp or "", c.email or ""] for c in clients]
    return _xlsx_response(_build_workbook(headers, rows, "Clientes"), "clientes.xlsx")


# ============================================================================
# ENDPOINTS: CONTRATOS / VENTAS
# ============================================================================

@router.post("/contracts/import/preview", response_model=ImportPreviewResponse, dependencies=[Depends(require_admin)])
def preview_contracts_import(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Previsualiza la importación de contratos (ventas)."""
    return _run_preview(db, current_user, file, "contracts", CONTRACT_IMPORT_FIELDS, _validate_contract_row)


@router.post("/contracts/import/confirm", response_model=ImportResult, dependencies=[Depends(require_admin)])
def confirm_contracts_import(payload: ImportConfirmRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Confirma la importación de contratos (ventas)."""
    return _run_confirm(db, current_user, payload, "contracts", CONTRACT_IMPORT_FIELDS, _validate_contract_row, _import_contract_row)


@router.get("/contracts/import/template", dependencies=[Depends(require_admin)])
def contracts_template():
    """Plantilla de contratos/ventas."""
    headers = [
        "DOCUMENTO", "TIPO DOCUMENTO", "CONTRATO", "PROYECTO", "MANZANA", "LOTE",
        "FECHA CONTRATO", "FECHA INICIO", "AREA M2", "PRECIO M2", "PRECIO TOTAL", "MODALIDAD",
    ]
    rows = [[
        "46123456", "DNI", "CTR-2026-00001", "VILLA DEL SUR", "A", "A-01",
        "2026-01-15", "2026-02-01", 120.0, 350.0, 42000.0, "FINANCIADO",
    ]]
    return _xlsx_response(_build_workbook(headers, rows, "Contratos"), "plantilla-contratos.xlsx")


@router.get("/contracts/export", dependencies=[Depends(require_admin)])
def export_contracts(db: Session = Depends(get_db)):
    """Exporta contratos a Excel."""
    contracts = db.query(Contract).order_by(Contract.contract_date.desc()).all()
    headers = ["ID", "CONTRATO", "FECHA", "PROYECTO", "MANZANA", "LOTE", "PROPIETARIO", "AREA M2", "PRECIO TOTAL", "MODALIDAD", "ESTADO"]
    rows = []
    for contract in contracts:
        owner = contract.owner
        owner_name = f"{owner.first_name} {owner.paternal_surname}".strip() if owner.person_type == "natural" else owner.business_name
        rows.append([
            contract.id, contract.contract_number, contract.contract_date.isoformat(),
            contract.project.short_name if contract.project else "",
            contract.lot.block.code if contract.lot and contract.lot.block else "",
            contract.lot.code if contract.lot else "",
            owner_name or "", float(contract.lot_area_m2), float(contract.total_price),
            contract.payment_modality, contract.status,
        ])
    return _xlsx_response(_build_workbook(headers, rows, "Contratos"), "contratos.xlsx")


# ============================================================================
# ENDPOINTS: FINANCIAMIENTO
# ============================================================================

@router.post("/financings/import/preview", response_model=ImportPreviewResponse, dependencies=[Depends(require_admin)])
def preview_financings_import(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Previsualiza la importación de planes de financiamiento."""
    return _run_preview(db, current_user, file, "financings", FINANCING_IMPORT_FIELDS, _validate_financing_row)


@router.post("/financings/import/confirm", response_model=ImportResult, dependencies=[Depends(require_admin)])
def confirm_financings_import(payload: ImportConfirmRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Confirma la importación de planes de financiamiento."""
    return _run_confirm(db, current_user, payload, "financings", FINANCING_IMPORT_FIELDS, _validate_financing_row, _import_financing_row)


@router.get("/financings/import/template", dependencies=[Depends(require_admin)])
def financings_template():
    """Plantilla de financiamiento."""
    headers = [
        "CONTRATO", "PRECIO TOTAL", "CUOTA INICIAL", "MONTO FINANCIADO", "N CUOTAS",
        "MONTO CUOTA", "FRECUENCIA", "FECHA INICIO CUOTAS", "FECHA FINAL", "TASA INTERES",
    ]
    rows = [[
        "CTR-2026-00001", 42000.0, 4000.0, 38000.0, 24, 1583.33,
        "MENSUAL", "2026-02-01", "2028-01-01", 0.0,
    ]]
    return _xlsx_response(_build_workbook(headers, rows, "Financiamiento"), "plantilla-financiamiento.xlsx")


# ============================================================================
# ENDPOINTS: CUOTAS
# ============================================================================

@router.post("/installments/import/preview", response_model=ImportPreviewResponse, dependencies=[Depends(require_admin)])
def preview_installments_import(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Previsualiza la importación de cuotas."""
    return _run_preview(db, current_user, file, "installments", INSTALLMENT_IMPORT_FIELDS, _validate_installment_row)


@router.post("/installments/import/confirm", response_model=ImportResult, dependencies=[Depends(require_admin)])
def confirm_installments_import(payload: ImportConfirmRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Confirma la importación de cuotas."""
    return _run_confirm(db, current_user, payload, "installments", INSTALLMENT_IMPORT_FIELDS, _validate_installment_row, _import_installment_row)


@router.get("/installments/import/template", dependencies=[Depends(require_admin)])
def installments_template():
    """Plantilla de cuotas."""
    headers = ["CONTRATO", "N CUOTA", "FECHA VENCIMIENTO", "MONTO"]
    rows = [["CTR-2026-00001", 1, "2026-02-01", 1583.33]]
    return _xlsx_response(_build_workbook(headers, rows, "Cuotas"), "plantilla-cuotas.xlsx")