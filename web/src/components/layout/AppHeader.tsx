import { NavLink } from "react-router";
import { useMapApp } from "../../app/MapAppProvider";
import { paths } from "../../app/paths";
import { cn } from "../ui/cn";

const TABS = [
  { to: paths.map, label: "Mapa" },
  { to: paths.geotiff, label: "GeoTIFF" },
  { to: paths.results, label: "Resultados" },
  { to: paths.history, label: "Historial" },
] as const;

export default function AppHeader() {
  const { setPanelOpen } = useMapApp();

  return (
    <header className="sticky top-0 z-[800] flex h-16 min-h-16 items-center gap-6 border-b border-line bg-paper px-6 max-lg:h-[72px] max-lg:min-h-[72px] max-lg:gap-5 max-lg:px-5 max-sm:h-16 max-sm:gap-3 max-sm:px-4">
      <NavLink
        to={paths.map}
        className="flex items-center gap-3 border-r border-line-strong pr-6 text-[22px] font-semibold leading-none tracking-[-0.04em] no-underline max-lg:pr-5 max-lg:text-[28px] max-sm:gap-2 max-sm:pr-3.5 max-sm:text-2xl"
        onClick={() => setPanelOpen(true)}
      >
        <span className="flex size-8">
          <img src="/icons/tune-icon.svg" alt="" width={32} height={32} />
        </span>
        Tune
      </NavLink>
      <nav
        className="flex min-w-0 flex-1 items-center gap-1 max-sm:gap-0"
        aria-label="Navegación principal"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            onClick={() => setPanelOpen(true)}
            className={({ isActive }) =>
              cn(
                "cursor-pointer rounded-none border-0 px-3.5 py-2.5 text-sm text-ink no-underline",
                "max-lg:px-4 max-lg:py-3 max-sm:px-2.5 max-sm:py-2 max-sm:text-xs",
                isActive
                  ? "bg-accent-soft font-semibold"
                  : "bg-transparent font-normal",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
        <NavLink
          to={paths.docs}
          className={({ isActive }) =>
            cn(
              "ml-auto cursor-pointer rounded-none border-0 px-3.5 py-2.5 text-sm text-ink no-underline",
              "max-lg:px-4 max-lg:py-3 max-sm:px-2.5 max-sm:py-2 max-sm:text-xs",
              isActive
                ? "bg-accent-soft font-semibold"
                : "bg-transparent font-normal text-fg-muted",
            )
          }
        >
          Docs
        </NavLink>
      </nav>
    </header>
  );
}
