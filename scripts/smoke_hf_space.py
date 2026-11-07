#!/usr/bin/env python3
"""Smoke E2E contra un Space (o API local) de Tune.

Comprueba health, SPA, tasks, listado de análisis y un artefacto PNG.
Opcionalmente lanza un analyze de ejemplo (lento en CPU).
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from typing import Any


def _get(url: str, timeout: float = 60) -> tuple[int, bytes, dict[str, str]]:
    req = urllib.request.Request(url, headers={"User-Agent": "tune-smoke/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        headers = {k.lower(): v for k, v in resp.headers.items()}
        return resp.status, resp.read(), headers


def _must_ok(label: str, status: int, body: bytes) -> None:
    if status != 200:
        raise SystemExit(f"FAIL {label}: status={status} body={body[:300]!r}")
    print(f"OK {label}")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--base-url", required=True, help="p.ej. https://charlsz-tune.hf.space")
    p.add_argument("--analyze", action="store_true", help="POST analyze de un ejemplo (lento)")
    p.add_argument("--timeout", type=float, default=120)
    args = p.parse_args()
    base = args.base_url.rstrip("/")

    status, body, _ = _get(f"{base}/health", timeout=args.timeout)
    _must_ok("GET /health", status, body)
    health = json.loads(body)
    assert health.get("status") == "ok", health

    status, body, headers = _get(f"{base}/", timeout=args.timeout)
    _must_ok("GET / (SPA)", status, body)
    text = body.decode("utf-8", errors="replace")
    if "<html" not in text.lower() and "<!doctype" not in text.lower():
        raise SystemExit(f"FAIL SPA: no parece HTML ({text[:120]!r})")
    ctype = headers.get("content-type", "")
    if "text/html" not in ctype and "html" not in ctype:
        print(f"WARN content-type SPA: {ctype}")

    status, body, _ = _get(f"{base}/api/tasks", timeout=args.timeout)
    _must_ok("GET /api/tasks", status, body)
    tasks = json.loads(body)
    assert isinstance(tasks, list) and tasks, tasks

    status, body, _ = _get(f"{base}/api/analyses", timeout=args.timeout)
    _must_ok("GET /api/analyses", status, body)
    analyses: list[dict[str, Any]] = json.loads(body)
    if not analyses:
        raise SystemExit("FAIL: no hay análisis sembrados")
    aid = analyses[0]["id"]
    print(f"OK seeded analyses={len(analyses)} first={aid}")

    status, body, headers = _get(f"{base}/api/analyses/{aid}/preview_png", timeout=args.timeout)
    _must_ok(f"GET preview_png {aid}", status, body)
    if body[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit("FAIL preview: no es PNG")

    if args.analyze:
        # Usa el endpoint de examples si existe; si no, salta.
        try:
            status, body, _ = _get(f"{base}/api/examples", timeout=args.timeout)
        except urllib.error.HTTPError as exc:
            print(f"SKIP analyze: /api/examples → {exc.code}")
            return 0
        examples = json.loads(body)
        if not examples:
            print("SKIP analyze: sin examples")
            return 0
        eid = examples[0]["id"]
        print(f"POST analyze example={eid} (puede tardar varios minutos en CPU)…")
        req = urllib.request.Request(
            f"{base}/api/examples/{eid}/analyze?stream=false",
            method="POST",
            headers={"User-Agent": "tune-smoke/1.0"},
        )
        with urllib.request.urlopen(req, timeout=max(args.timeout, 900)) as resp:
            out = resp.read()
            print(f"OK analyze status={resp.status} bytes={len(out)}")

    print("SMOKE PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.URLError as exc:
        print(f"FAIL network: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
