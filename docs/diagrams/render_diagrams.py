"""Regenera los SVG de docs/diagrams a partir del JSON y los incrusta en el HTML.

El estilo sigue el visor existente (rejilla, cajas redondeadas, región punteada).
Los JSON son la fuente: este script solo dibuja.
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent

LEGEND = {
    "frontend": "Frontend",
    "backend": "Backend",
    "database": "Carpeta",
    "external": "Externo",
}


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def svg_header(width: int, height: int, title: str) -> list[str]:
    return [
        f'<svg viewBox="0 0 {width} {height}" role="img" lang="es" '
        'aria-labelledby="archify-diagram-title archify-diagram-description" '
        'data-preset="classic" data-quality-profile="showcase">',
        f'<title id="archify-diagram-title">{esc(title)}</title>',
        '<desc id="archify-diagram-description">Diagrama de Tune alineado con el código actual.</desc>',
        "<defs>",
        '<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">',
        '<polygon points="0 0, 10 3.5, 0 7" class="m-default"/></marker>',
        '<marker id="arrowhead-emphasis" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">',
        '<polygon points="0 0, 10 3.5, 0 7" class="m-emphasis"/></marker>',
        '<marker id="arrowhead-dashed" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">',
        '<polygon points="0 0, 10 3.5, 0 7" class="m-dashed"/></marker>',
        '<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">',
        '<path d="M 40 0 L 0 0 0 40" class="c-grid" stroke-width="0.5"/></pattern>',
        "</defs>",
        '<rect width="100%" height="100%" fill="url(#grid)"/>',
    ]


def sigil(kind: str, x: float, y: float) -> str:
    icons = {
        "external": (
            '<rect x="2.5" y="5" width="8.5" height="8" rx="1.5"/>'
            '<path d="M8 2.5h5.5V8M13.5 2.5 7.5 8.5"/>'
        ),
        "frontend": (
            '<rect x="2" y="3" width="12" height="10" rx="2"/>'
            '<path d="M2 6.5h12"/>'
            '<circle cx="4.1" cy="4.8" r=".7" class="sigil-fill"/>'
            '<circle cx="6.3" cy="4.8" r=".7" class="sigil-fill"/>'
        ),
        "backend": '<path d="M6 3 3 8l3 5M10 3l3 5-3 5"/>',
        "database": (
            '<ellipse cx="8" cy="4" rx="5" ry="2"/>'
            '<path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4M3 8c0 1.1 2.2 2 5 2s5-.9 5-2"/>'
        ),
    }
    body = icons.get(kind, icons["backend"])
    return (
        f'<g aria-hidden="true" class="semantic-sigil s-{kind}" '
        f'transform="translate({x} {y}) scale(0.6875)">{body}</g>'
    )


def node(spec: dict, context: str) -> str:
    x, y = spec["pos"]
    w, h = spec["size"]
    kind = spec["type"]
    label = spec["label"]
    sub = spec.get("sublabel", "")
    cx = x + w / 2
    return f'''<g id="node-{spec["id"]}" data-node-id="{spec["id"]}" data-node-label="{esc(label)}" tabindex="0" role="button" data-node-kind="{kind}" data-node-sublabel="{esc(sub)}" data-node-context="{esc(context)}">
  <title>{esc(label)} · {esc(sub)}</title>
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" class="c-mask"/>
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" class="c-{kind}" stroke-width="1.5"/>
  {sigil(kind, x + 6, y + 6)}
  <text data-node-label="" data-detail-anchor="" x="{cx}" y="{y + 30}" class="t-primary" font-size="11" font-weight="600" text-anchor="middle">{esc(label)}</text>
  <text data-detail="context" x="{cx}" y="{y + 46}" class="t-muted" font-size="8" text-anchor="middle">{esc(sub)}</text>
</g>'''


def edge_path(points: list[list[float]], variant: str, edge_id: str) -> str:
    d = "M " + " L ".join(f"{p[0]} {p[1]}" for p in points)
    if variant == "emphasis":
        cls, marker, text_cls, width = "a-emphasis", "url(#arrowhead-emphasis)", "t-backend", "1.8"
    elif variant == "dashed":
        cls, marker, text_cls, width = "a-dashed", "url(#arrowhead-dashed)", "t-messagebus", "1.4"
    elif variant == "return":
        cls, marker, text_cls, width = "a-default", "url(#arrowhead)", "t-muted", "1.4"
    else:
        cls, marker, text_cls, width = "a-default", "url(#arrowhead)", "t-muted", "1.5"
    dash = ' stroke-dasharray="3,5"' if variant == "return" else ""
    return (
        f'<path data-edge-id="{edge_id}" d="{d}" class="{cls}" stroke-width="{width}"{dash} '
        f'marker-end="{marker}"/>'
    )


def edge_label(points: list[list[float]], label: str, variant: str, edge_id: str) -> str:
    if variant == "emphasis":
        text_cls = "t-backend"
    elif variant == "dashed":
        text_cls = "t-messagebus"
    else:
        text_cls = "t-muted"
    # Etiqueta sobre el tramo horizontal más largo, para que no caiga en el tronco vertical.
    spans = []
    for i in range(len(points) - 1):
        dx = abs(points[i + 1][0] - points[i][0])
        dy = abs(points[i + 1][1] - points[i][1])
        spans.append((dx, dy, i))
    horizontals = [span for span in spans if span[0] >= span[1] and span[0] > 36]
    best = (max(horizontals, key=lambda span: span[0]) if horizontals else max(spans, key=lambda span: span[0] + span[1]))[2]
    x = (points[best][0] + points[best + 1][0]) / 2
    y = (points[best][1] + points[best + 1][1]) / 2
    tw = max(28, len(label) * 5.15)
    return (
        f'<g data-edge-id="{edge_id}" data-edge-label="{esc(label)}">'
        f'<rect x="{x - tw / 2}" y="{y - 16}" width="{tw}" height="14" rx="3" class="c-mask"/>'
        f'<text x="{x}" y="{y - 6}" class="{text_cls}" font-size="8" text-anchor="middle">{esc(label)}</text>'
        f"</g>"
    )


def legend(x: float, y: float, kinds: list[str]) -> str:
    parts = [f'<g data-legend=""><text x="{x}" y="{y}" class="t-primary" font-size="12" font-weight="650">Leyenda</text>']
    cursor = x
    for kind in kinds:
        label = LEGEND[kind]
        parts.append(
            f'<g data-legend-kind="{kind}">'
            f'<rect x="{cursor}" y="{y + 10}" width="16" height="10" rx="2.5" class="c-{kind}" stroke-width="1"/>'
            f'<text x="{cursor + 22}" y="{y + 19}" class="t-muted" font-size="10">{esc(label)}</text></g>'
        )
        cursor += 22 + len(label) * 6.2 + 18
    parts.append("</g>")
    return "".join(parts)


def render_architecture(spec: dict) -> str:
    width, height = spec["meta"]["viewBox"]
    title = spec["meta"]["title"]
    parts = svg_header(width, height, title)
    for boundary in spec.get("boundaries", []):
        x, y, w, h = boundary["rect"]
        parts.append(
            f'<rect data-graph-role="structural-frame" data-composition-frame-label="{esc(boundary["label"])}" '
            f'x="{x}" y="{y}" width="{w}" height="{h}" rx="12" class="c-region" stroke-width="1"/>'
        )
    for conn in spec["connections"]:
        parts.append(edge_path(conn["points"], conn.get("variant", "default"), conn["id"]))
    context = spec["boundaries"][0]["label"] if spec.get("boundaries") else "Arquitectura"
    inside = set(spec["boundaries"][0].get("wraps", [])) if spec.get("boundaries") else set()
    for comp in spec["components"]:
        parts.append(node(comp, context if comp["id"] in inside else "Arquitectura"))
    for boundary in spec.get("boundaries", []):
        x, y, _, _ = boundary["rect"]
        label = boundary["label"]
        parts.append(
            f'<g data-graph-role="structural-frame-label"><rect x="{x + 8}" y="{y + 8}" width="{len(label) * 6.2 + 16}" height="16" rx="3" class="c-mask"/>'
            f'<text x="{x + 14}" y="{y + 20}" class="t-cloud" font-size="9" font-weight="600">{esc(label)}</text></g>'
        )
    for conn in spec["connections"]:
        parts.append(edge_label(conn["points"], conn["label"], conn.get("variant", "default"), conn["id"]))
    kinds = []
    for comp in spec["components"]:
        if comp["type"] not in kinds:
            kinds.append(comp["type"])
    parts.append(legend(24, height - 48, kinds))
    parts.append("</svg>")
    return "\n".join(parts)


def render_sequence(spec: dict) -> str:
    participants = spec["participants"]
    box_w = spec["meta"].get("box_w", 132)
    gap = spec["meta"].get("gap", 18)
    margin = 28
    width = margin * 2 + len(participants) * box_w + (len(participants) - 1) * gap
    centers = {}
    boxes = {}
    x = margin
    for p in participants:
        boxes[p["id"]] = x
        centers[p["id"]] = x + box_w / 2
        x += box_w + gap

    y = 132
    laid = []
    segments = []
    for seg in spec["segments"]:
        msgs = [m for m in spec["messages"] if m["segment"] == seg["id"]]
        top = y - 40
        for msg in msgs:
            laid.append({**msg, "y": y})
            y += 32
        segments.append({**seg, "top": top, "bottom": y - 16})
        y += 30
    note_y = y + 8
    notes = spec.get("notes", [])
    height = note_y + 18 * len(notes) + 56
    title = spec["meta"]["title"]
    parts = svg_header(width, int(height), title)

    for seg in segments:
        parts.append(
            f'<rect data-graph-role="structural-frame" x="{margin - 8}" y="{seg["top"]}" '
            f'width="{width - 2 * margin + 16}" height="{seg["bottom"] - seg["top"]}" rx="10" class="c-lane" stroke-width="1"/>'
        )
        label_x = margin + box_w / 2 + 18
        parts.append(
            f'<g><rect x="{label_x}" y="{seg["top"] + 6}" width="{len(seg["label"]) * 6.1 + 12}" height="16" rx="3" class="c-mask"/>'
            f'<text x="{label_x + 6}" y="{seg["top"] + 17}" class="t-dim" font-size="9" font-weight="600">{esc(seg["label"])}</text></g>'
        )

    life_top = 108
    life_bottom = segments[-1]["bottom"] + 8
    for pid, cx in centers.items():
        parts.append(
            f'<path d="M {cx} {life_top} L {cx} {life_bottom}" class="a-default" stroke-width="0.8" stroke-dasharray="3,7"/>'
        )

    def span(pid: str) -> tuple[float, float] | None:
        ys = [m["y"] for m in laid if m["from"] == pid or m["to"] == pid]
        if not ys:
            return None
        return min(ys) - 8, max(ys) + 16

    for p in participants:
        found = span(p["id"])
        if not found:
            continue
        y0, y1 = found
        cx = centers[p["id"]]
        kind = p["type"]
        parts.append(
            f'<rect x="{cx - 5}" y="{y0}" width="10" height="{y1 - y0}" rx="3" class="c-mask"/>'
            f'<rect x="{cx - 5}" y="{y0}" width="10" height="{y1 - y0}" rx="3" class="c-{kind}" stroke-width="1"/>'
        )

    for msg in laid:
        x0 = centers[msg["from"]]
        x1 = centers[msg["to"]]
        direction = 1 if x1 >= x0 else -1
        start = x0 + direction * 8
        end = x1 - direction * 8
        variant = msg.get("variant", "default")
        parts.append(edge_path([[start, msg["y"]], [end, msg["y"]]], variant, msg["id"]))
        parts.append(edge_label([[start, msg["y"]], [end, msg["y"]]], msg["label"], variant, msg["id"]))

    head_y = 28
    for p in participants:
        px = boxes[p["id"]]
        kind = p["type"]
        parts.append(
            f'''<g id="node-{p["id"]}" data-node-id="{p["id"]}" data-node-label="{esc(p["label"])}" data-node-kind="{kind}" data-node-sublabel="{esc(p.get("sublabel", ""))}" data-node-context="Participante">
  <rect x="{px}" y="{head_y}" width="{box_w}" height="58" rx="6" class="c-mask"/>
  <rect x="{px}" y="{head_y}" width="{box_w}" height="58" rx="6" class="c-{kind}" stroke-width="1.5"/>
  {sigil(kind, px + 6, head_y + 6)}
  <text x="{px + box_w / 2}" y="{head_y + 28}" class="t-primary" font-size="11" font-weight="600" text-anchor="middle">{esc(p["label"])}</text>
  <text x="{px + box_w / 2}" y="{head_y + 44}" class="t-muted" font-size="7.5" text-anchor="middle">{esc(p.get("sublabel", ""))}</text>
</g>'''
        )

    for i, note in enumerate(notes):
        parts.append(
            f'<text x="{margin}" y="{note_y + i * 16}" class="t-muted" font-size="10">{esc(note)}</text>'
        )
    kinds = []
    for p in participants:
        if p["type"] not in kinds:
            kinds.append(p["type"])
    parts.append(legend(margin, height - 36, kinds))
    parts.append("</svg>")
    return "\n".join(parts)


def cards_html(cards: list[dict]) -> str:
    chunks = ['    <div class="cards">']
    for card in cards:
        chunks.append('      <div class="card">')
        chunks.append('        <div class="card-header">')
        chunks.append(f'          <div class="card-dot {card["dot"]}"></div>')
        chunks.append(f'          <h3>{esc(card["title"])}</h3>')
        chunks.append("        </div>")
        chunks.append("        <ul>")
        for item in card["items"]:
            chunks.append(f"          <li>&bull; {esc(item)}</li>")
        chunks.append("        </ul>")
        chunks.append("      </div>")
    chunks.append("    </div>")
    return "\n".join(chunks)


def patch_html(path: Path, title: str, svg: str, cards: str, guided: list | None) -> None:
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"<title>.*?</title>", f"<title>{esc(title)} Diagram</title>", text, count=1, flags=re.S)
    text = re.sub(r"<h1>.*?</h1>", f"<h1>{esc(title)}</h1>", text, count=1, flags=re.S)
    text, n = re.subn(r"<svg\b.*?</svg>", svg, text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f"No se encontró el SVG en {path.name}")
    text, n = re.subn(
        r'<div class="cards">.*?</div>\s*</div>\s*<script>',
        cards + "\n\n  </div>\n\n  <script>",
        text,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise SystemExit(f"No se encontraron las tarjetas en {path.name}")
    if guided is not None:
        payload = json.dumps(guided, ensure_ascii=False)
        text, n = re.subn(
            r'<script id="archify-guided-views-data" type="application/json">.*?</script>',
            f'<script id="archify-guided-views-data" type="application/json">{payload}</script>',
            text,
            count=1,
            flags=re.S,
        )
        if n != 1:
            raise SystemExit(f"No se encontraron las vistas guiadas en {path.name}")
    path.write_text(text, encoding="utf-8")


def main() -> None:
    arch = json.loads((ROOT / "tune-arquitectura.architecture.json").read_text(encoding="utf-8"))
    analisis = json.loads((ROOT / "tune-analisis.sequence.json").read_text(encoding="utf-8"))
    rechazo = json.loads((ROOT / "tune-rechazo.sequence.json").read_text(encoding="utf-8"))

    jobs = [
        ("tune-arquitectura.html", arch, render_architecture(arch), arch["meta"].get("views")),
        ("tune-analisis.html", analisis, render_sequence(analisis), None),
        ("tune-rechazo.html", rechazo, render_sequence(rechazo), None),
    ]
    for filename, spec, svg, guided in jobs:
        patch_html(ROOT / filename, spec["meta"]["title"], svg, cards_html(spec["cards"]), guided)
        print(f"actualizado {filename}")


if __name__ == "__main__":
    main()
