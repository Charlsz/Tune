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
