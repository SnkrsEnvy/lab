# Golden Goose / CannaCardz Broadcast Gateway v001

Broadcast Gateway turns one issue manifest into a deterministic crawler/share surface while preserving a richer destination reader or GrandCore experience.

## Core contract

`manifest -> compile -> stage -> prove -> promote same tree -> production smoke -> fresh compositor proof -> TruthBank`

The final gate is multiplicative:

`G_final = A × P × T × I × M × K × L × R × D`

Where authority protection, page transport, image transport, image identity, metadata coherence, cache-key freshness, deployment lineage, reader preservation, and device composition must all pass.

## Operator path

1. Copy `manifests/edition-39.json` and change the issue fields.
2. For a local cover, set `cover.mode` to `local` and add `cover.file`; the compiler computes bytes, dimensions and SHA-256.
3. Run `node tools/broadcast-gateway/compile.mjs --manifest <manifest> --out broadcast/<slug>`.
4. Commit only the manifest, intended cover asset, generated share shell, lock and candidate receipt.
5. Stage on a non-production branch.
6. Run `node tools/broadcast-gateway/verify.mjs --url <preview-url> --expected-image-sha <sha>`.
7. Promote the exact proven tree. Re-run verification on the clean production alias and smoke the protected destination separately.
8. Send a fresh versioned URL to the actual compositor. Append PASS/PARTIAL/FAIL to `truthbank/broadcast-preview-truthbank.jsonl`.

## Safety boundary

Never put platform tokens, GitHub tokens, Vercel tokens or private message screenshots in a manifest, receipt or TruthBank record. The browser console is intentionally a compiler/planner, not a credentialed publishing client.
