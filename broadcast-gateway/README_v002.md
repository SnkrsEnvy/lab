# Golden Goose / CannaCardz Broadcast Gateway v002

v002 hardens the proven v001 broadcast architecture without superseding or mutating the frozen v001 winner.

## Contract

`authority -> manifest -> compile -> local proof -> stage -> remote proof -> lineage proof -> promote same artifact -> production smoke -> compositor -> TruthBank`

Server proof:

`G_server = A * P * T * I * M * K * R`

Final proof:

`G_final = A * P * T * I * M * K * L * R * D`

## Files

- `SOURCE_AUTHORITY_REGISTER_v001.json` - current source/runtime/provenance authority.
- `schema/issue-manifest-v2.schema.json` - v2 manifest contract.
- `../tools/broadcast-gateway/compile-v2.mjs` - deterministic compiler.
- `../tools/broadcast-gateway/verify-v2.mjs` - strict server/media/reader verifier.
- `manifests/edition-39-v2-regression.json` - known-answer regression manifest.

## Important truth boundaries

- Exact image hash/bytes/dimensions/MIME prove binary identity, not beauty or perceptual integrity.
- Deployment READY proves platform state, not final preview composition.
- Browser rendering proves browser behavior, not iMessage or another compositor.
- v001 remains the frozen rollback winner until v002 completes all required downstream gates.
