import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { paths } from "../app/paths";
import {
  btnPrimary,
  panelCallout,
  panelLead,
  panelMeta,
  panelTitle,
  sectionGap,
} from "../components/ui/classes";
import FadeIn from "../components/ui/FadeIn";

const STEPS = [
  {
    n: "1",
    title: "Área",
    tab: "Mapa",
    body: "Busca un nombre (Nominatim), pega coordenadas lat, lon (ej. 27.1, 67.95) o dibuja un rectángulo. Ese AOI es el recorte del catálogo.",
  },
  {
    n: "2",
    title: "Fechas",
    tab: "Mapa",
    body: "Elige Antes (línea base) y Después (p. ej. pico). Después debe ser posterior a Antes.",
  },
  {
    n: "3",
    title: "Escenas",
    tab: "Mapa",
    body: "Consulta Sentinel-2 (STAC) y elige una escena por fecha. Sin cobertura, el panel lo dice sin bloquear el resto.",
  },
  {
    n: "4",
    title: "Analizar",
    tab: "Mapa",
    body: "Tune corre el modelo en ambas escenas (preparar, descargar bandas, inferir) con una ETA orientativa.",
  },
  {
    n: "5",
    title: "Leer el resultado",
    tab: "Resultados",
    body: "Agua nueva, modos Antes/Después/Cambio/Acuerdo, máscara y deslizador. El mapa refleja lo que eliges aquí.",
  },
  {
    n: "6",
    title: "Reabrir",
    tab: "Historial",
    body: "Cada corrida de esta sesión queda listada. Elige una para volver a Resultados y al mapa.",
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
        <p className={`${panelMeta} font-medium uppercase tracking-[0.08em]`}>
          Documentación
        </p>
        <h1 className={`${panelTitle} mb-3 mt-2`}>Cómo usar Tune</h1>
        <p className={`${panelLead} mb-4 max-w-[65ch] text-[14px] text-fg`}>
          Flujo corto para demo académica: un área, dos fechas Sentinel-2 y un
          análisis recuperable en portátil o VM.
        </p>
        <p className={`${panelCallout} mb-10`}>
          <strong className="font-medium text-ink">Qué es / qué no es.</strong>{" "}
          Inundación en Tune ={" "}
          <strong className="font-medium text-ink">agua nueva</strong> frente a
          la referencia (modo Cambio). No es el agua total de la escena.
        </p>

        <section className={sectionGap} aria-labelledby="docs-steps">
          <h2
            id="docs-steps"
            className="mb-4 mt-0 text-[15px] font-semibold tracking-[-0.2px] text-ink"
          >
            Paso a paso
          </h2>
          <ol className="m-0 list-none space-y-0 border-t border-line p-0">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="grid grid-cols-[2rem_1fr] gap-3 border-b border-line py-4"
              >
                <span className="pt-0.5 text-[13px] font-semibold text-ink">
                  {step.n}
                </span>
                <div>
                  <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-[14px] font-medium text-ink">
                    {step.title}
                    <span className="text-[11px] font-normal text-fg-soft">
                      en {step.tab}
                    </span>
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
            className="mb-3 mt-0 text-[15px] font-semibold tracking-[-0.2px] text-ink"
          >
            Pipeline
          </h2>
          <p className="mb-0 mt-0 text-[13px] leading-relaxed text-fg-muted">
            AOI + fechas → catálogo STAC → dos escenas → inferencia de agua →
            cambio (agua nueva vs línea base) → fusión GFM si hay capa →
            métricas de exposición → MapApp (sesión) e historial API en disco.
          </p>
        </section>

        <section className={sectionGap} aria-labelledby="docs-sources">
          <h2
            id="docs-sources"
            className="mb-4 mt-0 text-[15px] font-semibold tracking-[-0.2px] text-ink"
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
            className="mb-3 mt-0 text-[15px] font-semibold tracking-[-0.2px] text-ink"
          >
            Notas útiles
          </h2>
          <ul className="mb-8 mt-0 space-y-2 pl-4 text-[13px] leading-snug text-fg-muted">
            <li>
              El Historial de la pestaña es solo de esta sesión; al recargar se
              vacía. El servidor guarda análisis aparte (`GET /api/analyses`).
            </li>
            <li>
              Sin GFM o sin escenas, el análisis sigue; la UI lo indica.
            </li>
            <li>
              La primera inferencia puede descargar pesos (~1,2 GB) y tardar más
              en CPU.
            </li>
          </ul>
          <Link to={paths.map} className={`${btnPrimary} no-underline`}>
            Ir a Mapa
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </FadeIn>
  );
}
