#!/usr/bin/env python3
"""Corrida del piloto La Mojana contra la API local.

Busca escenas Sentinel-2 alrededor del bbox del YAML, analiza las más
limpias por ventana de fechas y escribe un JSON de resultados. No toca
red directa: todo pasa por /api/catalog y /api/examples.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
YAML_PATH = ROOT / "docs" / "validation" / "piloto.yaml"
OUT_PATH = ROOT / "docs" / "validation" / "piloto-resultados.json"


def _load_yaml(path: Path) -> dict:
    try:
        import yaml  # noqa: PLC0415
    except ImportError as exc:
        raise SystemExit("PyYAML requerido (dependencia del paquete tune).") from exc
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _get(api: str, path: str, params: dict | None = None) -> object:
    url = f"{api.rstrip('/')}{path}"
    if params:
        url = f"{url}?{urlencode(params)}"
    with urlopen(Request(url, method="GET"), timeout=120) as resp:
        return json.loads(resp.read().decode())


def _post_form(api: str, path: str, fields: dict) -> object:
    from urllib.parse import urlencode as enc

    body = enc(fields).encode()
    req = Request(
        f"{api.rstrip('/')}{path}",
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urlopen(req, timeout=600) as resp:
        return json.loads(resp.read().decode())


def _window(center: str, days: int = 10) -> tuple[str, str]:
    d = date.fromisoformat(center)
    return (d - timedelta(days=days)).isoformat(), (d + timedelta(days=days)).isoformat()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--skip-spain", action="store_true")
    args = parser.parse_args()

    cfg = _load_yaml(YAML_PATH)
    center = cfg["site"]["center"]
    side_km = cfg["site"]["side_km"]
    max_cloud = cfg.get("max_cloud", 30)
    results: dict = {"site": cfg["site"]["name"], "analyses": [], "spain": None, "controls": {}}

    try:
        _get(args.api, "/health")
    except URLError as exc:
        print(f"API no responde en {args.api}: {exc}", file=sys.stderr)
        return 1

    for group, dates in cfg["dates"].items():
        for center_date in dates:
            start, end = _window(center_date)
            try:
                scenes = _get(
                    args.api,
                    "/api/catalog/search",
                    {
                        "lat": center["lat"],
                        "lon": center["lon"],
                        "start": start,
                        "end": end,
                        "max_cloud": max_cloud,
                        "side_km": side_km,
                    },
                )
            except Exception as exc:  # noqa: BLE001
                results["analyses"].append(
                    {"group": group, "target_date": center_date, "error": str(exc)}
                )
                continue
            if not scenes:
                results["analyses"].append(
                    {
                        "group": group,
                        "target_date": center_date,
                        "error": "sin escenas",
                    }
                )
                continue
            scene = scenes[0]
            try:
                analysis = _post_form(
                    args.api,
                    f"/api/catalog/{scene['id']}/analyze",
                    {
                        "task": "flood",
                        "lat": str(center["lat"]),
                        "lon": str(center["lon"]),
                        "side_km": str(side_km),
                    },
                )
            except Exception as exc:  # noqa: BLE001
                results["analyses"].append(
                    {
                        "group": group,
                        "target_date": center_date,
                        "scene_id": scene["id"],
                        "error": str(exc),
                    }
                )
                continue
            change = analysis.get("change") or {}
            results["analyses"].append(
                {
                    "group": group,
                    "target_date": center_date,
                    "scene_id": scene["id"],
                    "analysis_id": analysis["id"],
                    "affected_km2": analysis.get("affected_area_km2"),
                    "new_km2": change.get("new_area_km2"),
                    "persistent_km2": change.get("persistent_area_km2"),
                    "receded_km2": change.get("receded_area_km2"),
                    "reference_source": change.get("reference_source"),
                    "latency_s": analysis.get("latency_s"),
                }
            )
            print(f"OK {group} {center_date} → {analysis['id']}")

    if not args.skip_spain:
        try:
            from urllib.request import urlopen as open_url

            req = Request(
                f"{args.api.rstrip('/')}/api/examples/spain/analyze",
                method="POST",
                data=b"",
            )
            with open_url(req, timeout=600) as resp:
                spain = json.loads(resp.read().decode())
            ch = spain.get("change") or {}
            results["spain"] = {
                "analysis_id": spain["id"],
                "affected_km2": spain.get("affected_area_km2"),
                "new_km2": ch.get("new_area_km2"),
                "persistent_km2": ch.get("persistent_area_km2"),
                "reference_source": ch.get("reference_source"),
            }
            print(f"OK spain → {spain['id']}")
        except Exception as exc:  # noqa: BLE001
            results["spain"] = {"error": str(exc)}

    # Controles automáticos cuando hay números
    dry = [a for a in results["analyses"] if a.get("group") == "dry" and "new_km2" in a]
    peak = [a for a in results["analyses"] if a.get("group") == "peak" and "new_km2" in a]
    ctrls = cfg.get("controls", {})
    if dry:
        ratios = []
        for a in dry:
            aff = a.get("affected_km2") or 0
            new = a.get("new_km2") or 0
            ratios.append(new / aff if aff else None)
        results["controls"]["river_dry"] = {
            "ratios": ratios,
            "max_allowed": ctrls.get("river_ratio_max", 0.15),
            "passed": all(r is not None and r < ctrls.get("river_ratio_max", 0.15) for r in ratios),
        }
    if dry and peak:
        dry_new = [a["new_km2"] for a in dry if a.get("new_km2") is not None]
        peak_new = [a["new_km2"] for a in peak if a.get("new_km2") is not None]
        if dry_new and peak_new:
            factor = (sum(peak_new) / len(peak_new)) / max(sum(dry_new) / len(dry_new), 1e-6)
            results["controls"]["peak_vs_dry"] = {
                "factor": factor,
                "min_required": ctrls.get("peak_vs_dry_min_factor", 3.0),
                "passed": factor >= ctrls.get("peak_vs_dry_min_factor", 3.0),
            }
    if results.get("spain") and "new_km2" in (results["spain"] or {}):
        s = results["spain"]
        aff = s.get("affected_km2") or 0
        new = s.get("new_km2") or 0
        pers = s.get("persistent_km2") or 0
        results["controls"]["spain_river"] = {
            "persistent_km2": pers,
            "new_km2": new,
            "affected_km2": aff,
            "passed": pers > 0 and new < aff,
        }

    OUT_PATH.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Escrito {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
