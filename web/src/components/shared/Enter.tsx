import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

const SEEN = "tune-entered";

export function Enter({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      sessionStorage.setItem(SEEN, "1");
      return;
    }
    if (sessionStorage.getItem(SEEN) === "1") return;

    const nodes = root.querySelectorAll(
      ".home > *, .history-section > *, .docs-page > *, .analysis-layout",
    );
    if (nodes.length === 0) {
      sessionStorage.setItem(SEEN, "1");
      return;
    }

    const ctx = gsap.context(() => {
      gsap.from(nodes, {
        y: 8,
        opacity: 0,
        duration: 0.5,
        stagger: 0.05,
        ease: "power2.out",
        onComplete: () => sessionStorage.setItem(SEEN, "1"),
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div className="enter" ref={ref}>
      {children}
    </div>
  );
}
