interface Props {
  open: boolean;
  onClose: () => void;
}

const SECTIONS = [
  {
    id: "que",
    title: "Qué hace Tune",
    body: (
      <>
        <p>
          Tune analiza una imagen satelital y detecta <strong>agua</strong> con el modelo Prithvi-EO
          2.0. La <strong>inundación</strong> no es toda el agua: es el <strong>agua nueva</strong>{" "}
          (agua del modelo menos agua permanente de JRC o del historial del lugar).
        </p>
        <p>
          Si hay producto operativo (Copernicus GFM), también muestra el acuerdo. La cicatriz de
          incendio es una tarea auxiliar.
        </p>
      </>
    ),
  },
  {
    id: "usar",
    title: "Cómo usar la app",
    body: (
      <ol>
        <li>
          En <strong>Analizar</strong>, elige Inundación (o cicatriz).
        </li>
        <li>
          Prueba una <strong>escena oficial</strong>, sube tu GeoTIFF, o busca por coordenada en{" "}
          <strong>Encontrar</strong>.
        </li>
        <li>
          Espera el progreso: % de descarga, tiempo transcurrido y <strong>tiempo que falta</strong>{" "}
          para terminar.
        </li>
        <li>
          Lee el <strong>Resultado</strong> a la izquierda y el mapa a la derecha.
        </li>
      </ol>
    ),
  },
  {
    id: "mapa",
    title: "Cómo leer el mapa",
    body: (
      <ul>
        <li>
          <strong>Satélite</strong> — imagen con la máscara encima.
        </li>
        <li>
          <strong>Agua</strong> — todo lo que el modelo clasificó como agua.
        </li>
        <li>
          <strong>Cambio</strong> — rojo = nueva (inundación), azul = permanente, gris = retirada.
        </li>
        <li>
          <strong>Acuerdo</strong> — coincidencia con GFM u otro producto (si hubo dato).
        </li>
      </ul>
    ),
  },
  {
    id: "oficiales",
    title: "Escenas oficiales",
    body: (
      <>
        <p>
          India, España y EE. UU. son GeoTIFF de Sen1Floods11 (~2 MB). Al pulsarlas, Tune consulta
          Hugging Face: si el archivo remoto cambió, lo vuelve a bajar y luego analiza.
        </p>
        <p>
          El tiempo largo casi nunca es la imagen: la primera vez el modelo baja ~1,2 GB de pesos.
          Después suele tardar entre medio minuto y un minuto y medio en CPU.
        </p>
      </>
    ),
  },
  {
    id: "historial",
    title: "Historial del lugar",
    body: (
      <p>
        Debajo del mapa aparecen otras corridas con las mismas coordenadas. No cambia la máscara
        actual: sirve para abrir un análisis anterior y comparar fechas cuando hay más de uno.
      </p>
    ),
  },
  {
    id: "probar",
    title: "Cómo probar",
    body: (
      <ul>
        <li>
          Demo: <code>make app-up</code> → http://localhost:8080 → escena EE. UU. o España.
        </li>
        <li>
          Tests automáticos (sin GPU): <code>pytest -m &quot;not gpu&quot;</code>
        </li>
        <li>
          API en vivo: http://localhost:8000/docs (rutas técnicas bajo <code>/api</code>).
        </li>
      </ul>
    ),
  },
] as const;

export function DocsPanel({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="docs-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="docs-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="docs-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="docs-head">
          <div>
            <h2 id="docs-title">Documentación</h2>
            <p className="caption">Cómo usar Tune, leer resultados y probar escenas.</p>
          </div>
          <button type="button" className="close" aria-label="Cerrar documentación" onClick={onClose}>
            Cerrar
          </button>
        </header>
        <div className="docs-body">
          {SECTIONS.map((s) => (
            <section key={s.id} className="docs-section">
              <h3>{s.title}</h3>
              {s.body}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
