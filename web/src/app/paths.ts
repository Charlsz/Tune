/** Rutas de tabs MapApp. */

export const paths = {
  map: "/mapa",
  results: "/resultados",
  history: "/historial",
} as const;

export type AppPage = keyof typeof paths;

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
