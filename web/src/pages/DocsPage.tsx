import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { paths } from "../app/paths";
import { btnPrimary, sectionGap } from "../components/ui/classes";
import FadeIn from "../components/ui/FadeIn";

const STEPS = [
  {
    n: "1",
    title: "Área",
    body: "Busca un lugar, pega coordenadas (lat, lon) o dibuja un rectángulo en el mapa. Ese AOI es el recorte que consulta el catálogo.",
  },
  {
    n: "2",
    title: "Fechas",
    body: "Elige Antes (línea base) y Después (p. ej. pico de inundación). Después debe ser posterior a Antes.",
  },
  {
    n: "3",
    title: "Escenas",
    body: "Consulta Sentinel-2 (STAC) y elige una escena por fecha. Si no hay cobertura, el panel lo dice sin bloquear el resto.",
  },
  {
    n: "4",
    title: "Analizar",
    body: "Tune corre el modelo en ambas escenas. Verás fases (preparar, descargar bandas, inferir) y una ETA orientativa.",
  },
  {
    n: "5",
    title: "Resultado",
    body: "En Resultados y en el mapa: agua nueva (modo Cambio), previews, máscaras y, si hubo capa, Acuerdo GFM.",
  },
] as const;

const SOURCES = [
  {
    name: "Sentinel-2",
    role: "Imágenes ópticas Antes / Después vía catálogo STAC.",
  },
  {
    name: "Prithvi-EO 2.0",
    role: "Detección de agua (Sen1Floods11) sobre el AOI.",
  },
  {
    name: "JRC / historial",
    role: "Línea base de agua permanente o previa del territorio.",
  },
  {
    name: "GFM (Copernicus)",
    role: "Capa de observación para acuerdo (IoU) cuando existe ítem.",
  },
  {
    name: "WorldCover / GHSL",
    role: "Exposición: cobertura y población estimada sobre agua nueva.",
  },
] as const;

export default function DocsPage() {
  return (
    <FadeIn>
      <div className="mx-auto w-full max-w-[42rem] px-6 py-10 max-sm:px-4 max-sm:py-8">
        <p className="m-0 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">
          Documentación
        </p>
        <h1 className="mb-3 mt-2 text-[28px] font-semibold tracking-[-0.6px] text-ink max-sm:text-[24px]">
          Cómo usar Tune
        </h1>
        <p className="mb-10 mt-0 max-w-[65ch] text-[15px] leading-relaxed text-fg">
          Tune convierte un área y dos fechas Sentinel-2 en un análisis
          defendible de{" "}
          <strong className="font-medium text-ink">agua nueva</strong> (no agua
          total). Flujo corto para demo académica en portátil o VM.
        </p>

        <section className={sectionGap} aria-labelledby="docs-steps">
          <h2
            id="docs-steps"
            className="mb-4 mt-0 text-[17px] font-semibold tracking-[-0.3px]"
          >
            Paso a paso
          </h2>
          <ol className="m-0 list-none space-y-0 p-0">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="grid grid-cols-[2rem_1fr] gap-3 border-t border-line py-4"
              >
                <span className="pt-0.5 text-[13px] font-semibold text-ink">
                  {step.n}
                </span>
                <div>
                  <p className="m-0 text-[14px] font-medium text-ink">
                    {step.title}
                  </p>
                  <p className="mb-0 mt-1 text-[13px] leading-snug text-fg-muted">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={sectionGap} aria-labelledby="docs-pipeline">
          <h2
            id="docs-pipeline"
            className="mb-3 mt-0 text-[17px] font-semibold tracking-[-0.3px]"
          >
            Pipeline
          </h2>
          <p className="mb-3 mt-0 text-[13px] leading-relaxed text-fg-muted">
            AOI + fechas → catálogo STAC → dos escenas → inferencia de agua →
            cambio (agua nueva vs línea base) → fusión GFM si hay capa →
            métricas de exposición → MapApp (sesión) e historial API en disco.
          </p>
          <p className="m-0 rounded-sm bg-accent-soft px-4 py-3 text-[12px] leading-snug text-fg">
            Inundación en Tune = agua que aparece en Después y no estaba en la
            referencia. El modo Cambio es la cifra a defender en la demo.
          </p>
        </section>

        <section className={sectionGap} aria-labelledby="docs-sources">
          <h2
            id="docs-sources"
            className="mb-4 mt-0 text-[17px] font-semibold tracking-[-0.3px]"
          >
            De dónde salen los datos
          </h2>
          <ul className="m-0 list-none space-y-0 border-t border-line p-0">
            {SOURCES.map((s) => (
              <li
                key={s.name}
                className="flex flex-col gap-0.5 border-b border-line py-3 sm:flex-row sm:items-baseline sm:gap-4"
              >
                <strong className="min-w-[9rem] text-[13px] font-medium text-ink">
                  {s.name}
                </strong>
                <span className="text-[13px] text-fg-muted">{s.role}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="docs-notes">
          <h2
            id="docs-notes"
            className="mb-3 mt-0 text-[17px] font-semibold tracking-[-0.3px]"
          >
            Notas útiles
          </h2>
          <ul className="mb-8 mt-0 space-y-2 pl-4 text-[13px] leading-snug text-fg-muted">
            <li>
              El historial de la pestaña es solo de esta sesión en el navegador.
            </li>
            <li>
              Sin GFM o sin escenas, el análisis sigue; la UI lo indica con
              claridad.
            </li>
            <li>
              La primera inferencia puede descargar pesos (~1,2 GB) y tardar más
              en CPU.
            </li>
          </ul>
          <Link
            to={paths.map}
            className={`${btnPrimary} no-underline`}
          >
            Ir a Mapa
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </FadeIn>
  );
}
