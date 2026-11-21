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

export function preferEarlierFirst<T extends { acquiredAt: string | null }>(
  first: T,
  second: T,
): { before: T; after: T; reordered: boolean } {
  if (first.acquiredAt && second.acquiredAt && first.acquiredAt > second.acquiredAt) {
    return { before: second, after: first, reordered: true };
  }
  return { before: first, after: second, reordered: false };
}
