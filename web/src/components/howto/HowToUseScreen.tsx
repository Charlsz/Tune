import { Link } from "react-router";
import { paths } from "../../router/paths";

const DEMOS = [
  {
    id: "pakistan",
    title: "Pakistán Sindh · inundación 2022",
    why: "Crecida documentada: el cauce ya existía en mayo; en septiembre aparece lámina nueva alrededor.",
    place: "27.70, 68.85",
    sideKm: 12,
    steps: [
      {
        role: "1 · Línea base",
        date: "2022-05-18",
        item: "S2B_42RVR_20220518_0_L2A",
        expect: "Agua ~10 km² (río/canales). Referencia JRC en frío.",
      },
      {
        role: "2 · Pico",
        date: "2022-09-05",
        item: "S2B_42RVR_20220905_0_L2A",
        expect: "Agua ~60 km² · nueva ~49 km² · permanente ~10 km² · history_baseline.",
      },
    ],
    panel: "/proof/pakistan-pre-vs-flood.png",
    ui: "/proof/ui-pakistan-flood.png",
    verified: "Verificado 2026-11-05 (CPU, side_km=12).",
  },
  {
    id: "magdalena",
    title: "Bajo Magdalena (Colombia) · seca → húmeda 2022",
    why: "Humedal donde JRC marca poca permanente: hace falta la fecha seca como línea base.",
    place: "8.85, -74.65",
    sideKm: 12,
    steps: [
      {
        role: "1 · Seca",
        date: "2022-02-22",
        item: "S2B_18PWQ_20220222_0_L2A",
        expect: "Agua ~22 km². Arranque en frío (JRC débil aquí).",
      },
      {
        role: "2 · Húmeda",
        date: "2022-05-08",
        item: "S2A_18PWQ_20220508_0_L2A",
        expect: "Agua ~55 km² · nueva ~38 km² · permanente ~16 km² · history_baseline.",
      },
    ],
    panel: "/proof/magdalena-dry-vs-wet.png",
    ui: "/proof/ui-magdalena-wet.png",
    verified: "Verificado 2026-11-05 (CPU, side_km=12).",
  },
  {
    id: "mississippi",
    title: "Mississippi (EE. UU.) · 2018 → crecida 2019",
    why: "Otro continente: mucha agua permanente estable y un incremento medible en 2019.",
    place: "37.00, -89.18",
    sideKm: 12,
    steps: [
      {
        role: "1 · Base",
        date: "2018-09-18",
        item: "S2B_16SBF_20180918_0_L2A",
        expect: "Agua ~72 km² (río ancho + llanura).",
      },
      {
        role: "2 · Pico",
        date: "2019-06-10",
        item: "S2A_16SBF_20190610_0_L2A",
        expect: "Nueva ~10 km² · permanente ~66 km² · history_baseline.",
      },
    ],
    panel: "/proof/mississippi-pre-vs-flood.png",
    ui: null,
    verified: "Verificado 2026-11-05 (CPU, side_km=12).",
  },
] as const;

