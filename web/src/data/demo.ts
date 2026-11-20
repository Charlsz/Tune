import type { BBox } from "../domain/aoi";
import { coverageRatio } from "../domain/aoi";
import { weekWindow } from "../domain/dateWindow";
import {
  selectionKey,
  type Cell,
  type DataProvider,
  type Scene,
} from "../domain/lab";
export const extent: BBox = [67.4, 26.5, 68.6, 27.7];
export const size = 48;
export const places = [
  { label: "Sindh, Pakistán", bbox: [67.845, 27.01, 68.055, 27.19] as BBox },
  { label: "Larkana, Pakistán", bbox: [68.1, 27.45, 68.25, 27.58] as BBox },
  { label: "Dadu, Pakistán", bbox: [67.7, 26.65, 67.85, 26.78] as BBox },
];
export function cellBounds(i: number): BBox {
  const x = i % size,
    y = Math.floor(i / size),
    d = 1.2 / size;
  return [
    extent[0] + x * d,
    extent[3] - (y + 1) * d,
    extent[0] + (x + 1) * d,
    extent[3] - y * d,
  ];
}
export function clippedCell(i: number, aoi: BBox): Cell | null {
  const b = cellBounds(i),
    bbox: BBox = [
      Math.max(b[0], aoi[0]),
      Math.max(b[1], aoi[1]),
      Math.min(b[2], aoi[2]),
      Math.min(b[3], aoi[3]),
    ];
  if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) return null;
  const r = 6371.0088,
    rad = Math.PI / 180;
  return {
    bbox,
    areaKm2:
      r *
      r *
      (bbox[2] - bbox[0]) *
      rad *
      (Math.sin(bbox[3] * rad) - Math.sin(bbox[1] * rad)),
  };
}
function fixture(date: string, variant: number): Scene {
  const late = date >= "2022-08-01";
  const water = Array.from({ length: size * size }, (_, i) => {
    const x = i % size,
      y = Math.floor(i / size),
      river = 24 + 5 * Math.sin(y / 8);
    return (
      Math.abs(x - river) < 1.4 ||
      (late &&
        ((x - river > 2 && x - river < 10 + variant && y > 10 && y < 38) ||
          (x < 14 && x > 7 && y > 24 && y < 42)))
    );
  });
  const palette = [
    "#b4b39a",
    "#c5c2a5",
    "#a5ad91",
    "#d0c7ac",
    "#b9bea1",
    "#9fa98b",
  ];
  // Align rows with Leaflet's Web Mercator projection, including cell boundaries.
  const mercator = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const projectY = (lat: number) =>
    ((mercator(extent[3]) - mercator(lat)) /
      (mercator(extent[3]) - mercator(extent[1]))) *
    576;
  const rects = water
    .map((w, i) => {
      const bounds = cellBounds(i),
        y = projectY(bounds[3]),
        height = projectY(bounds[1]) - y;
      return `<rect x="${(i % size) * 12}" y="${y}" width="12" height="${height}" fill="${w ? "#6c9294" : palette[(i * 13 + Math.floor(i / size) * 7) % palette.length]}" stroke="#e1ddc4" stroke-width=".35"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="576" height="576" viewBox="0 0 576 576" preserveAspectRatio="none"><rect width="576" height="576" fill="#c4c5ac"/>${rects}<path d="M0 110L576 350M90 0L180 576" fill="none" stroke="#efe7cb" stroke-width="2"/><g font-family="sans-serif" font-size="9" fill="#454f43"><text x="350" y="130">LARKANA</text><text x="90" y="470">DADU</text></g></svg>`;
  return {
    id: `demo-${date}-${variant}`,
    datetime: `${date}T10:30:00Z`,
    cloud_cover: variant ? 7 : 2,
    bbox: extent,
    thumbnail: null,
    image: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    water,
    demo: true,
  };
}
export const demoProvider: DataProvider = {
  places,
  maskCells: (scene, aoi) =>
    scene.water.flatMap((w, i) => {
      const cell = w ? clippedCell(i, aoi) : null;
      return cell ? [cell] : [];
    }),
  async scenes(aoi, date) {
    if (!date || coverageRatio(aoi, extent) < 0.999) return [];
    // Cualquier semana de 7 días que toque 2022 demo.
    const { start, end } = weekWindow(date);
    if (end < "2022-01-01" || start > "2022-12-31") return [];
    const mid =
      start >= "2022-01-01" && start <= "2022-12-31" ? start : "2022-06-15";
    return [fixture(mid, 0), fixture(mid, 1)];
  },
  async analyze(aoi, before, after, onProgress) {
    onProgress?.({ scene: "before", phase: "prepare" });
    await new Promise((r) => setTimeout(r, 200));
    onProgress?.({ scene: "before", phase: "fetch", loaded: 1, total: 1 });
    await new Promise((r) => setTimeout(r, 200));
    onProgress?.({ scene: "before", phase: "infer" });
    await new Promise((r) => setTimeout(r, 250));
    onProgress?.({ scene: "after", phase: "prepare" });
    await new Promise((r) => setTimeout(r, 200));
    onProgress?.({ scene: "after", phase: "fetch", loaded: 1, total: 1 });
    await new Promise((r) => setTimeout(r, 200));
    onProgress?.({ scene: "after", phase: "infer" });
    await new Promise((r) => setTimeout(r, 250));
    const cells = after.water.flatMap((water, i) => {
      const c = water && !before.water[i] ? clippedCell(i, aoi) : null;
      return c ? [c] : [];
    });
    return {
      id: crypto.randomUUID(),
      key: selectionKey(aoi, before, after),
      before,
      after,
      cells,
      areaKm2: cells.reduce((a, c) => a + c.areaKm2, 0),
      created: new Date().toISOString(),
      aoi: [...aoi],
    };
  },
};
