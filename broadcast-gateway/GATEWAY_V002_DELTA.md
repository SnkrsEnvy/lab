# Broadcast Gateway v001 -> v002 bounded delta

## Current proven state

Broadcast Gateway v001 is a frozen compositor-PASS baseline. Edition 39 remains protected. The current repository has also added publication ingest tooling and a second same-project static-cover broadcast pattern through CannaCardz #163.

## Why v002 exists

v001 proves the architecture. v002 hardens the proof contract and source authority without reopening the winner.

## Bounded changes

1. Add a source-authority register so package, source, deployment, public alias, media and protected-reader identities cannot silently drift.
2. Add a v2 issue manifest schema while leaving v1 intact.
3. Add a v2 compiler that emits a deterministic build marker, exact media receipt, semantic metadata and a stricter locked manifest.
4. Add a v2 verifier that independently proves page transport, image transport, exact artifact identity, metadata coherence, cache/version identity and protected-destination handoff.
5. Keep deployment lineage as a separate release proof supplied by GitHub/Vercel evidence; the verifier must not fabricate lineage from page content.
6. Preserve device/compositor proof as the final external gate.
7. Preserve perceptual/desktop proof as separate from binary image identity after the CannaCardz #163 corrupted-image incident.

## Explicit non-changes

- Do not mutate Edition 39 v16R1 media.
- Do not rebuild the Edition 39 protected reader.
- Do not replace or rewrite v1 compiler/verifier/schema.
- Do not alter unrelated lab routes.
- Do not claim compositor PASS from server proof.

## v2 server gate

`G_server = A * P * T * I * M * K * R`

Deployment lineage `L` is proved separately from source-control and deployment metadata.
Final release remains:

`G_final = A * P * T * I * M * K * L * R * D`

## Acceptance

The v2 candidate is admissible for staging only when:

- local compile succeeds;
- local verifier returns A=P=T=I=M=K=R=1;
- one intentional mismatch test fails closed;
- v1 files remain unchanged;
- the candidate branch is based on the current main production lineage.
