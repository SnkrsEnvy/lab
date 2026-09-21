from __future__ import annotations

import base64
import hashlib
import io
import json
import uuid
from typing import Any

import fitz
import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import Image, ImageChops, ImageDraw

APP_VERSION = "0.35.0-g5i"
ACTIVE_GATE = "G5I Distributed Page Delta Lifecycle + Conflict-Safe Undo"
TRANSPORT = "g6h-stateless-same-origin-v001"
MAX_PDF_BYTES = 3_500_000
RENDER_SCALE = 2.0
OUTSIDE_TOLERANCE = 0.00005
SELFTEST_PDF_B64 = "JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIgL0Y0IDUgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtQm9sZCAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjIgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago0IDAgb2JqCjw8Ci9CYXNlRm9udCAvVGltZXMtQm9sZCAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjMgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago1IDAgb2JqCjw8Ci9CYXNlRm9udCAvQ291cmllciAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjQgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago2IDAgb2JqCjw8Ci9Db250ZW50cyAxMSAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDEwIDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago3IDAgb2JqCjw8Ci9Db250ZW50cyAxMiAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDEwIDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgMTAgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago5IDAgb2JqCjw8Ci9BdXRob3IgKGFub255bW91cykgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MDkyMDAyNTMwMCswMCcwMCcpIC9DcmVhdG9yIChhbm9ueW1vdXMpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MDkyMDAyNTMwMCswMCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0ICh1bnNwZWNpZmllZCkgL1RpdGxlICh1bnRpdGxlZCkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iagoxMCAwIG9iago8PAovQ291bnQgMiAvS2lkcyBbIDYgMCBSIDcgMCBSIF0gL1R5cGUgL1BhZ2VzCj4+CmVuZG9iagoxMSAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCA1MDUKPj4Kc3RyZWFtCkdhcm89OTk3Z00nU1o7VydrYzNbPCwrKzk3LXVOXCcxXT9tOEtzUjpmNylNbkRKXiVxLzlUPl4/ZColWEJlaSMqXEQyR0dGKz5LU0tEVyV0SjEkJlMzdDxtOWNKWGpXVycpb0RAUFduXD4oWjhpUTNkZDBCZTVEUWstPm07OF06JEwkNyNgX2lWXW9oPmpzLkpdRE8+cDs8N0YhOj8tPDhwQlVkQyhQRz1eSDosMiVeU3UyXicrbUo9cGlNdCpeNy86XS4uI2AyKUNNPFEpK0AyLzU9PkMkSEZPXTpoOyU8K1JDTSEuTmA0aUJUVW9tK2dORjVXKUQtcStUYzd1JDA4KC50JkJfOG9BPSRlXzkkXyE3Tkg5OjFiRi9XOl8hW2l0TzhdLDFLYTRaRTBeNzdNZ2hGQlFfZnMhUGdUcCwvKWxXI2ZLW04kQUFANkVtRV5FLixGa1wqcXJgbGs5L3BvUic1WkxTL0c5YWUiJnFbJVxBTj5cO0M1SitsQ1xhcihvOzFvKTQsXkZeW0hZWz1fa28/Jy5kXkk8XShpYlNoN2ZYVFhNKkhKS0M9XzlMN2U0MHF1dHQiT288QTFnIzRwbm5DUHAlW1Q9RjduRTo1OSwpN0QjSSVNRG5HIjkiVVk+OWtwZVo2aVJMXT86N3I8ITU5Wm5ffj5lbmRzdHJlYW0KZW5kb2JqCjEyIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDI0MQo+PgpzdHJlYW0KR2FyVzJfLnBrQSUjNDRyTVo6MSVpXlFdMEZOOlBrVl0/ITUqWycqTWoscXQ9RVZmVVhdSj1YSSFYWE9vbWhfWyRNZlE5T243JlVgJzFmdUY1YEtHYj8/JWBTK0EjMGk2VnVUMlY6TVg8P0l0Ukk3N00lNU4oRW8qWEYjOUc8Sis9UTBJKjFHZnVEdD5lbTAuPjUhay1ibUZnRzg2Xm0jPUpiYXVQNTU+JF9qXT8xP3M3UFlYQigjYVRFO0IxL0FgamBoNHRfSypedGshNEg5XT1ILFR0dTwqI3FiTkc4dWRUaCZ1XCJVVVVEUmpbXDV+PmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDEzCjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMTIyIDAwMDAwIG4gCjAwMDAwMDAyMjkgMDAwMDAgbiAKMDAwMDAwMDM0MSAwMDAwMCBuIAowMDAwMDAwNDQ5IDAwMDAwIG4gCjAwMDAwMDA1NTQgMDAwMDAgbiAKMDAwMDAwMDc0OSAwMDAwMCBuIAowMDAwMDAwOTQ0IDAwMDAwIG4gCjAwMDAwMDEwMTMgMDAwMDAgbiAKMDAwMDAwMTI3NCAwMDAwMCBuIAowMDAwMDAxMzQwIDAwMDAwIG4gCjAwMDAwMDE5MzYgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8ZDdhZjBlM2Q5YzQyZjk4ZTAzMDM5NjkyYjA0NWUzYzg+PGQ3YWYwZTNkOWM0MmY5OGUwMzAzOTY5MmIwNDVlM2M4Pl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA5IDAgUgovUm9vdCA4IDAgUgovU2l6ZSAxMwo+PgpzdGFydHhyZWYKMjI2OAolJUVPRgo="
SELFTEST_SOURCE_SHA256 = "da37ed6b61739777d399c7292dbe5f88661f34ade3abae245aaf287d826e3c92"
SELFTEST_TARGET = "Select this sentence in Page Mode and stage a bounded replacement."
SELFTEST_CONTROL = "A one-page edit should leave this control page render-identical."

