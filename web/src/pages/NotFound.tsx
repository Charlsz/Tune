import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { Link } from "react-router";
import { paths } from "../router/paths";

export function NotFound() {
  const stage = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = stage.current;
    if (!root) return;
    const cluster = root.querySelector(".miss-copy");
    if (!(cluster instanceof HTMLElement)) return;

    const xTo = gsap.quickTo(cluster, "x", { duration: 0.55, ease: "power3.out" });
    const yTo = gsap.quickTo(cluster, "y", { duration: 0.55, ease: "power3.out" });

    const onMove = (event: PointerEvent) => {
      const box = root.getBoundingClientRect();
      const dx = (event.clientX - (box.left + box.width / 2)) / Math.max(box.width, 1);
      const dy = (event.clientY - (box.top + box.height / 2)) / Math.max(box.height, 1);
      xTo(Math.max(-48, Math.min(48, dx * 72)));
      yTo(Math.max(-36, Math.min(36, dy * 54)));
    };
    const onLeave = () => {
      xTo(0);
      yTo(0);
    };

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".miss-line",
        { y: 10, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.06, ease: "power2.out" },
      );
    }, root);

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      ctx.revert();
    };
  }, []);

  return (
    <main className="page page-miss">
      <section className="miss" ref={stage} aria-labelledby="miss-title">
        <div className="miss-copy">
          <div className="miss-hero miss-line">
            <img className="miss-mark" src="/icons/tune-icon-animated.svg" alt="Tune Icon Animated" width={160} height={160} />
            <p className="miss-code" aria-hidden="true">
              404
            </p>
          </div>
          <h2 className="miss-title miss-line" id="miss-title">
            Esta coordenada no tiene escena
          </h2>
          <p className="miss-lead miss-line">
            Esa ruta no corresponde a ninguna vista de Tune. Vuelve al inicio para
            preparar una escena o abre un análisis del historial.
          </p>
          <Link className="primary miss-line" to={paths.home}>
            Volver a Inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
