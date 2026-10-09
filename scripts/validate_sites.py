#!/usr/bin/env python3
"""Validación multi-sitio contra la API local. No asume un territorio único."""

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
YAML_PATH = ROOT / "docs" / "validation" / "sitios.yaml"
OUT_PATH = ROOT / "docs" / "validation" / "sitios-resultados.json"


def _load_yaml(path: Path) -> dict:
    import yaml  # noqa: PLC0415

    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _get(api: str, path: str, params: dict | None = None) -> object:
    url = f"{api.rstrip('/')}{path}"
    if params:
        url = f"{url}?{urlencode(params)}"
    with urlopen(Request(url, method="GET"), timeout=120) as resp:
        return json.loads(resp.read().decode())


def _post(api: str, path: str, fields: dict | None = None) -> object:
    body = urlencode(fields or {}).encode()
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


def _summarize(analysis: dict) -> dict:
    change = analysis.get("change") or {}
    fusion = analysis.get("fusion") or {}
    exposure = analysis.get("exposure") or {}
    return {
        "analysis_id": analysis.get("id"),
        "affected_km2": analysis.get("affected_area_km2"),
        "new_km2": change.get("new_area_km2"),
        "persistent_km2": change.get("persistent_area_km2"),
        "reference_source": change.get("reference_source"),
        "fusion_iou": fusion.get("iou"),
        "fusion_sources": fusion.get("sources"),
        "population_exposed": exposure.get("population_exposed"),
        "latency_s": analysis.get("latency_s"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="http://localhost:8000")
    args = parser.parse_args()
    cfg = _load_yaml(YAML_PATH)
    results: dict = {"sites": [], "controls": {}}

    try:
        _get(args.api, "/health")
    except URLError as exc:
        print(f"API no responde en {args.api}: {exc}", file=sys.stderr)
        return 1

    for site in cfg.get("sites", []):
        entry: dict = {"id": site["id"], "kind": site["kind"], "runs": []}
        if site["kind"] == "example":
            try:
                analysis = _post(args.api, f"/api/examples/{site['example_id']}/analyze")
                entry["runs"].append({"group": "example", **_summarize(analysis)})
                print(f"OK {site['id']} → {analysis['id']}")
            except Exception as exc:  # noqa: BLE001
                entry["runs"].append({"group": "example", "error": str(exc)})
        else:
            center = site["center"]
            side = cfg.get("side_km", 20)
            for group, dates in (site.get("dates") or {}).items():
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
                                "max_cloud": cfg.get("max_cloud", 30),
                                "side_km": side,
                            },
                        )
                    except Exception as exc:  # noqa: BLE001
                        entry["runs"].append(
                            {"group": group, "target_date": center_date, "error": str(exc)}
                        )
                        continue
                    if not scenes:
                        entry["runs"].append(
                            {"group": group, "target_date": center_date, "error": "sin escenas"}
                        )
                        continue
                    scene = scenes[0]
                    try:
                        analysis = _post(
                            args.api,
                            f"/api/catalog/{scene['id']}/analyze",
                            {
                                "task": "flood",
                                "lat": str(center["lat"]),
                                "lon": str(center["lon"]),
                                "side_km": str(side),
                            },
                        )
                    except Exception as exc:  # noqa: BLE001
                        entry["runs"].append(
                            {
                                "group": group,
                                "target_date": center_date,
                                "scene_id": scene["id"],
                                "error": str(exc),
                            }
                        )
                        continue
                    entry["runs"].append(
                        {
                            "group": group,
                            "target_date": center_date,
                            "scene_id": scene["id"],
                            **_summarize(analysis),
                        }
                    )
                    print(f"OK {site['id']} {group} {center_date} → {analysis['id']}")
        results["sites"].append(entry)

    ctrls = cfg.get("controls", {})
    spain = next((s for s in results["sites"] if s["id"] == "spain"), None)
    if spain and spain["runs"] and "new_km2" in spain["runs"][0]:
        r = spain["runs"][0]
        aff = r.get("affected_km2") or 0
        new = r.get("new_km2") or 0
        pers = r.get("persistent_km2") or 0
        results["controls"]["spain_river"] = {
            "persistent_km2": pers,
            "new_km2": new,
            "affected_km2": aff,
            "passed": pers > 0 and new < aff,
        }
    mag = next((s for s in results["sites"] if s["id"] == "magdalena"), None)
    if mag:
        dry = [r for r in mag["runs"] if r.get("group") == "dry" and "new_km2" in r]
        if dry:
            ratios = []
            for r in dry:
                aff = r.get("affected_km2") or 0
                new = r.get("new_km2") or 0
                ratios.append(new / aff if aff else None)
            results["controls"]["river_dry"] = {
                "ratios": ratios,
                "max_allowed": ctrls.get("river_ratio_max", 0.15),
                "passed": all(
                    x is not None and x < ctrls.get("river_ratio_max", 0.15) for x in ratios
                ),
            }

    OUT_PATH.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Escrito {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
