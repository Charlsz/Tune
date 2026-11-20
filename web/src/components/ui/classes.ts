/** Variantes de botón y superficies — padding/radius unificados. */

const btnLayout =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-none disabled:cursor-not-allowed disabled:opacity-45";

/** CTA principal (negro, esquina viva). */
export const btnPrimary = [
  btnLayout,
  "mt-3 min-h-12 w-full justify-between border border-ink",
  "bg-ink px-4 py-3 text-sm font-medium text-paper",
  "hover:bg-ink hover:opacity-90",
].join(" ");

/** Outline. */
export const btnOutline = [
  btnLayout,
  "w-full border border-line bg-paper px-4 py-3 text-[13px] text-ink",
  "hover:bg-accent-soft",
].join(" ");

/** Outline seleccionado. */
export const btnOutlineSelected = [
  btnLayout,
  "w-full border border-line-strong bg-accent-soft px-4 py-3 text-[13px] text-ink",
  "hover:bg-accent-soft",
].join(" ");

/** Link-button. */
export const btnText = [
  btnLayout,
  "justify-start border-0 bg-transparent px-0 py-2 text-left text-[11px] text-ink-soft",
  "hover:bg-transparent",
].join(" ");

export const emptyBox =
  "rounded-sm bg-[#f7f8fb] px-4 py-4 text-xs text-fg-soft";

/** Padding de panel: 24px desktop, 20px tablet, 16px compacto. */
export const panelCard = [
  "z-[700] overflow-auto bg-paper p-6",
  "shadow-[0_5px_22px_#15324818] scrollbar-thin",
  "max-lg:p-5 max-[760px]:p-4",
].join(" ");

/** Espacio vertical entre bloques del panel. */
export const sectionGap = "mb-6 max-[760px]:mb-4";

/** Título de panel (Mapa / Resultados / Historial / Docs). */
export const panelTitle =
  "m-0 text-[21px] font-semibold leading-tight tracking-[-0.45px] text-ink max-xl:text-[23px] max-lg:text-[19px] max-sm:text-[22px]";

/** Subtítulo / lugar bajo el h1. */
export const panelLead = "m-0 text-[12px] leading-snug text-fg-muted";

/** Meta de sesión (11px). */
export const panelMeta = "m-0 text-[11px] leading-snug text-fg-soft";

/** Callout product (callout accent-soft). */
export const panelCallout =
  "m-0 rounded-sm bg-accent-soft px-4 py-3 text-[12px] leading-snug text-fg";

/**
 * Ancho compartido buscador ↔ panel flotante (misma columna visual).
 * Desktop 360 · xl 386 · lg 320.
 */
export const floatingColumnWidth =
  "w-[360px] max-xl:w-[386px] max-lg:w-[320px]";

/** Inset horizontal del cromo flotante (search + panel). */
export const floatingChromeLeft =
  "left-6 max-lg:left-4 max-sm:left-3.5";

/**
 * Ancho del search en sidebar = columna sidebar menos padding del panel (p-6 / p-5).
 * Sidebar: 25% con min 360/386.
 */
export const sidebarSearchWidth =
  "w-[calc(max(25%,360px)-3rem)] max-xl:w-[calc(max(25%,386px)-2.5rem)] max-lg:w-[calc(320px-2.5rem)]";
