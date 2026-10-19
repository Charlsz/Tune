const TOC = [
  { id: "que-es", label: "Qué es Tune" },
  { id: "empezar", label: "Cómo empezar" },
  { id: "ubicacion", label: "Ubicación y Sentinel-2" },
  { id: "geotiff", label: "Tu propio GeoTIFF" },
  { id: "ejemplos", label: "Escenas de ejemplo" },
  { id: "progreso", label: "Qué ocurre al analizar" },
  { id: "mapa", label: "Cómo leer el mapa" },
  { id: "agua-vs-inundacion", label: "Agua e inundación" },
  { id: "resultados", label: "Resultados" },
  { id: "historial", label: "Historial" },
  { id: "errores", label: "Si algo falla" },
] as const;

export function DocsScreen() {
  return (
    <div className="docs-page">
      <header className="page-head">
        <h1>Documentación</h1>
        <p className="page-lead">
          Guía para usar Tune de punta a punta: iniciar un análisis, entender el mapa y leer los
          resultados con claridad.
        </p>
      </header>

      <div className="docs-layout">
        <nav className="docs-toc" aria-label="Contenido">
          <p className="docs-toc-title">Contenido</p>
          <ul>
            {TOC.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="docs-article">
          <section id="que-es" className="docs-sec">
            <h2>Qué es Tune</h2>
            <p>
              Tune es una aplicación de análisis satelital. Recibe una imagen de la Tierra, detecta
              dónde hay agua (o cicatriz de incendio) y, en el caso de inundación, estima qué parte
              de esa agua es <strong>nueva</strong> respecto a una referencia de agua permanente.
            </p>
            <p>
              Esa distinción importa: <strong>agua detectada</strong> es todo lo que el modelo ve
              como agua en la escena. <strong>Posible inundación</strong> es solo el agua que no
              estaba en la referencia permanente. Si además hay un producto externo comparable
              (por ejemplo Copernicus GFM), Tune puede mostrar el acuerdo entre ambas fuentes.
            </p>
            <p>
              La tarea principal es inundación. La cicatriz de incendio está disponible como tarea
              alternativa con el mismo flujo de trabajo.
            </p>
          </section>

          <section id="empezar" className="docs-sec">
            <h2>Cómo empezar</h2>
            <ol>
              <li>
                En <strong>Inicio</strong>, elige <strong>Inundaciones</strong> o{" "}
                <strong>Incendios</strong>.
              </li>
              <li>
                Escoge una forma de entrada: punto en el mapa + escena Sentinel-2, archivo GeoTIFF
                propio, o escena de ejemplo.
              </li>
              <li>
                Confirma el análisis. La aplicación pasa a <strong>Análisis</strong>, donde verás
                el progreso paso a paso (subida o descarga, validación y modelo).
              </li>
              <li>
                Cuando termine, revisa el resumen a la derecha y las capas del mapa. Guarda la
                corrida en <strong>Historial</strong> para volver más tarde.
              </li>
            </ol>
          </section>

          <section id="ubicacion" className="docs-sec">
            <h2>Ubicación y escenas Sentinel-2</h2>
            <p>
              En el bloque <strong>Ubicación y escenas Sentinel-2</strong> indicas un punto. Puedes:
            </p>
            <ul>
              <li>Escribir un nombre de lugar (ciudad, región) y pulsar Buscar.</li>
              <li>
                Escribir latitud y longitud separadas por coma, por ejemplo{" "}
                <code>4.71, -74.07</code>.
              </li>
              <li>Usar un atajo (Bogotá, Magdalena, Valencia, Sindh).</li>
            </ul>
            <p>
              En cuanto hay un punto válido, Tune consulta el catálogo y lista escenas cercanas. Cada
              fila muestra la fecha y el porcentaje de nubes de <strong>toda la escena</strong>{" "}
              Sentinel-2 (aprox. 100 km). Ese valor no es el de tu recorte local: al analizar se mide
              la nubosidad real del recorte. Si supera «Nubes máx.», Tune te dirá cuánto subir el
              filtro o te pedirá otra fecha.
            </p>
            <p>
              Los filtros (fechas, nubes máximas y tamaño del recorte en kilómetros) están junto a la
              lista. Si cambias un filtro, pulsa <strong>Actualizar lista</strong>. Un recorte más
              pequeño suele ser más rápido.
            </p>
          </section>

          <section id="geotiff" className="docs-sec">
            <h2>Tu propio GeoTIFF</h2>
            <p>
              Arrastra o elige un archivo <code>.tif</code> o <code>.tiff</code> de hasta 200 MB.
              Antes de subir, Tune comprueba la extensión y el tamaño. Si el archivo no sirve, te lo
              dice de inmediato.
            </p>
            <p>
              Para inundación, el modelo necesita seis bandas en el orden Prithvi (azul, verde, rojo,
              infrarrojo cercano y dos SWIR), o un producto Sentinel-2 L1C completo del que Tune
              puede extraer esas bandas. Si el archivo tiene otro número de bandas o un formato
              incompatible, el análisis fallará con un mensaje orientado a corregir la entrada.
            </p>
            <p>
              Tras elegir el archivo, pulsa <strong>Analizar zona</strong>. En Análisis verás: (1)
              preparación, (2) porcentaje de subida, (3) validación y ejecución del modelo.
            </p>
          </section>

          <section id="ejemplos" className="docs-sec">
            <h2>Escenas de ejemplo</h2>
            <p>
              Las escenas oficiales son GeoTIFF de prueba ya preparados (por ejemplo España o
              Estados Unidos). Sirven para conocer el flujo sin buscar en el catálogo. La primera
              vez que corre el modelo puede tardar varios minutos porque descarga los pesos; las
              siguientes suelen ser más rápidas.
            </p>
            <p>
              Selecciona una escena en la lista y pulsa <strong>Analizar zona</strong>.
            </p>
          </section>

          <section id="progreso" className="docs-sec">
            <h2>Qué ocurre al analizar</h2>
            <p>
              El progreso se muestra en <strong>Análisis</strong>, no en Inicio, para que el estado
              y el mapa queden juntos. Según el origen verás pasos distintos:
            </p>
            <ul>
              <li>
                <strong>Archivo propio</strong>: preparar, subir (con porcentaje), validar y
                analizar.
              </li>
              <li>
                <strong>Catálogo</strong>: preparar, descargar bandas del recorte, ejecutar el
                modelo.
              </li>
              <li>
                <strong>Ejemplo</strong>: comprobar actualización, descargar si hace falta, analizar.
              </li>
            </ul>
            <p>
              Cuando hay porcentaje real (subida o descarga de archivo), se muestra. En la fase del
              modelo no hay porcentaje fijo: verás tiempo transcurrido y una estimación que se
              ajusta al ritmo real. La primera ejecución de una tarea puede incluir la descarga de
              los pesos del modelo.
            </p>
          </section>

          <section id="mapa" className="docs-sec">
            <h2>Cómo leer el mapa</h2>
            <p>El panel Capas cambia qué estás viendo:</p>
            <ul>
              <li>
                <strong>Imagen satelital</strong>: la escena con la máscara encima.
              </li>
              <li>
                <strong>Agua detectada</strong> (o clases en incendio): solo lo que clasificó el
                modelo.
              </li>
              <li>
                <strong>Posible inundación</strong>: agua nueva, permanente y retirada frente a la
                referencia.
              </li>
              <li>
                <strong>Comparación externa</strong>: acuerdo con un producto operativo, cuando hay
                dato alineado.
              </li>
            </ul>
            <p>
              La leyenda bajo el mapa corresponde a la capa activa. Pasa el cursor sobre un píxel
              para ver la clase y, si hay georreferencia, las coordenadas.
            </p>
          </section>

          <section id="agua-vs-inundacion" className="docs-sec">
            <h2>Agua detectada e inundación</h2>
            <p>
              No son lo mismo. <strong>Agua detectada</strong> es la máscara del modelo.{" "}
              <strong>Posible inundación</strong> es el agua nueva: agua del modelo menos agua
              permanente de la referencia.
            </p>
            <p>
              Si en esa zona la referencia no marca casi agua permanente (escenas pequeñas, sin
              cauces estables, o referencia incompleta), las dos capas pueden cubrir la misma zona.
              Tune lo avisa en el resumen y muestra ambas cifras juntas para que compares. En ese
              caso el contorno se parece; cambia el significado, no necesariamente la forma.
            </p>
          </section>

          <section id="resultados" className="docs-sec">
            <h2>Resultados</h2>
            <p>El resumen destaca primero la conclusión principal:</p>
            <ul>
              <li>
                Área de posible inundación (agua nueva) cuando hay capa de cambio; si no, el área o
                porcentaje de la clase positiva.
              </li>
              <li>
                Comparación agua detectada frente a posible inundación, cuando ambas están
                disponibles.
              </li>
              <li>
                Población expuesta u otras clases de cobertura solo si hay datos para calcularlas.
              </li>
              <li>
                Comparación con fuentes externas (acuerdo, solo Tune, solo externo) cuando existe
                fusión.
              </li>
            </ul>
            <p>
              En <strong>Ver detalles</strong> y <strong>Detalles técnicos</strong> están metadatos,
              descargas (máscara, PNG, JSON) y la ficha del GeoTIFF. No hace falta abrirlos para
              entender el resultado principal.
            </p>
          </section>

          <section id="historial" className="docs-sec">
            <h2>Historial</h2>
            <p>
              <strong>Historial</strong> en la barra lateral lista las corridas guardadas. Puedes
              abrir una para recuperar mapa y resumen, o quitarla del listado.
            </p>
            <p>
              Debajo del mapa, <strong>Historial del lugar</strong> agrupa otras fechas del mismo
              punto. Sirve para comparar en el tiempo; no cambia la máscara actual hasta que eliges
              otra corrida.
            </p>
          </section>

          <section id="errores" className="docs-sec">
            <h2>Si algo falla</h2>
            <ul>
              <li>
                <strong>Archivo rechazado al elegir</strong>: comprueba que sea .tif/.tiff y que no
                supere 200 MB.
              </li>
              <li>
                <strong>No se pudo analizar el GeoTIFF / AssertionError</strong>: suele ser un
                número de bandas o un formato que el modelo no acepta. Usa un GeoTIFF de 6 bandas
                Prithvi, un Sentinel-2 L1C completo, o una escena de ejemplo.
              </li>
              <li>
                <strong>Fallo del modelo tras varios minutos</strong>: a menudo memoria insuficiente
                o un recorte muy grande. Reduce el tamaño del recorte (km), usa un ejemplo oficial o
                reintenta más tarde.
              </li>
              <li>
                <strong>Ninguna escena en el catálogo</strong>: amplía fechas o sube el máximo de
                nubes y pulsa Actualizar lista.
              </li>
              <li>
                <strong>Servicio sin respuesta</strong>: asegúrate de que la aplicación esté
                levantada y vuelve a intentar.
              </li>
            </ul>
          </section>
        </article>
      </div>
    </div>
  );
}
