import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { useLocation } from "react-router";

export function Enter({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const root = ref.current;
    const page = root?.querySelector<HTMLElement>(".page");
    if (!root || !page) return;
    const ctx = gsap.context(() => {
      const nodes = page.children;
      if (!nodes.length) return;
      const keepLayout = page.classList.contains("page-docs") || page.classList.contains("page-miss");
      gsap.fromTo(
        nodes,
        keepLayout ? { autoAlpha: 0 } : { autoAlpha: 0, y: 12 },
        {
          autoAlpha: 1,
          ...(keepLayout ? {} : { y: 0 }),
          duration: 0.5,
          stagger: 0.05,
          ease: "power2.out",
          overwrite: true,
        },
      );
    }, root);

    return () => ctx.revert();
  }, [pathname]);

  return (
    <div className="enter" ref={ref}>
      {children}
    </div>
  );
}