export function HowToUseScreen() {
  return (
    <div className="howto-page">
      <header className="page-head">
        <h1>Cómo usar Tune</h1>
        <p className="page-lead">
          Guía corta para demostrar <strong>inundación = agua nueva</strong>, no solo “hay agua”.
          Los pares de abajo fueron corridos y comprobados en esta máquina.
        </p>
      </header>

      <section className="howto-sec">
        <h2>La idea en una frase</h2>
        <p>
          Prithvi detecta agua. Tune calcula inundación como agua de la escena{" "}
          <em>menos</em> una referencia: JRC (arranque en frío) o, mejor, la máscara de una fecha{" "}
          <strong>anterior del mismo lugar</strong> (<code>history_baseline</code>).
        </p>
        <p className="howto-callout">
          Orden obligatorio: analiza primero la fecha base, luego el pico. Si inviertes las fechas,
          la “permanente” no tiene sentido temporal.
        </p>
      </section>

      <section className="howto-sec">
        <h2>Receta en la interfaz (5 minutos)</h2>
        <ol>
          <li>
            En <Link to={paths.home}>Inicio</Link>, deja la tarea en <strong>Inundaciones</strong>.
          </li>
          <li>
            Usa un atajo de demo (Sindh 2022, Magdalena 2022, Mississippi) o pega las coordenadas de
            la tabla. Pon <strong>lado del recorte = 12 km</strong>.
          </li>
          <li>
            Ajusta las fechas al rango de la <strong>línea base</strong>, elige la escena STAC
            exacta (o la más cercana) y pulsa Analizar. Espera a que termine.
          </li>
          <li>
            Cambia las fechas al <strong>pico</strong>, analiza esa escena. En Capas abre{" "}
            <strong>Posible inundación</strong>: rojo = nueva, azul = permanente.
          </li>
          <li>
            La cifra grande del resumen es agua nueva. “Agua detectada” es todo el agua del modelo.
          </li>
        </ol>
        <p>
          Detalle técnico y curl:{" "}
          <a href="https://github.com/Charlsz/Tune/blob/main/docs/validation/casos-demostracion.md">
            docs/validation/casos-demostracion.md
          </a>
          .
        </p>
      </section>

      <section className="howto-sec">
        <h2>Dónde sacar datos</h2>
        <ul>
          <li>
            <strong>Catálogo dentro de Tune</strong> (recomendado): Earth Search Sentinel-2 L2A por
            coordenada. Los IDs de abajo ya están verificados.
          </li>
          <li>
            <strong>Ejemplos oficiales</strong> (India, España, USA…): sirven para ver la máscara de
            agua y el flujo UI. <em>No</em> demuestran inundación sola: no traen un “antes”.
          </li>
          <li>
            <strong>Tu GeoTIFF</strong>: 6 bandas Prithvi o Sentinel-2 L1C. Para cambio real,
            analiza dos fechas del mismo sitio en orden cronológico.
          </li>
        </ul>
      </section>

      <section className="howto-sec">
        <h2>Pares verificados</h2>
        {DEMOS.map((demo) => (
          <article key={demo.id} className="howto-demo" id={demo.id}>
            <h3>{demo.title}</h3>
            <p>{demo.why}</p>
            <p className="caption">
              Punto <code>{demo.place}</code> · recorte {demo.sideKm} km · {demo.verified}
            </p>
            <ol className="howto-steps">
              {demo.steps.map((s) => (
                <li key={s.item}>
                  <strong>{s.role}</strong> ({s.date}) · <code>{s.item}</code>
                  <br />
                  <span className="caption">{s.expect}</span>
                </li>
              ))}
            </ol>
            <figure className="howto-fig">
              <img src={demo.panel} alt={`Comparación base vs pico: ${demo.title}`} loading="lazy" />
              <figcaption>Base (arriba) vs pico (abajo). Rojo = agua nueva, azul = permanente.</figcaption>
            </figure>
            {demo.ui && (
              <figure className="howto-fig">
                <img src={demo.ui} alt={`Interfaz Tune: ${demo.title}`} loading="lazy" />
                <figcaption>Misma corrida en la UI, capa «Posible inundación».</figcaption>
              </figure>
            )}
          </article>
        ))}
      </section>

      <section className="howto-sec">
        <h2>Qué evitar</h2>
        <ul>
          <li>Publicar India/España como “prueba de inundación” sin una fecha previa del sitio.</li>
          <li>Analizar solo el pico: con JRC flojo, casi todo el agua sale en rojo.</li>
          <li>Abrir el puerto 8000 a internet sin autenticación (borra y lista análisis ajenos).</li>
        </ul>
      </section>

      <p className="howto-footer caption">
        Más contexto: <Link to={paths.docs}>Documentación</Link> · evidencia en{" "}
        <code>docs/assets/proof/</code>.
      </p>
    </div>
  );
}
