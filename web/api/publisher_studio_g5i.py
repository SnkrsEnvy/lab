from __future__ import annotations

import hashlib
import io
import json
import uuid
from typing import Any

import fitz
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import Image, ImageChops, ImageDraw

APP_VERSION = "0.35.0-g5i"
ACTIVE_GATE = "G5I Distributed Page Delta Lifecycle + Conflict-Safe Undo"
TRANSPORT = "g6h-stateless-same-origin-v001"
MAX_PDF_BYTES = 3_500_000
RENDER_SCALE = 2.0
OUTSIDE_TOLERANCE = 0.00005

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
        if src_doc.page_count != out_doc.page_count:
            return {"pass": False, "reason": "Page count changed without a sequence operation", "pageCountEqual": False}
        src_rects = [fitz.Rect(p.rect) for p in src_doc]
        page_count = src_doc.page_count
    finally:
        src_doc.close(); out_doc.close()

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
            if op_type == "redact":
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
        "claim": "Stateless public transport executes the frozen G5I redaction/link mutation rules and frozen render/structural proof thresholds in one invocation. No server-side document persistence is implied.",
    }


@app.get("/")
@app.get("/api/publisher_studio_g5i")
@app.get("/api/publisher-studio-g5i")
def capabilities() -> JSONResponse:
    return JSONResponse({
        "version": APP_VERSION,
        "gate": ACTIVE_GATE,
        "transport": TRANSPORT,
        "stateless": True,
        "maxPdfBytes": MAX_PDF_BYTES,
        "capabilities": {"redact": True, "links": False, "undo": True, "exportPdf": True, "ocr": False, "forms": False},
        "editing": ["true redaction", "staged client-side undo", "bounded export proof"],
        "frozen": ["client source bytes", "source hash", "untouched regions"],
        "limitOfClaim": "This transport checkpoint does not provide durable server workspaces, OCR transport, forms transport, distributed collaboration, or independent Poppler witness proof.",
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
