import { FileUp } from "lucide-react";
import { panelLead, panelMeta } from "../components/ui/classes";
import FadeIn from "../components/ui/FadeIn";
import PanelHeader from "../components/ui/PanelHeader";
import GeoTiffUpload from "../components/wizard/GeoTiffUpload";

/** Pestaña dedicada: analizar GeoTIFF propios sin pasar por el mapa. */
export default function GeoTiffPage() {
  return (
    <FadeIn>
      <div className="mx-auto w-full max-w-lg px-6 py-10 max-sm:px-4 max-sm:py-8">
        <PanelHeader title="GeoTIFF" icon={FileUp} />
        <p className={`${panelLead} mb-2`}>
          Sube uno o dos GeoTIFF compatibles y corre el análisis sin dibujar un
          área en el mapa.
        </p>
        <p className={`${panelMeta} mb-6`}>
          Un archivo = esa escena. Dos del mismo lugar y fechas distintas =
          agua nueva en la más reciente. Máx. 200&nbsp;MB por archivo (.tif /
          .tiff).
        </p>
        <GeoTiffUpload />
      </div>
    </FadeIn>
  );
}
