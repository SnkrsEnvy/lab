# Publisher Studio G6E PDF Engine Bridge Contract

Status: CONTRACT READY / REAL ENGINE ADAPTER UNCONNECTED

## Authority boundary

This file defines the public-browser adapter seam only. It does not define, rename, or infer internal G5I APIs.

The frozen G5I release remains authoritative for native PDF mutation behavior. A future adapter is responsible for translating this browser contract into the actual frozen engine interface.

## Browser contract

Global: `window.PublisherStudioPdfBridge`

Contract version: `publisher-studio-pdf-bridge-g6e-1`

Required adapter methods:

- `capabilities()` -> capability map
- `openSource({ file, context, contract })` -> source token/identifier
- `invoke({ tool, source, payload, contract })` -> bounded mutation/tool result
- `exportPdf({ source, payload, contract })` -> `Blob` or `{ blob, filename }`

Optional adapter method:

- `undo({ source, payload, contract })`

Supported public capability names:

- `redact`
- `ocr`
- `forms`
- `links`
- `undo`
- `exportPdf`

## State law

Without a registered adapter, status is `HOLD`.
Registering an adapter is not enough: the adapter must pass its capability probe.
Opening a local PDF does not grant mutation authority by itself.
Native PDF tools enable only when the current PDF source is connected and that exact capability is reported true.

## Claim ceiling

Contract proof demonstrates that the public UI can route bounded commands through an adapter without silently mutating the frozen source.

It does not prove that G5I is connected, that any native PDF command succeeded in the frozen engine, or that exported bytes are correct until a real adapter and engine proof exist.
