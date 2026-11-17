import { useMapApp } from "../../app/MapAppProvider";
import { cn } from "../ui/cn";

const TABS = [
  { id: "map" as const, label: "Mapa" },
  { id: "results" as const, label: "Resultados" },
  { id: "history" as const, label: "Historial" },
];

export default function AppHeader() {
  const { state, patch, setPanelOpen } = useMapApp();

  return (
    <header className="flex h-16 min-h-16 items-center gap-6 border-b border-line bg-paper px-6 max-lg:h-[72px] max-lg:min-h-[72px] max-lg:gap-5 max-lg:px-5 max-sm:h-16 max-sm:gap-3 max-sm:px-4">
      <a
        className="flex items-center gap-3 border-r border-line-strong pr-6 text-[22px] font-semibold leading-none tracking-[-0.04em] no-underline max-lg:pr-5 max-lg:text-[28px] max-sm:gap-2 max-sm:pr-3.5 max-sm:text-2xl"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          patch({ page: "map" });
        }}
      >
        <span className="flex size-8">
          <img src="/icons/tune-icon.svg" alt="" width={32} height={32} />
        </span>
        Tune
      </a>
      <nav
        className="flex items-center gap-1 max-sm:gap-0"
        aria-label="Navegación principal"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              "cursor-pointer rounded-none border-0 px-3.5 py-2.5 text-sm text-ink",
              "max-lg:px-4 max-lg:py-3 max-sm:px-2.5 max-sm:py-2 max-sm:text-xs",
              state.page === tab.id
                ? "bg-accent-soft font-semibold"
                : "bg-transparent font-normal",
            )}
            onClick={() => {
              patch({ page: tab.id });
              setPanelOpen(true);
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
