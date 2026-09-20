#!/usr/bin/env python3
"""Fail-closed intake verifier for the frozen Publisher Studio G5I v015 release.

This verifier NEVER modifies the candidate package. It separates:
1) package-internal manifest consistency,
2) critical-file identity anchored by a Walt-controlled profile, and
3) full equality to a separately supplied authoritative RELEASE_MANIFEST.json.

Overall PASS requires all three. Without an external authority manifest the result is HOLD,
not PASS, even when every internal file matches the candidate package's own manifest.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

DEFAULT_PROFILE = Path(__file__).with_name("G5I_AUTHORITY_PROFILE_v001.json")
MANIFEST_NAME = "RELEASE_MANIFEST.json"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def safe_relpath(raw: str) -> str:
    if not isinstance(raw, str) or not raw:
        raise ValueError("empty or non-string manifest path")
    if "\\" in raw:
        raise ValueError(f"backslash path is not allowed: {raw!r}")
    p = PurePosixPath(raw)
    if p.is_absolute() or any(part in ("", ".", "..") for part in p.parts):
        raise ValueError(f"unsafe manifest path: {raw!r}")
    return p.as_posix()


def manifest_projection(m: dict[str, Any]) -> dict[str, Any]:
    files = []
    for item in m.get("files", []):
        files.append({
            "path": safe_relpath(item["path"]),
            "bytes": int(item["bytes"]),
            "sha256": str(item["sha256"]).lower(),
        })
    files.sort(key=lambda x: x["path"])
    return {
        "product": m.get("product"),
        "suite": m.get("suite"),
        "version": m.get("version"),
        "gate": m.get("gate"),
        "format": m.get("format"),
        "payloadCount": int(m.get("payloadCount", -1)),
        "exclusions": list(m.get("exclusions", [])),
        "files": files,
    }


class PackageReader:
    def __init__(self, source: Path):
        self.source = source
        self.kind = "zip" if source.is_file() else "directory"
        self.zf: zipfile.ZipFile | None = None
        self.root = ""
        self.manifest_location = ""

        if self.kind == "zip":
            if not zipfile.is_zipfile(source):
                raise ValueError(f"source is not a valid ZIP: {source}")
            self.zf = zipfile.ZipFile(source, "r")
            names = [n for n in self.zf.namelist() if not n.endswith("/")]
            candidates = [
                n for n in names
                if PurePosixPath(n).name == MANIFEST_NAME
                and "__MACOSX" not in PurePosixPath(n).parts
            ]
            if len(candidates) != 1:
                raise ValueError(f"expected exactly one {MANIFEST_NAME} in ZIP, found {len(candidates)}")
            self.manifest_location = candidates[0]
            parent = PurePosixPath(candidates[0]).parent
            self.root = "" if str(parent) == "." else parent.as_posix().rstrip("/") + "/"
        else:
            if not source.is_dir():
                raise ValueError(f"source does not exist: {source}")
            candidates = [
                p for p in source.rglob(MANIFEST_NAME)
                if "__MACOSX" not in p.parts
            ]
            if len(candidates) != 1:
                raise ValueError(f"expected exactly one {MANIFEST_NAME} in directory, found {len(candidates)}")
            self.manifest_path = candidates[0]
            self.manifest_location = str(candidates[0].relative_to(source))
            self.root_path = candidates[0].parent

    def close(self) -> None:
        if self.zf is not None:
            self.zf.close()

    def read_manifest(self) -> bytes:
        if self.kind == "zip":
            assert self.zf is not None
            return self.zf.read(self.manifest_location)
        return self.manifest_path.read_bytes()

    def read(self, rel: str) -> bytes:
        rel = safe_relpath(rel)
        if self.kind == "zip":
            assert self.zf is not None
            name = self.root + rel
            try:
                return self.zf.read(name)
            except KeyError as e:
                raise FileNotFoundError(rel) from e
        p = (self.root_path / Path(*PurePosixPath(rel).parts)).resolve()
        root = self.root_path.resolve()
        if root not in p.parents and p != root:
            raise ValueError(f"path escaped package root: {rel}")
        return p.read_bytes()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source", help="Path to Publisher_Studio_G5I_v015.zip or extracted release directory")
    ap.add_argument("--profile", default=str(DEFAULT_PROFILE), help="Critical authority profile JSON")
    ap.add_argument("--authority-manifest", help="Separately trusted RELEASE_MANIFEST.json. Required for PASS.")
    ap.add_argument("--receipt", default="G5I_RELEASE_INTAKE_RECEIPT.json")
    args = ap.parse_args()

    source = Path(args.source).expanduser().resolve()
    profile_path = Path(args.profile).expanduser().resolve()
    authority_path = Path(args.authority_manifest).expanduser().resolve() if args.authority_manifest else None

    receipt: dict[str, Any] = {
        "verifier": "publisher-studio-g5i-intake-v001",
        "source": str(source),
        "profile": str(profile_path),
        "authorityManifest": str(authority_path) if authority_path else None,
        "status": "FAIL",
        "checks": {},
        "counts": {},
        "mismatches": [],
        "critical": {},
    }

    reader: PackageReader | None = None
    try:
        profile = load_json(profile_path)
        reader = PackageReader(source)
        candidate_raw = reader.read_manifest()
        candidate = json.loads(candidate_raw.decode("utf-8"))

        receipt["sourceKind"] = reader.kind
        receipt["manifestLocation"] = reader.manifest_location
        receipt["sourceSha256"] = sha256_file(source) if source.is_file() else None
        receipt["candidateManifestSha256"] = sha256_bytes(candidate_raw)

        metadata_keys = ("product", "suite", "version", "gate", "format", "payloadCount")
        metadata_ok = True
        for key in metadata_keys:
            expected = profile.get(key)
            actual = candidate.get(key)
            ok = actual == expected
            receipt["checks"][f"metadata.{key}"] = ok
            if not ok:
                metadata_ok = False
                receipt["mismatches"].append({"kind": "metadata", "field": key, "expected": expected, "actual": actual})

        files = candidate.get("files")
        if not isinstance(files, list):
            raise ValueError("manifest files must be a list")

        manifest_count = int(candidate.get("payloadCount", -1))
        list_count = len(files)
        receipt["counts"]["manifestPayloadCount"] = manifest_count
        receipt["counts"]["fileEntries"] = list_count
        receipt["checks"]["payload_count_matches_file_list"] = manifest_count == list_count
        receipt["checks"]["payload_count_matches_profile"] = list_count == int(profile["payloadCount"])

        seen: set[str] = set()
        internal_ok = True
        verified = 0
        missing = 0
        hash_mismatch = 0
        size_mismatch = 0

        for item in files:
            rel = safe_relpath(item["path"])
            if rel in seen:
                internal_ok = False
                receipt["mismatches"].append({"kind": "duplicate_path", "path": rel})
                continue
            seen.add(rel)
            expected_size = int(item["bytes"])
            expected_hash = str(item["sha256"]).lower()
            try:
                data = reader.read(rel)
            except FileNotFoundError:
                internal_ok = False
                missing += 1
                receipt["mismatches"].append({"kind": "missing_file", "path": rel})
                continue
            actual_size = len(data)
            actual_hash = sha256_bytes(data)
            if actual_size != expected_size:
                internal_ok = False
                size_mismatch += 1
                receipt["mismatches"].append({
                    "kind": "size_mismatch", "path": rel,
                    "expected": expected_size, "actual": actual_size,
                })
            if actual_hash != expected_hash:
                internal_ok = False
                hash_mismatch += 1
                receipt["mismatches"].append({
                    "kind": "sha256_mismatch", "path": rel,
                    "expected": expected_hash, "actual": actual_hash,
                })
            if actual_size == expected_size and actual_hash == expected_hash:
                verified += 1

        receipt["counts"].update({
            "verifiedPayloads": verified,
            "missingPayloads": missing,
            "hashMismatches": hash_mismatch,
            "sizeMismatches": size_mismatch,
        })
        receipt["checks"]["internal_manifest_consistency"] = (
            internal_ok
            and manifest_count == list_count
            and list_count == int(profile["payloadCount"])
        )

        critical_ok = True
        for rel, expected in profile.get("criticalFiles", {}).items():
            try:
                data = reader.read(rel)
                actual = {"bytes": len(data), "sha256": sha256_bytes(data)}
                ok = actual["bytes"] == int(expected["bytes"]) and actual["sha256"] == str(expected["sha256"]).lower()
            except Exception as e:
                actual = {"error": str(e)}
                ok = False
            receipt["critical"][rel] = {"ok": ok, "expected": expected, "actual": actual}
            if not ok:
                critical_ok = False
                receipt["mismatches"].append({"kind": "critical_identity_mismatch", "path": rel})
        receipt["checks"]["critical_identity"] = critical_ok

        authority_ok = False
        if authority_path:
            authority = load_json(authority_path)
            authority_ok = manifest_projection(candidate) == manifest_projection(authority)
            receipt["checks"]["authoritative_manifest_equality"] = authority_ok
            receipt["authorityManifestSha256"] = sha256_file(authority_path)
            if not authority_ok:
                receipt["mismatches"].append({"kind": "authority_manifest_mismatch"})
        else:
            receipt["checks"]["authoritative_manifest_equality"] = False

        base_ok = (
            metadata_ok
            and receipt["checks"]["payload_count_matches_file_list"]
            and receipt["checks"]["payload_count_matches_profile"]
            and receipt["checks"]["internal_manifest_consistency"]
            and critical_ok
        )

        if not base_ok:
            receipt["status"] = "FAIL"
            exit_code = 1
        elif not authority_path:
            receipt["status"] = "HOLD_AUTHORITY_MANIFEST_REQUIRED"
            exit_code = 2
        elif not authority_ok:
            receipt["status"] = "FAIL"
            exit_code = 1
        else:
            receipt["status"] = "PASS"
            exit_code = 0

    except Exception as e:
        receipt["status"] = "FAIL"
        receipt["fatalError"] = f"{type(e).__name__}: {e}"
        exit_code = 1
    finally:
        if reader is not None:
            reader.close()
        Path(args.receipt).write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    print(json.dumps(receipt, indent=2, sort_keys=True))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
