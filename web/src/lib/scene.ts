import { useEffect, useState } from "react";
import type { Analysis } from "../types";

// Reconstruye la clase de cada píxel a partir de los PNG que guarda la API:
// alfa de preview.png = píxel válido, alfa de mask.png = clase positiva.
export interface Scene {
  id: string;
  w: number;
  h: number;
  valid: Uint8Array;
  positive: Uint8Array;
  base: HTMLCanvasElement;
  classes: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  cols: Float32Array;
  rows: Float32Array;
}

const MAX_SIDE = 4096;
const INK: [number, number, number, number] = [17, 17, 17, 255];
const CLEAR: [number, number, number, number] = [253, 253, 252, 255];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    img.src = src;
  });
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })!];
}

function pixels(img: HTMLImageElement, w: number, h: number): Uint8ClampedArray {
  const [, ctx] = canvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

async function build(a: Analysis): Promise<Scene> {
  const mask = await loadImage(a.artifacts.mask_png);
  const rgb = a.artifacts.preview_png ? await loadImage(a.artifacts.preview_png).catch(() => null) : null;
  const scale = Math.min(1, MAX_SIDE / Math.max(mask.naturalWidth, mask.naturalHeight));
  const w = Math.round(mask.naturalWidth * scale);
  const h = Math.round(mask.naturalHeight * scale);
  const m = pixels(mask, w, h);
  const p = rgb ? pixels(rgb, w, h) : null;

  const n = w * h;
  const valid = new Uint8Array(n);
  const positive = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    positive[i] = m[i * 4 + 3] > 0 ? 1 : 0;
    valid[i] = p ? (p[i * 4 + 3] > 0 ? 1 : 0) : 1;
  }

  const [base, baseCtx] = canvas(w, h);
  const [classes, classesCtx] = canvas(w, h);
  const [overlay, overlayCtx] = canvas(w, h);
  const bImg = baseCtx.createImageData(w, h);
  const cImg = classesCtx.createImageData(w, h);
  const oImg = overlayCtx.createImageData(w, h);
  const cols = new Float32Array(w);
  const rows = new Float32Array(h);
  const colValid = new Uint32Array(w);
  const rowValid = new Uint32Array(h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      if (p) {
        bImg.data[o] = p[o];
        bImg.data[o + 1] = p[o + 1];
        bImg.data[o + 2] = p[o + 2];
        bImg.data[o + 3] = p[o + 3];
      } else if (valid[i]) {
        bImg.data.set(CLEAR, o);
      }
      if (valid[i]) {
        cImg.data.set(CLEAR, o);
        colValid[x]++;
        rowValid[y]++;
      }
      if (positive[i]) {
        oImg.data.set(INK, o);
        cols[x]++;
        rows[y]++;
      }
    }
  }
  for (let x = 0; x < w; x++) cols[x] = colValid[x] ? cols[x] / colValid[x] : 0;
  for (let y = 0; y < h; y++) rows[y] = rowValid[y] ? rows[y] / rowValid[y] : 0;

  baseCtx.putImageData(bImg, 0, 0);
  classesCtx.putImageData(cImg, 0, 0);
  overlayCtx.putImageData(oImg, 0, 0);

  return { id: a.id, w, h, valid, positive, base, classes, overlay, cols, rows };
}

export function useScene(a: Analysis | null): { scene: Scene | null; error: string | null } {
  const [scene, setScene] = useState<Scene | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScene(null);
    setError(null);
    if (!a) return;
    let alive = true;
    build(a)
      .then((s) => alive && setScene(s))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [a]);

  return { scene: scene && a && scene.id === a.id ? scene : null, error };
}
