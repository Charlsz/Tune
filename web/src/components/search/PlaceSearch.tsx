import { ChevronRight, MapPin, Search } from "lucide-react";
import { useMapApp } from "../../app/MapAppProvider";
import { aoiFromPoint, parseCoords } from "../../domain/aoi";
import { emptyBox } from "../ui/classes";
import { cn } from "../ui/cn";

export default function PlaceSearch() {
  const {
    state,
    provider,
    query,
    setQuery,
    searchOpen,
    setSearchOpen,
    setArea,
    panelOpen,
  } = useMapApp();

  if (state.page !== "map") return null;

  const matches = provider.places.filter((p) =>
    p.label.toLowerCase().includes(query.toLowerCase()),
  );
  const coords = parseCoords(query);
  const sidebarNarrow = state.variant === "sidebar" && panelOpen;

  return (
    <div
      className={cn(
        "absolute top-6 left-6 z-[750] max-lg:top-5 max-lg:left-4 max-sm:top-3.5 max-sm:left-3.5 max-sm:w-[calc(100%-5.5rem)]",
        sidebarNarrow
          ? "w-[calc(max(25%,360px)-3rem)] max-xl:w-[calc(max(25%,386px)-3rem)] max-lg:w-[17rem]"
          : "w-[410px] max-xl:w-[440px] max-lg:w-[350px]",
      )}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setSearchOpen(false);
      }}
    >
      <div
        className={cn(
          "flex h-[52px] items-center gap-3.5 rounded-pill border border-search-border bg-paper px-5",
          "text-fg-muted shadow-[0_3px_12px_#15324816]",
          "max-lg:h-[48px] max-[760px]:h-[44px]",
          sidebarNarrow && "px-4",
        )}
      >
        <Search size={22} />
        <label className="sr-only" htmlFor="place">
          Buscar
        </label>
        <input
          id="place"
          className={cn(
            "min-w-0 w-full border-0 bg-transparent text-[15px] text-fg outline-none",
            "placeholder:text-fg-soft max-lg:text-[13px] max-sm:text-xs",
            sidebarNarrow && "text-xs",
          )}
          placeholder="Lugar o coordenadas…"
          autoComplete="off"
          value={query}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSearchOpen(false);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
        />
      </div>
      {searchOpen && (
        <div className="mt-2.5 rounded-md border border-line bg-paper p-4 shadow-[0_8px_20px_#12253520]">
          {matches.map((p) => (
            <button
              key={p.label}
              type="button"
              className="flex w-full cursor-pointer items-center justify-start gap-2 rounded-none border-0 bg-transparent px-1.5 py-2.5 text-[13px] hover:bg-accent-soft"
              onClick={() => {
                setArea(p.bbox, p.label);
                setQuery("");
              }}
            >
              <MapPin size={16} />
              {p.label}
              <ChevronRight size={15} className="ml-auto" />
            </button>
          ))}
          {!matches.length && <p className={emptyBox}>Sin coincidencias.</p>}
          {coords && (
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-start gap-2 rounded-none border-0 bg-transparent px-1.5 py-2.5 text-[13px] hover:bg-accent-soft"
              onClick={() =>
                setArea(aoiFromPoint(coords, 35, 150).bbox, "Coordenadas")
              }
            >
              Usar coordenadas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
