import type { DataProvider } from "../domain/lab";
import AppHeader from "../components/layout/AppHeader";
import MapChrome from "../components/map/MapChrome";
import PlaceSearch from "../components/search/PlaceSearch";
import ResultsPanel from "../components/results/ResultsPanel";
import SessionHistory from "../components/history/SessionHistory";
import WizardPanel from "../components/wizard/WizardPanel";
import { panelCard } from "../components/ui/classes";
import { cn } from "../components/ui/cn";
import { MapAppProvider, useMapApp } from "./MapAppProvider";

function MapAppShell() {
  const { state, panelOpen, error } = useMapApp();
  const floating = state.variant === "floating";

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col font-sans text-ink",
        floating ? "tune-floating" : "tune-sidebar",
      )}
    >
      <AppHeader />
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
                  "absolute top-24 left-6 max-h-[calc(100%-7.5rem)] w-[360px]",
                  "rounded-lg border border-panel-border",
                  "max-xl:w-[386px]",
                  "max-lg:top-[5.5rem] max-lg:left-4 max-lg:max-h-[calc(100%-7rem)] max-lg:w-[320px]",
                  "max-sm:relative max-sm:top-0 max-sm:left-0 max-sm:order-2 max-sm:max-h-none max-sm:w-full",
                  "max-sm:rounded-none max-sm:border-0 max-sm:shadow-none",
                  "max-[760px]:top-20 max-[760px]:max-h-[calc(100%-6.5rem)]",
                ]
              : [
                  "relative top-0 left-0 order-1 max-h-full w-1/4 min-w-[360px] shrink-0",
                  "rounded-none border-y-0 border-l-0 border-r border-line pt-24 shadow-none",
                  "max-xl:min-w-[386px]",
                  "max-sm:order-2 max-sm:max-h-none max-sm:min-w-0 max-sm:w-full max-sm:border-r-0 max-sm:pt-6",
                  "max-[760px]:pt-20",
                ],
          )}
          hidden={!panelOpen}
        >
          {state.page === "map" && <WizardPanel />}
          {state.page === "results" && <ResultsPanel />}
          {state.page === "history" && <SessionHistory />}
          {error && (
            <p className="mt-4 text-xs text-danger" role="alert">
              {error}
            </p>
          )}
        </aside>
      </main>
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