app = FastAPI(title="Publisher Studio G5I Stateless Transport", version=APP_VERSION)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hex_rgb(value: str | None, fallback: tuple[float, float, float] = (0, 0, 0)) -> tuple[float, float, float]:
    if not value:
        return fallback
    s = str(value).strip().lstrip("#")
    if len(s) == 3:
        s = "".join(ch * 2 for ch in s)
    if len(s) != 6:
        return fallback
    try:
        return tuple(int(s[i:i+2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]
    except Exception:
        return fallback


def rect_list(rect: fitz.Rect) -> list[float]:
    return [round(float(rect.x0), 3), round(float(rect.y0), 3), round(float(rect.x1), 3), round(float(rect.y1), 3)]


def fit_insert(page: fitz.Page, target: fitz.Rect, text: str, *, fs: float, color: tuple[float, float, float], align: int) -> dict[str, Any]:
    if not text:
        return {"inserted": True, "fontSizeUsed": fs, "result": 0}
    last = None
    for factor in (1.0, 0.96, 0.92, 0.88, 0.84, 0.78, 0.72, 0.66, 0.60, 0.54):
        size = max(3.5, fs * factor)
        result = page.insert_textbox(
            target, text, fontsize=size, fontname="helv", color=color, align=align,
            lineheight=1.0, overlay=True,
        )
        last = result
        if result >= 0:
            return {"inserted": True, "fontSizeUsed": round(size, 3), "result": result}
    return {"inserted": False, "fontSizeUsed": round(max(3.5, fs * 0.54), 3), "result": last}


def normalize_bbox(raw: Any, *, page_rect: fitz.Rect | None = None) -> fitz.Rect:
    if not isinstance(raw, list) or len(raw) != 4:
        raise HTTPException(400, "Operation bbox must be [x0,y0,x1,y1]")
    try:
        rect = fitz.Rect(*[float(v) for v in raw])
    except Exception as exc:
        raise HTTPException(400, f"Invalid operation bbox: {exc}")
    if rect.is_empty or rect.width < 1 or rect.height < 1:
        raise HTTPException(400, "Operation bbox is empty or too small")
    if page_rect is not None:
        rect = rect & page_rect
        if rect.is_empty:
            raise HTTPException(400, "Operation bbox lies outside the page")
    return rect


def validate_pdf(raw: bytes) -> fitz.Document:
    if not raw:
        raise HTTPException(400, "PDF is empty")
    if len(raw) > MAX_PDF_BYTES:
        raise HTTPException(413, f"Checkpoint limit is {MAX_PDF_BYTES} bytes per PDF")
    try:
        doc = fitz.open(stream=raw, filetype="pdf")
        if doc.page_count < 1:
            doc.close()
            raise HTTPException(400, "PDF contains no pages")
        return doc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Unable to open PDF: {exc}")


def inspect_pdf(raw: bytes) -> dict[str, Any]:
    doc = validate_pdf(raw)
    try:
        pages = []
        for pno, page in enumerate(doc, start=1):
            blocks = []
            for idx, block in enumerate(page.get_text("blocks")):
                if len(block) < 5:
                    continue
                text = str(block[4]).replace("\r", "").strip()
                if not text:
                    continue
                blocks.append({
                    "id": f"p{pno}-b{idx+1}",
                    "bbox": [round(float(v), 3) for v in block[:4]],
                    "text": text,
                })
            pages.append({
                "page": pno,
                "width": round(float(page.rect.width), 3),
                "height": round(float(page.rect.height), 3),
                "rotation": int(page.rotation),
                "text": page.get_text("text"),
                "blocks": blocks,
            })
        return {
            "version": APP_VERSION,
            "gate": ACTIVE_GATE,
            "transport": TRANSPORT,
            "sourceState": "FROZEN_CLIENT_SOURCE",
            "sourceSha256": sha256_bytes(raw),
            "bytes": len(raw),
            "pageCount": doc.page_count,
            "pages": pages,
            "claim": "Read-only stateless inspection of the client-supplied frozen PDF. No server persistence is implied.",
        }
    finally:
        doc.close()


def render_doc_page(raw: bytes, page_index: int, scale: float = RENDER_SCALE) -> Image.Image:
    doc = fitz.open(stream=raw, filetype="pdf")
    try:
        pix = doc[page_index].get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    finally:
        doc.close()


def rects_overlap(a: fitz.Rect, b: fitz.Rect, tolerance: float = 1.5) -> bool:
    aa = fitz.Rect(a.x0 - tolerance, a.y0 - tolerance, a.x1 + tolerance, a.y1 + tolerance)
    return not (aa & b).is_empty


def apply_operations(source_raw: bytes, operations: list[dict[str, Any]]) -> tuple[bytes, list[dict[str, Any]]]:
    doc = validate_pdf(source_raw)
    results: list[dict[str, Any]] = []
    try:
        sequence_types = {"reorder_pages", "insert_page", "delete_page"}
        sequence_ops = [op for op in operations if isinstance(op, dict) and op.get("type") in sequence_types]
        if sequence_ops:
            if len(sequence_ops) != 1 or len(operations) != 1:
                raise HTTPException(409, "Page-sequence edits are isolated transactions so page identity stays unambiguous")
            op = sequence_ops[0]
            op_id = str(op.get("id") or uuid.uuid4())
            op_type = str(op.get("type") or "")

            if op_type == "reorder_pages":
                try:
                    order = [int(x) for x in (op.get("pageList") or [])]
                except Exception:
                    raise HTTPException(400, "reorder_pages pageList must contain valid 1-based source page numbers")
                if not order or any(x < 1 or x > doc.page_count for x in order):
                    raise HTTPException(400, "reorder_pages pageList must contain valid 1-based source page numbers")
                if len(set(order)) != len(order):
                    raise HTTPException(409, "Reorder does not duplicate pages; each source page may appear once")
                doc.select([x - 1 for x in order])
                results.append({"id": op_id, "type": op_type, "pageList": order, "pageCount": doc.page_count})

            elif op_type == "insert_page":
                try:
                    insert_at = int(op.get("insertAt"))
                    width = float(op.get("width"))
                    height = float(op.get("height"))
                except Exception:
                    raise HTTPException(400, "insert_page requires insertAt, width, and height")
                if insert_at < 1 or insert_at > doc.page_count + 1:
                    raise HTTPException(400, "insert_page insertAt must be a valid 1-based output position")
                if width <= 0 or height <= 0 or width > 20000 or height > 20000:
                    raise HTTPException(400, "insert_page dimensions are invalid")
                doc.new_page(pno=insert_at - 1, width=width, height=height)
                results.append({"id": op_id, "type": op_type, "insertAt": insert_at, "width": width, "height": height, "pageCount": doc.page_count})

            elif op_type == "delete_page":
                try:
                    page_num = int(op.get("page"))
                except Exception:
                    raise HTTPException(400, "delete_page requires a 1-based source page number")
                if doc.page_count <= 1:
                    raise HTTPException(409, "A PDF must retain at least one page")
                if page_num < 1 or page_num > doc.page_count:
                    raise HTTPException(400, "delete_page points to an invalid source page")
                doc.delete_page(page_num - 1)
                results.append({"id": op_id, "type": op_type, "page": page_num, "pageCount": doc.page_count})

            out = io.BytesIO()
            doc.save(out, garbage=4, deflate=True, clean=True)
            return out.getvalue(), results

        for op in operations:
            if not isinstance(op, dict):
                raise HTTPException(400, "Every operation must be an object")
            op_id = str(op.get("id") or uuid.uuid4())
            op_type = str(op.get("type") or "").strip()
            try:
                page_num = int(op.get("page") or 0)
            except Exception:
                page_num = 0
            if page_num < 1 or page_num > doc.page_count:
                raise HTTPException(400, f"Operation {op_id} points to invalid page")
            page = doc[page_num - 1]
            rect = normalize_bbox(op.get("bbox"), page_rect=page.rect)

            if op_type == "replace_text":
                old_text = str(op.get("oldText") or "")
                new_text = str(op.get("newText") or "")
                background_mode = str(op.get("backgroundMode") or "preserve")
                if background_mode == "preserve":
                    fill = None
                elif background_mode == "explicit":
                    fill = hex_rgb(str(op.get("fill") or "#ffffff"), (1, 1, 1))
                else:
                    raise HTTPException(400, f"Stateless text replacement supports preserve or explicit background only, not: {background_mode}")
                page.add_redact_annot(rect, fill=fill, cross_out=False)
                page.apply_redactions(
                    images=fitz.PDF_REDACT_IMAGE_NONE,
                    graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                    text=fitz.PDF_REDACT_TEXT_REMOVE,
                )
                align = {"left": fitz.TEXT_ALIGN_LEFT, "center": fitz.TEXT_ALIGN_CENTER, "right": fitz.TEXT_ALIGN_RIGHT, "justify": fitz.TEXT_ALIGN_JUSTIFY}.get(str(op.get("align") or "left"), fitz.TEXT_ALIGN_LEFT)
                target = fitz.Rect(rect.x0 + 0.25, rect.y0 + 0.05, rect.x1 - 0.25, rect.y1 - 0.05)
                default_fs = max(4.0, min(rect.height * 0.72, 144.0))
                fs = max(4.0, min(float(op.get("fontSize") or default_fs), 144.0))
                insertion = fit_insert(page, target, new_text, fs=fs, color=hex_rgb(str(op.get("color") or "#000000"), (0, 0, 0)), align=align)
                if not insertion["inserted"]:
                    raise HTTPException(409, f"Replacement text does not fit the authorized box for operation {op_id}")
                results.append({"id": op_id, "type": op_type, "page": page_num, "status": "APPLIED", "oldText": old_text, "newText": new_text, "backgroundMode": background_mode, "insertion": insertion, "bbox": rect_list(rect)})
                continue

            if op_type == "redact":
                fill = str(op.get("fill") or "#000000")
                page.add_redact_annot(rect, fill=hex_rgb(fill, (0, 0, 0)), cross_out=False)
                page.apply_redactions(
                    images=fitz.PDF_REDACT_IMAGE_PIXELS,
                    graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED,
                    text=fitz.PDF_REDACT_TEXT_REMOVE,
                )
                results.append({"id": op_id, "type": op_type, "page": page_num, "status": "APPLIED", "trueRedaction": True, "fill": fill, "bbox": rect_list(rect)})
                continue

            if op_type == "add_link":
                uri = str(op.get("uri") or "").strip()
                if not uri:
                    raise HTTPException(400, f"URI missing for operation {op_id}")
                page.insert_link({"kind": fitz.LINK_URI, "from": rect, "uri": uri})
                results.append({"id": op_id, "type": op_type, "page": page_num, "status": "APPLIED", "uri": uri, "bbox": rect_list(rect)})
                continue

            raise HTTPException(400, f"Stateless checkpoint does not yet expose operation type: {op_type}")

        out = io.BytesIO()
        doc.save(out, garbage=4, deflate=True, clean=True)
        return out.getvalue(), results
    finally:
        doc.close()


def verify_render(source_raw: bytes, output_raw: bytes, operations: list[dict[str, Any]]) -> dict[str, Any]:
    src_doc = fitz.open(stream=source_raw, filetype="pdf")
    out_doc = fitz.open(stream=output_raw, filetype="pdf")
    try:
        src_count = src_doc.page_count
        out_count = out_doc.page_count
        src_rects = [fitz.Rect(p.rect) for p in src_doc]
    finally:
        src_doc.close(); out_doc.close()

    sequence_types = {"reorder_pages", "insert_page", "delete_page"}
    sequence = next((op for op in operations if isinstance(op, dict) and op.get("type") in sequence_types), None)
    if sequence:
        op_type = str(sequence.get("type") or "")
        rows = []; max_ratio = 0.0

        if op_type == "reorder_pages":
            lineage = [int(x) for x in (sequence.get("pageList") or [])]
            if out_count != len(lineage):
                return {"pass": False, "reason": "Output page count does not match page lineage", "sourcePageCount": src_count, "outputPageCount": out_count, "pageLineage": lineage}
            pairs = list(enumerate(lineage, start=1))

        elif op_type == "delete_page":
            deleted = int(sequence.get("page") or 0)
            lineage = [n for n in range(1, src_count + 1) if n != deleted]
            if out_count != len(lineage):
                return {"pass": False, "reason": "Deleted-page output count does not match retained lineage", "sourcePageCount": src_count, "outputPageCount": out_count, "pageLineage": lineage}
            pairs = list(enumerate(lineage, start=1))

        elif op_type == "insert_page":
            insert_at = int(sequence.get("insertAt") or 0)
            if out_count != src_count + 1 or insert_at < 1 or insert_at > out_count:
                return {"pass": False, "reason": "Inserted-page output count or position is invalid", "sourcePageCount": src_count, "outputPageCount": out_count, "insertAt": insert_at}
            lineage = []
            pairs = []
            src_page = 1
            for out_idx in range(1, out_count + 1):
                if out_idx == insert_at:
                    lineage.append("blank")
                    blank = render_doc_page(output_raw, out_idx - 1)
                    expected = Image.new("RGB", blank.size, (255, 255, 255))
                    diff = ImageChops.difference(expected, blank).convert("L")
                    hist = diff.histogram(); total = max(1, blank.size[0] * blank.size[1])
                    ratio = (total - hist[0]) / total; max_ratio = max(max_ratio, ratio)
                    rows.append({"outputPage": out_idx, "sourcePage": None, "insertedBlank": True, "renderDifferenceRatio": ratio, "pass": ratio < OUTSIDE_TOLERANCE})
                else:
                    lineage.append(src_page)
                    pairs.append((out_idx, src_page))
                    src_page += 1
        else:
            return {"pass": False, "reason": "Unsupported page-sequence verification type"}

        for out_idx, src_page in pairs:
            src = render_doc_page(source_raw, src_page - 1)
            out = render_doc_page(output_raw, out_idx - 1)
            if src.size != out.size:
                rows.append({"outputPage": out_idx, "sourcePage": src_page, "pass": False, "reason": "Rendered size changed"}); max_ratio = 1.0; continue
            diff = ImageChops.difference(src, out).convert("L")
            hist = diff.histogram(); total = max(1, src.size[0] * src.size[1])
            ratio = (total - hist[0]) / total; max_ratio = max(max_ratio, ratio)
            rows.append({"outputPage": out_idx, "sourcePage": src_page, "renderDifferenceRatio": ratio, "pass": ratio < OUTSIDE_TOLERANCE})
        return {"pass": all(r["pass"] for r in rows), "sourcePageCount": src_count, "outputPageCount": out_count, "pageLineage": lineage, "maxOutsideAuthorizedEditRatio": max_ratio, "pages": rows, "claim": "Page-lifecycle export preserves every retained source page raster and independently proves inserted blank-page raster."}

    if src_count != out_count:
        return {"pass": False, "reason": "Page count changed without a sequence operation", "pageCountEqual": False}
    page_count = src_count
    touched = {int(op.get("page") or 0) for op in operations}
    rows = []
    max_outside = 0.0
    for page_num in range(1, page_count + 1):
        src = render_doc_page(source_raw, page_num - 1)
        out = render_doc_page(output_raw, page_num - 1)
        if src.size != out.size:
            rows.append({"page": page_num, "pass": False, "reason": "Rendered size changed"})
            max_outside = 1.0
            continue
        gray = ImageChops.difference(src, out).convert("L")
        total = max(1, src.size[0] * src.size[1])
        page_ops = [op for op in operations if int(op.get("page") or 0) == page_num]
        if not page_ops:
            hist = gray.histogram(); ratio = (total - hist[0]) / total
        else:
            mask = Image.new("L", src.size, 255)
            draw = ImageDraw.Draw(mask)
            pr = src_rects[page_num - 1]
            sx, sy = src.size[0] / pr.width, src.size[1] / pr.height
            for op in page_ops:
                raw_bbox = op.get("bbox")
                if not isinstance(raw_bbox, list) or len(raw_bbox) != 4:
                    continue
                x0, y0, x1, y1 = [float(v) for v in raw_bbox]
                pad = 10
                draw.rectangle((int(x0*sx)-pad, int(y0*sy)-pad, int(x1*sx)+pad, int(y1*sy)+pad), fill=0)
            outside = ImageChops.multiply(gray, mask)
            hist = outside.histogram(); ratio = (total - hist[0]) / total
        max_outside = max(max_outside, ratio)
        rows.append({"page": page_num, "touched": page_num in touched, "outsideChangeRatio": ratio, "pass": ratio < OUTSIDE_TOLERANCE})
    return {
        "pass": all(r["pass"] for r in rows),
        "pageCountEqual": True,
        "maxOutsideAuthorizedEditRatio": max_outside,
        "pages": rows,
        "claim": "Untouched page regions are stable within the frozen G5I render-diff tolerance outside authorized edit boxes.",
    }


def verify_structure(source_raw: bytes, output_raw: bytes, operations: list[dict[str, Any]]) -> dict[str, Any]:
    doc = fitz.open(stream=output_raw, filetype="pdf")
    try:
        checks = []
        sequence_types = {"reorder_pages", "insert_page", "delete_page"}
        sequence = next((op for op in operations if isinstance(op, dict) and op.get("type") in sequence_types), None)
        if sequence:
            op_type = str(sequence.get("type") or "")
            evidence: dict[str, Any] = {"actualPageCount": doc.page_count}
            passed = False
            if op_type == "reorder_pages":
                lineage = [int(x) for x in (sequence.get("pageList") or [])]
                evidence.update({"expectedPageCount": len(lineage), "lineage": lineage})
                passed = doc.page_count == len(lineage)
            elif op_type == "delete_page":
                src = fitz.open(stream=source_raw, filetype="pdf")
                try:
                    expected = src.page_count - 1
                finally:
                    src.close()
                evidence.update({"expectedPageCount": expected, "deletedSourcePage": int(sequence.get("page") or 0)})
                passed = doc.page_count == expected and expected >= 1
            elif op_type == "insert_page":
                src = fitz.open(stream=source_raw, filetype="pdf")
                try:
                    expected = src.page_count + 1
                finally:
                    src.close()
                insert_at = int(sequence.get("insertAt") or 0)
                width = float(sequence.get("width") or 0)
                height = float(sequence.get("height") or 0)
                if 1 <= insert_at <= doc.page_count:
                    page = doc[insert_at - 1]
                    empty_text = not page.get_text("text").strip()
                    no_images = not bool(page.get_images(full=True))
                    no_links = not bool(page.get_links())
                    no_drawings = not bool(page.get_drawings())
                    geometry = abs(float(page.rect.width) - width) < 0.01 and abs(float(page.rect.height) - height) < 0.01
                else:
                    empty_text = no_images = no_links = no_drawings = geometry = False
                evidence.update({"expectedPageCount": expected, "insertAt": insert_at, "width": width, "height": height, "emptyText": empty_text, "noImages": no_images, "noLinks": no_links, "noDrawings": no_drawings, "geometryMatch": geometry})
                passed = doc.page_count == expected and empty_text and no_images and no_links and no_drawings and geometry
            checks.append({"id": str(sequence.get("id") or "page-sequence"), "type": op_type, "pass": passed, "evidence": evidence})
            return {"pass": all(x["pass"] for x in checks), "checks": checks, "claim": "Page-lifecycle structure, geometry, and page count were reparsed from the exported PDF."}
        for op in operations:
            op_id = str(op.get("id") or "")
            op_type = str(op.get("type") or "")
            page_num = int(op.get("page") or 0)
            if page_num < 1 or page_num > doc.page_count:
                checks.append({"id": op_id, "type": op_type, "page": page_num, "pass": False, "evidence": {"reason": "page missing after export"}})
                continue
            page = doc[page_num - 1]
            rect = fitz.Rect(*[float(v) for v in op.get("bbox")])
            passed = True
            evidence: dict[str, Any] = {}
            if op_type == "replace_text":
                old_text = str(op.get("oldText") or "").strip()
                new_text = str(op.get("newText") or "").strip()
                old_hits = [r for r in page.search_for(old_text) if rects_overlap(fitz.Rect(r), rect, 0.5)] if old_text else []
                new_hits = [r for r in page.search_for(new_text) if rects_overlap(fitz.Rect(r), rect, 1.5)] if new_text else []
                passed = len(old_hits) == 0 and (not new_text or bool(new_hits))
                evidence["remainingOldTextHits"] = len(old_hits)
                evidence["replacementTextHits"] = len(new_hits)
            elif op_type == "redact":
                old_text = str(op.get("oldText") or "").strip()
                if old_text:
                    hits = [r for r in page.search_for(old_text) if rects_overlap(fitz.Rect(r), rect, 0.5)]
                    passed = len(hits) == 0
                    evidence["remainingOldTextHits"] = len(hits)
                else:
                    evidence["mode"] = "destructive box redaction"
            elif op_type == "add_link":
                uri = str(op.get("uri") or "")
                hits = []
                for link in page.get_links():
                    if link.get("uri") == uri:
                        lr = fitz.Rect(link.get("from")) if link.get("from") is not None else fitz.Rect()
                        if rects_overlap(lr, rect):
                            hits.append(link)
                passed = bool(hits)
                evidence["matchingLinks"] = len(hits)
            else:
                passed = False; evidence["reason"] = "unsupported verification type"
            checks.append({"id": op_id, "type": op_type, "page": page_num, "pass": passed, "evidence": evidence})
        return {"pass": all(x["pass"] for x in checks), "checks": checks, "claim": "Structural operations were reparsed from the exported PDF."}
    finally:
        doc.close()


def build_receipt(source_raw: bytes, output_raw: bytes, operations: list[dict[str, Any]], operation_results: list[dict[str, Any]], preset: str) -> dict[str, Any]:
    render = verify_render(source_raw, output_raw, operations)
    structural = verify_structure(source_raw, output_raw, operations)
    verification = {
        **render,
        "renderPass": bool(render.get("pass")),
        "structural": structural,
        "readerWitness": {"available": False, "pass": None, "claim": "Independent Poppler witness is not included in the stateless Vercel checkpoint."},
        "readerWitnessRequired": False,
        "sourceSha256": sha256_bytes(source_raw),
        "outputSha256": sha256_bytes(output_raw),
        "noOpByteIdentical": False,
    }
    verification["pass"] = bool(verification["renderPass"] and structural.get("pass"))
    return {
        "transport": TRANSPORT,
        "engineVersion": APP_VERSION,
        "engineGate": ACTIVE_GATE,
        "operationCount": len(operations),
        "operations": operations,
        "operationResults": operation_results,
        "preset": preset,
        "verification": verification,
        "claim": "Stateless public transport executes bounded text-replacement/redaction/link and isolated page-lifecycle mutations with render/structural proof in one invocation. G6L adds blank-page insertion and source-page deletion to the already-proven reorder path; this public transport extension is not claimed to be recovered frozen G5I source code.",
    }


@app.get("/")
@app.get("/api/publisher_studio_g5i")
@app.get("/api/publisher-studio-g5i")
async def capabilities(request: Request, selftest: str | None = None) -> JSONResponse:
    if selftest:
        raw = base64.b64decode(SELFTEST_PDF_B64)
        inspected = inspect_pdf(raw)
        if inspected["sourceSha256"] != SELFTEST_SOURCE_SHA256:
            raise HTTPException(500, "Embedded self-test fixture hash mismatch")
        target = next((b for b in inspected["pages"][0]["blocks"] if SELFTEST_TARGET in b["text"]), None)
        if target is None:
            raise HTTPException(500, "Self-test target text block missing")
        op = {"id": "g6h-public-selftest-redact", "type": "redact", "page": 1, "bbox": target["bbox"], "oldText": target["text"], "fill": "#000000"}
        output, op_results = apply_operations(raw, [op])
        proof = build_receipt(raw, output, [op], op_results, "screen")
        doc = fitz.open(stream=output, filetype="pdf")
        try:
            all_text = "\n".join(page.get_text("text") for page in doc)
            page2_text = doc[1].get_text("text") if doc.page_count > 1 else ""
            assertions = {
                "sourceHashExact": inspected["sourceSha256"] == SELFTEST_SOURCE_SHA256,
                "outputHashChanged": sha256_bytes(output) != SELFTEST_SOURCE_SHA256,
                "pageCountPreserved": doc.page_count == 2,
                "redactedTextAbsent": SELFTEST_TARGET not in all_text,
                "controlPagePreserved": SELFTEST_CONTROL in page2_text,
                "verificationPass": bool(proof["verification"]["pass"]),
                "renderPass": bool(proof["verification"]["renderPass"]),
                "structuralPass": bool(proof["verification"]["structural"]["pass"]),
            }
        finally:
            doc.close()
        roundtrip = None
        if str(selftest).lower() in {"roundtrip", "full", "post"}:
            public_url = str(request.base_url).rstrip("/") + "/api/publisher-studio-g5i"
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                remote = await client.post(
                    public_url,
                    files={"file": ("publisher-studio-demo.pdf", raw, "application/pdf")},
                    data={"mode": "export", "operations": json.dumps([op]), "preset": "screen"},
                    headers={"x-publisher-selftest": "g6h-roundtrip"},
                )
            remote_bytes = remote.content
            remote_doc = fitz.open(stream=remote_bytes, filetype="pdf") if remote.status_code == 200 else None
            try:
                remote_text = "\n".join(page.get_text("text") for page in remote_doc) if remote_doc else ""
                remote_page2 = remote_doc[1].get_text("text") if remote_doc and remote_doc.page_count > 1 else ""
                remote_assertions = {
                    "http200": remote.status_code == 200,
                    "contentTypePdf": remote.headers.get("content-type", "").startswith("application/pdf"),
                    "verificationHeader": remote.headers.get("x-publisher-verification-pass") == "true",
                    "renderHeader": remote.headers.get("x-publisher-render-pass") == "true",
                    "structuralHeader": remote.headers.get("x-publisher-structural-pass") == "true",
                    "sourceHashHeader": remote.headers.get("x-publisher-source-sha256") == SELFTEST_SOURCE_SHA256,
                    "outputHashHeader": remote.headers.get("x-publisher-output-sha256") == sha256_bytes(remote_bytes),
                    "outputHashChanged": sha256_bytes(remote_bytes) != SELFTEST_SOURCE_SHA256,
                    "pageCountPreserved": bool(remote_doc and remote_doc.page_count == 2),
                    "redactedTextAbsent": SELFTEST_TARGET not in remote_text,
                    "controlPagePreserved": SELFTEST_CONTROL in remote_page2,
                }
            finally:
                if remote_doc:
                    remote_doc.close()
            roundtrip = {
                "status": "PASS" if all(remote_assertions.values()) else "FAIL",
                "url": public_url,
                "httpStatus": remote.status_code,
                "outputSha256": sha256_bytes(remote_bytes),
                "outputBytes": len(remote_bytes),
                "assertions": remote_assertions,
                "transportHeader": remote.headers.get("x-publisher-transport"),
                "proofSha256Header": remote.headers.get("x-publisher-proof-sha256"),
            }
            assertions["publicMultipartRoundtrip"] = roundtrip["status"] == "PASS"

        return JSONResponse({
            "status": "PASS" if all(assertions.values()) else "FAIL",
            "version": APP_VERSION,
            "gate": ACTIVE_GATE,
            "transport": TRANSPORT,
            "sourceSha256": inspected["sourceSha256"],
            "outputSha256": sha256_bytes(output),
            "outputBytes": len(output),
            "assertions": assertions,
            "roundtrip": roundtrip,
            "proofSha256": sha256_bytes(json.dumps(proof, sort_keys=True, separators=(",", ":")).encode("utf-8")),
            "claim": "Public Vercel function self-test executes the authentic frozen G5I sample through the same stateless redaction and verification code path used by browser export; roundtrip mode also posts multipart PDF bytes back through the public Vercel endpoint.",
        }, headers={"Cache-Control": "no-store"})
    return JSONResponse({
        "version": APP_VERSION,
        "gate": ACTIVE_GATE,
        "transport": TRANSPORT,
        "stateless": True,
        "maxPdfBytes": MAX_PDF_BYTES,
        "capabilities": {"replaceText": True, "redact": True, "links": True, "pageReorder": True, "pageInsert": True, "pageDelete": True, "undo": True, "exportPdf": True, "ocr": False, "forms": False},
        "editing": ["bounded native text replacement", "true redaction", "bounded URI link insertion", "isolated page reorder transaction", "isolated blank-page insertion", "isolated source-page deletion", "staged client-side undo", "bounded export proof"],
        "frozen": ["client source bytes", "source hash", "untouched regions"],
        "limitOfClaim": "This transport checkpoint proves bounded native text replacement with builtin Helvetica fallback, true redaction, URI link insertion, isolated page reorder, blank-page insertion, and source-page deletion. Page lifecycle is implemented in the public stateless transport layer; recovered frozen G5I source parity, source-font-perfect replacement, text reflow, OCR/forms transport, durable server workspaces, distributed collaboration, and independent Poppler witness proof are not claimed.",
    }, headers={"Cache-Control": "no-store"})


@app.post("/")
@app.post("/api/publisher_studio_g5i")
@app.post("/api/publisher-studio-g5i")
async def operate(
    file: UploadFile = File(...),
    mode: str = Form("inspect"),
    operations: str = Form("[]"),
    preset: str = Form("screen"),
) -> Response:
    raw = await file.read()
    if mode == "inspect":
        return JSONResponse(inspect_pdf(raw), headers={"Cache-Control": "no-store"})
    if mode != "export":
        raise HTTPException(400, "mode must be inspect or export")
    if preset not in {"screen", "press", "archive"}:
        raise HTTPException(400, "Unknown export preset")
    try:
        ops = json.loads(operations)
    except Exception as exc:
        raise HTTPException(400, f"operations must be JSON: {exc}")
    if not isinstance(ops, list) or not ops:
        raise HTTPException(400, "At least one staged operation is required")
    output, op_results = apply_operations(raw, ops)
    receipt = build_receipt(raw, output, ops, op_results, preset)
    if not receipt["verification"]["pass"]:
        return JSONResponse(receipt, status_code=409, headers={"Cache-Control": "no-store"})
    proof_json = json.dumps(receipt, sort_keys=True, separators=(",", ":")).encode("utf-8")
    v = receipt["verification"]
    headers = {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="PublisherStudio-export.pdf"',
        "X-Publisher-G5I-Version": APP_VERSION,
        "X-Publisher-Transport": TRANSPORT,
        "X-Publisher-Verification-Pass": "true",
        "X-Publisher-Render-Pass": "true" if v.get("renderPass") else "false",
        "X-Publisher-Structural-Pass": "true" if v.get("structural", {}).get("pass") else "false",
        "X-Publisher-Source-Sha256": v["sourceSha256"],
        "X-Publisher-Output-Sha256": v["outputSha256"],
        "X-Publisher-Operation-Count": str(len(ops)),
        "X-Publisher-Proof-Sha256": sha256_bytes(proof_json),
    }
    return Response(content=output, media_type="application/pdf", headers=headers)
