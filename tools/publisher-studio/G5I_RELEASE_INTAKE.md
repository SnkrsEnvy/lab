# Publisher Studio G5I v015 — Intake Gate

**Gate:** recover the authentic frozen G5I package without reconstructing or mutating it.

Historical delivery identity: `Publisher_Studio_G5I_v015.zip`.

## Why this exists

The public G6E PDF bridge is runtime-proven, but the real frozen G5I engine bytes are not currently present in the active runtime or repositories. The release manifest records 220 payloads and exact hashes, but a manifest is not a substitute for the payload bytes.

This intake gate makes package recovery deterministic.

## Verification levels

The verifier deliberately separates three claims:

1. **Internal manifest consistency** — every payload listed by the candidate package's own manifest exists and matches that manifest.
2. **Critical identity** — identity-critical G5I files match the Walt-controlled critical hash profile.
3. **Authoritative manifest equality** — the candidate manifest is semantically identical to a separately trusted `RELEASE_MANIFEST.json`.

**Overall PASS requires all three.**

If no separately trusted manifest is supplied, a structurally valid package returns:

`HOLD_AUTHORITY_MANIFEST_REQUIRED`

That is intentional. A self-consistent replacement package may not self-authenticate.

## Command

```bash
python tools/publisher-studio/verify_g5i_release.py \
  /path/to/Publisher_Studio_G5I_v015.zip \
  --authority-manifest /path/to/trusted/RELEASE_MANIFEST.json \
  --receipt /tmp/G5I_RELEASE_INTAKE_RECEIPT.json
```

Exit codes:

- `0` = PASS
- `1` = FAIL
- `2` = HOLD because the trusted authority manifest was not supplied

## Frozen boundary

This tool is read-only against the candidate package. It does not:

- unpack over an existing source tree;
- rewrite the manifest;
- infer missing G5I APIs;
- reconstruct absent files;
- promote a candidate;
- connect G6E to the engine.

After PASS, the next gate is **actual G5I API inspection → one adapter → end-to-end PDF mutation proof**.
