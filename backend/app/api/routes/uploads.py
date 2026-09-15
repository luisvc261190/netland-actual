import os
import shutil
import tempfile
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.dependencies import require_admin
from app.infrastructure.cloudinary_service import upload_file

router = APIRouter(prefix="/uploads", tags=["uploads"], dependencies=[Depends(require_admin)])

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_TYPES = {
    "image": {"jpg", "jpeg", "png", "webp", "gif", "svg"},
    "video": {"mp4", "webm", "mov", "avi"},
    "pdf": {"pdf"},
    "document": {"pdf", "doc", "docx", "xls", "xlsx"},
}


def get_resource_type_from_extension(extension: str) -> str:
    """Determina el resource_type de Cloudinary basado en la extensión."""
    if extension in ALLOWED_TYPES["image"]:
        return "image"
    elif extension in ALLOWED_TYPES["video"]:
        return "video"
    else:
        return "raw"


_MAGIC_PREFIXES: dict[str, list[bytes]] = {
    "pdf": [b"%PDF-"],
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "gif": [b"GIF87a", b"GIF89a"],
    "webp": [b"RIFF"],
    "svg": [b"<", b"<?xml"],
    "mp4": [b"ftyp"],
    "mov": [b"ftypqt", b"ftyp"],
    "webm": [b"\x1a\x45\xdf\xa3"],
    "avi": [b"RIFF"],
    "doc": [b"\xd0\xcf\x11\xe0"],
    "docx": [b"PK\x03\x04"],
    "xls": [b"\xd0\xcf\x11\xe0"],
    "xlsx": [b"PK\x03\x04"],
}


def _matches_magic(file_path: str, extension: str) -> bool:
    """Verifica que los primeros bytes del archivo coincidan con su extensión."""
    prefixes = _MAGIC_PREFIXES.get(extension)
    if not prefixes:
        return True

    with open(file_path, "rb") as fh:
        head = fh.read(16)
    if not head:
        return False

    if extension == "webp":
        return head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    if extension in ("mp4", "mov"):
        return head[4:8] == b"ftyp"
    if extension == "avi":
        return head[:4] == b"RIFF" and head[8:12] == b"AVI "
    if extension == "svg":
        text = head.lstrip().lower()
        return text.startswith(b"<svg") or text.startswith(b"<?xml")
    return any(head.startswith(prefix) for prefix in prefixes)


@router.post("")
async def upload(
    file: UploadFile = File(...),
    folder: str = Form(default="media"),
    resource_type: str = Form(default="auto"),
):
    """
    Endpoint para subir archivos (imágenes, videos, PDFs, documentos).
    Sube el archivo a Cloudinary y devuelve la URL pública.
    
    NOTA: Si es un PDF y folder="plans", se convierte automáticamente a imagen.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="El archivo debe tener un nombre.")

    extension = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    
    # Validar extensión
    all_allowed = ALLOWED_TYPES["image"] | ALLOWED_TYPES["video"] | ALLOWED_TYPES["pdf"] | ALLOWED_TYPES["document"]
    if extension not in all_allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido. Extensiones permitidas: {', '.join(sorted(all_allowed))}"
        )

    # Determinar resource_type automáticamente si es "auto"
    if resource_type == "auto":
        # Si es un PDF en la carpeta "plans", convertirlo a imagen automáticamente
        if extension == "pdf" and folder == "plans":
            resource_type = "image"
        else:
            resource_type = get_resource_type_from_extension(extension)

    # Guardar archivo temporalmente
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{extension}") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
        file_size = tmp.tell()

    if file_size > MAX_UPLOAD_SIZE:
        os.unlink(tmp_path)
        raise HTTPException(status_code=413, detail="El archivo supera el límite de 10 MB.")

    if not _matches_magic(tmp_path, extension):
        os.unlink(tmp_path)
        raise HTTPException(
            status_code=400,
            detail="El contenido del archivo no coincide con su extensión.",
        )

    try:
        result = upload_file(tmp_path, folder=folder, resource_type=resource_type)
        
        # Si es un PDF convertido a imagen, agregar transformaciones para mejor calidad
        if extension == "pdf" and resource_type == "image":
            # Cloudinary convierte PDFs a PNG por defecto
            # Agregar transformaciones para alta calidad
            base_url = result["url"]
            # Agregar transformación de calidad: q_auto:best,f_auto,dpr_2.0
            if "/upload/" in base_url:
                url_parts = base_url.split("/upload/")
                result["url"] = f"{url_parts[0]}/upload/q_auto:best,f_auto,dpr_2.0/{url_parts[1]}"
                
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    finally:
        os.unlink(tmp_path)

    return {
        "url": result["url"],
        "public_id": result["public_id"],
        "filename": file.filename,
        "resource_type": resource_type,
    }


@router.post("/multiple")
async def upload_multiple(
    files: list[UploadFile] = File(...),
    folder: str = Form(default="media"),
):
    """
    Endpoint para subir múltiples archivos a la vez.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No se recibieron archivos.")

    results = []
    errors = []

    for file in files:
        try:
            if not file.filename:
                errors.append({"filename": "unknown", "error": "El archivo no tiene nombre"})
                continue

            extension = file.filename.split(".")[-1].lower() if "." in file.filename else ""
            all_allowed = ALLOWED_TYPES["image"] | ALLOWED_TYPES["video"] | ALLOWED_TYPES["pdf"] | ALLOWED_TYPES["document"]
            
            if extension not in all_allowed:
                errors.append({
                    "filename": file.filename,
                    "error": f"Tipo de archivo no permitido: .{extension}"
                })
                continue

            resource_type = get_resource_type_from_extension(extension)

            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{extension}") as tmp:
                shutil.copyfileobj(file.file, tmp)
                tmp_path = tmp.name
                file_size = tmp.tell()

            if file_size > MAX_UPLOAD_SIZE:
                os.unlink(tmp_path)
                errors.append({
                    "filename": file.filename,
                    "error": "El archivo supera el límite de 10 MB"
                })
                continue

            if not _matches_magic(tmp_path, extension):
                os.unlink(tmp_path)
                errors.append({
                    "filename": file.filename,
                    "error": "El contenido del archivo no coincide con su extensión"
                })
                continue

            try:
                result = upload_file(tmp_path, folder=folder, resource_type=resource_type)
                results.append({
                    "url": result["url"],
                    "public_id": result["public_id"],
                    "filename": file.filename,
                    "resource_type": resource_type,
                })
            finally:
                os.unlink(tmp_path)

        except Exception as e:
            errors.append({"filename": file.filename, "error": str(e)})

    return {
        "success": results,
        "errors": errors,
        "total": len(files),
        "uploaded": len(results),
        "failed": len(errors),
    }