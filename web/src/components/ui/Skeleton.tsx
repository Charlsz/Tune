import { cn } from "./cn";

/** Bloque skeleton con shimmer (solo opacity/transform-safe via background). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("tune-skeleton rounded-sm bg-[#e8eaef]", className)}
      aria-hidden
    />
  );
}

/** Lista falsa de escenas mientras consulta el catálogo. */
export function CatalogSkeleton() {
  return (
    <div className="animate-fade-up" role="status" aria-live="polite">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="tune-spinner tune-spinner-sm shrink-0" />
        <div>
          <p className="m-0 text-[13px] font-medium text-ink">
            Consultando Sentinel-2…
          </p>
          <p className="m-0 mt-1 text-[11px] text-fg-muted">
            Buscando escenas Antes y Después en el catálogo STAC.
          </p>
        </div>
      </div>
      {(["Antes", "Después"] as const).map((label) => (
        <section key={label} className="mb-5">
          <Skeleton className="mb-2 h-3 w-16" />
          <Skeleton className="mb-2 h-2.5 w-28" />
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 border border-line p-2"
              >
                <Skeleton className="size-12 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-2 w-14" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <span className="sr-only">Cargando catálogo de imágenes</span>
    </div>
  );
}
