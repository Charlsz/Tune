import { useLayoutEffect, useState, type RefObject } from "react";

const defaultGutter = (el: HTMLElement) => (el.clientWidth < 720 ? 40 : 88);

/** Escala un rectángulo (ratio w/h) para caber en el contenedor, como en SceneStage. */
export function useFit(
  ref: RefObject<HTMLElement | null>,
  ratio: number,
  mountKey: string,
  gutter: number | ((el: HTMLElement) => number) = defaultGutter,
) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const pad = typeof gutter === "number" ? gutter : gutter(el);
      const availW = el.clientWidth - pad;
      const availH = el.clientHeight - pad;
      if (availW < 40 || availH < 40) return;
      const w = Math.min(availW, availH * ratio);
      const next = { w: Math.floor(w), h: Math.floor(w / ratio) };
      setSize((prev) => (prev && prev.w === next.w && prev.h === next.h ? prev : next));
    };
    fit();
    const frame = requestAnimationFrame(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [ref, ratio, mountKey, gutter]);
  return size;
}
