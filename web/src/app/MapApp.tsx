import { Navigate, useLocation } from "react-router";
import type { DataProvider } from "../domain/lab";
import AppHeader from "../components/layout/AppHeader";
import MapChrome from "../components/map/MapChrome";
import PlaceSearch from "../components/search/PlaceSearch";
import ResultsPanel from "../components/results/ResultsPanel";
import SessionHistory from "../components/history/SessionHistory";
import WizardPanel from "../components/wizard/WizardPanel";
import DocsPage from "../pages/DocsPage";
import {
  floatingChromeLeft,
  floatingColumnWidth,
  panelCard,
} from "../components/ui/classes";
import { cn } from "../components/ui/cn";
import { MapAppProvider, useMapApp } from "./MapAppProvider";
import { paths } from "./paths";
import { useAppPage } from "./useAppPage";

const MAP_TABS = new Set<string>([paths.map, paths.results, paths.history]);

function MapAppShell() {
  const { state, panelOpen, error } = useMapApp();
  const floating = state.variant === "floating";
  const page = useAppPage();
  const { pathname } = useLocation();
  const belowSearch = page === "map";

  if (pathname === "/" || pathname === "") {
    return <Navigate to={paths.map} replace />;
  }

  const isDocs = pathname === paths.docs || pathname.startsWith(`${paths.docs}/`);
  if (!isDocs && !MAP_TABS.has(pathname)) {
    return <Navigate to={paths.map} replace />;
  }

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col font-sans text-ink",
        isDocs ? "bg-paper" : floating ? "tune-floating" : "tune-sidebar",
      )}
    >
      <AppHeader />
      {isDocs ? (
        <main className="min-h-0 flex-1 overflow-auto">
          <DocsPage />
        </main>
      ) : (
        <main
          className={cn(
            "relative flex overflow-hidden max-sm:flex-col max-sm:overflow-auto",
            "h-[calc(100dvh-64px)] max-lg:h-[calc(100dvh-72px)] max-sm:h-[calc(100dvh-64px)]",
          )}
        >
          <PlaceSearch />
          <MapChrome />
          <aside
            className={cn(
              panelCard,
              floating
                ? [
                    floatingChromeLeft,
                    floatingColumnWidth,
                    "absolute rounded-lg border border-panel-border",
                    "max-sm:relative max-sm:top-0 max-sm:left-0 max-sm:order-2 max-sm:max-h-none max-sm:w-full",
                    "max-sm:rounded-none max-sm:border-0 max-sm:shadow-none",
                    belowSearch
                      ? [
                          "top-24 max-h-[calc(100%-7.5rem)]",
                          "max-lg:top-[5.5rem] max-lg:max-h-[calc(100%-7rem)]",
                          "max-[760px]:top-20 max-[760px]:max-h-[calc(100%-6.5rem)]",
                        ]
                      : [
                          "top-6 max-h-[calc(100%-3rem)]",
                          "max-lg:top-5 max-lg:max-h-[calc(100%-2.5rem)]",
                          "max-sm:top-0",
                        ],
                  ]
                : [
                    "relative top-0 left-0 order-1 max-h-full w-1/4 min-w-[360px] shrink-0",
                    "rounded-none border-y-0 border-l-0 border-r border-line shadow-none",
                    "max-xl:min-w-[386px]",
                    "max-sm:order-2 max-sm:max-h-none max-sm:min-w-0 max-sm:w-full max-sm:border-r-0",
                    belowSearch
                      ? "pt-24 max-sm:pt-6 max-[760px]:pt-20"
                      : "pt-6 max-sm:pt-6",
                  ],
            )}
            hidden={!panelOpen}
          >
            {page === "map" && <WizardPanel />}
            {page === "results" && <ResultsPanel />}
            {page === "history" && <SessionHistory />}
            {error && (
              <p className="mt-4 text-xs text-danger" role="alert">
                {error}
              </p>
            )}
          </aside>
        </main>
      )}
    </div>
  );
}

export default function MapApp({
  provider,
}: {
  provider?: DataProvider;
}) {
  return (
    <MapAppProvider provider={provider}>
      <MapAppShell />
    </MapAppProvider>
  );
}
