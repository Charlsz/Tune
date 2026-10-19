const MAX_BYTES = 200 * 1024 * 1024;

/** Validación local antes de subir. No lee el contenido del GeoTIFF. */
export function validateGeotiffFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!/\.tiff?$/i.test(file.name)) {
    return {
      ok: false,
      error: "Solo se aceptan archivos .tif o .tiff (GeoTIFF).",
    };
  }
  if (file.size <= 0) {
    return { ok: false, error: "El archivo está vacío." };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `El archivo supera 200 MB (${(file.size / (1024 * 1024)).toFixed(0)} MB). Usa un recorte más pequeño.`,
    };
  }
  return { ok: true };
}

export function geotiffHints(file: File): string[] {
  const hints: string[] = [];
  const mb = file.size / (1024 * 1024);
  if (mb > 80) {
    hints.push(
      "Archivo grande: el análisis puede tardar varios minutos y necesita más memoria.",
    );
  }
  hints.push(
    "El modelo espera 6 bandas Prithvi (BLUE, GREEN, RED, NIR, SWIR1, SWIR2) o un Sentinel-2 L1C completo.",
  );
  return hints;
}
