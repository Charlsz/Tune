/** Misma regla que `same_territory` en el backend: la intersección cubre al menos la mitad de la caja menor. */

export type Box = {
  west: number;
  south: number;
  east: number;
  north: number;
};

function area(b: Box): number {
  return Math.max(0, b.east - b.west) * Math.max(0, b.north - b.south);
}

export function sameTerritory(a: Box, b: Box): boolean {
  const width = Math.min(a.east, b.east) - Math.max(a.west, b.west);
  const height = Math.min(a.north, b.north) - Math.max(a.south, b.south);
  if (width <= 0 || height <= 0) return false;
  const shared = width * height;
  const smaller = Math.min(area(a), area(b));
  if (smaller === 0) return true;
  return shared / smaller >= 0.5;
}

/** Caja WGS84 usable como ImageOverlay: finita y con área. */
export function canPlaceOnMap(bounds: Box | null | undefined): bounds is Box {
  if (!bounds) return false;
  const { west, south, east, north } = bounds;
  return (
    [west, south, east, north].every((n) => Number.isFinite(n)) &&
    west < east &&
    south < north
  );
}

export function unionBox(a: Box, b: Box): Box {
  return {
    west: Math.min(a.west, b.west),
    south: Math.min(a.south, b.south),
    east: Math.max(a.east, b.east),
    north: Math.max(a.north, b.north),
  };
}

export function boxToBBox(box: Box): [number, number, number, number] {
  return [box.west, box.south, box.east, box.north];
}

export function boxesClose(
  a: readonly number[],
  b: readonly number[],
  eps = 1e-5,
): boolean {
  if (a.length < 4 || b.length < 4) return false;
  return a.slice(0, 4).every((n, i) => Math.abs(n - b[i]!) < eps);
}

export function preferEarlierFirst<T extends { acquiredAt: string | null }>(
  first: T,
  second: T,
): { before: T; after: T; reordered: boolean } {
  if (first.acquiredAt && second.acquiredAt && first.acquiredAt > second.acquiredAt) {
    return { before: second, after: first, reordered: true };
  }
  return { before: first, after: second, reordered: false };
}
