/** Rutas de tabs MapApp + docs + GeoTIFF. */

export const paths = {
  map: "/mapa",
  results: "/resultados",
  history: "/historial",
  geotiff: "/geotiff",
  docs: "/docs",
} as const;

/** Tabs del panel (sin docs). */
export type AppPage = "map" | "results" | "history";

export function pageFromPath(pathname: string): AppPage {
  if (pathname === paths.results || pathname.startsWith(`${paths.results}/`)) {
    return "results";
  }
  if (pathname === paths.history || pathname.startsWith(`${paths.history}/`)) {
    return "history";
  }
  return "map";
}

export function pathForPage(page: AppPage): string {
  return paths[page];
}
