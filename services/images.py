"""Image upload and processing helpers."""

from __future__ import annotations

import hashlib
import os
import uuid
from io import BytesIO
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from PIL import Image as PILImage, ImageOps


UPLOADS_DIR = os.path.abspath(os.getenv("UPLOADS_DIR", "uploads"))
os.makedirs(UPLOADS_DIR, exist_ok=True)


async def save_uploaded_image(file: UploadFile) -> str:
    """Save uploaded image and return relative public URL."""
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    if ext.lower() not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        ext = ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOADS_DIR, name)
    content = await file.read()
    with open(path, "wb") as file_handle:
        file_handle.write(content)
    return f"/uploads/{name}"


def get_resized_uploaded_image(
    request: Request,
    src: str,
    w: int = 0,
    h: int = 0,
    q: int = 80,
    format: str = "jpg",
):
    """Serve a resized/cached version of an uploaded image."""
    fmt = (format or "jpg").lower().strip(".")
    if fmt == "jpeg":
        fmt = "jpg"
    if fmt not in {"jpg", "png", "webp"}:
        raise HTTPException(status_code=400, detail="Unsupported format")

    try:
        quality = int(q)
    except Exception:
        quality = 80
    quality = max(30, min(95, quality))

    try:
        max_w = int(w)
        max_h = int(h)
    except Exception:
        max_w, max_h = 0, 0

    if max_w <= 0 and max_h <= 0:
        max_w = 1200
    if max_w <= 0:
        max_w = 99999
    if max_h <= 0:
        max_h = 99999

    safe_src = (src or "").strip()
    if not safe_src:
        raise HTTPException(status_code=400, detail="src is required")

    if safe_src.startswith("http://") or safe_src.startswith("https://"):
        try:
            safe_src = urlparse(safe_src).path
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid src URL")

    if safe_src.startswith("/uploads/"):
        rel_path = safe_src[len("/uploads/") :]
    elif safe_src.startswith("uploads/"):
        rel_path = safe_src[len("uploads/") :]
    else:
        raise HTTPException(status_code=400, detail="src must point to /uploads")

    rel_path = rel_path.lstrip("/\\")
    norm_rel = os.path.normpath(rel_path)
    if norm_rel.startswith("..") or os.path.isabs(norm_rel):
        raise HTTPException(status_code=400, detail="Invalid src path")

    src_path = os.path.abspath(os.path.join(UPLOADS_DIR, norm_rel))
    if os.path.commonpath([UPLOADS_DIR, src_path]) != UPLOADS_DIR:
        raise HTTPException(status_code=400, detail="Invalid src path")

    src_bytes = None
    src_mtime = 0
    if os.path.exists(src_path) and os.path.isfile(src_path):
        try:
            src_mtime = int(os.path.getmtime(src_path))
        except Exception:
            src_mtime = 0
    else:
        base = os.getenv("PUBLIC_BASE_URL")
        if base:
            base = base.rstrip("/")
        else:
            proto = request.headers.get("x-forwarded-proto") or request.url.scheme
            host = request.headers.get("x-forwarded-host") or request.headers.get("host")
            if not host:
                raise HTTPException(status_code=404, detail="Image not found")
            base = f"{proto}://{host}".rstrip("/")

        remote_url = f"{base}{safe_src if safe_src.startswith('/uploads/') else '/uploads/' + norm_rel}"
        try:
            response = httpx.get(remote_url, timeout=15.0, follow_redirects=True)
            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="Image not found")
            content_type = response.headers.get("content-type", "")
            if not content_type.startswith("image/"):
                raise HTTPException(status_code=404, detail="Image not found")
            src_bytes = response.content
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=404, detail="Image not found")

    cache_dir = os.path.join(UPLOADS_DIR, ".cache")
    os.makedirs(cache_dir, exist_ok=True)

    key = f"{norm_rel}|{max_w}|{max_h}|{quality}|{fmt}|{src_mtime}"
    digest = hashlib.md5(key.encode("utf-8")).hexdigest()
    cached_path = os.path.join(cache_dir, f"img_{digest}.{fmt}")

    if not os.path.exists(cached_path):
        try:
            if src_bytes is not None:
                image_source = BytesIO(src_bytes)
                image_context = PILImage.open(image_source)
            else:
                image_context = PILImage.open(src_path)

            with image_context as image:
                image = ImageOps.exif_transpose(image)
                if fmt in {"jpg", "webp"} and image.mode not in {"RGB", "RGBA"}:
                    image = image.convert("RGB")
                image.thumbnail((max_w, max_h), resample=PILImage.Resampling.LANCZOS)

                save_kwargs = {}
                if fmt == "jpg":
                    save_kwargs = {
                        "format": "JPEG",
                        "quality": quality,
                        "optimize": True,
                        "progressive": True,
                    }
                elif fmt == "png":
                    save_kwargs = {"format": "PNG", "optimize": True}
                elif fmt == "webp":
                    save_kwargs = {"format": "WEBP", "quality": quality, "method": 6}

                image.save(cached_path, **save_kwargs)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Resize failed: {exc}")

    media_type = {
        "jpg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }[fmt]

    return FileResponse(
        cached_path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
