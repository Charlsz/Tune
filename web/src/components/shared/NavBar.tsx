import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { NavLink, useLocation } from "react-router";
import { paths } from "../../router/paths";

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: paths.home, label: "Inicio", end: true },
  { to: paths.analysis, label: "Análisis" },
  { to: paths.history, label: "Historial" },
  { to: paths.docs, label: "Documentación" },
];

const MOBILE = "(max-width: 720px)";

interface Props {
  historyCount: number | null;
}

function Count({ show, value }: { show: boolean; value: number | null }) {
  if (!show || value == null || value <= 0) return null;
  return <span className="topbar-count num">{value}</span>;
}

export function NavBar({ historyCount }: Props) {
  const navRef = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const mark = markRef.current;
    if (!nav || !mark) return;

    const move = () => {
      const active = nav.querySelector<HTMLElement>(".topbar-link.on");
      if (!active) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap.to(mark, {
        x: active.offsetLeft,
        width: active.offsetWidth,
        duration: reduce ? 0 : 0.35,
        ease: "power2.out",
        overwrite: true,
      });
    };

    move();
    const observer = new ResizeObserver(move);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [pathname, historyCount]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const query = window.matchMedia(MOBILE);
    const onChange = () => {
      if (!query.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!shown) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [shown]);

  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !shown) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (open) {
        gsap.fromTo(
          sheet,
          { clipPath: "inset(0 0 100% 0)" },
          { clipPath: "inset(0 0 0% 0)", duration: reduce ? 0 : 0.5, ease: "power3.out" },
        );
        gsap.fromTo(
          ".nav-sheet-link",
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: reduce ? 0 : 0.45,
            stagger: 0.07,
            delay: reduce ? 0 : 0.12,
            ease: "power2.out",
          },
        );
        return;
      }
      gsap.to(sheet, {
        clipPath: "inset(0 0 100% 0)",
        duration: reduce ? 0 : 0.32,
        ease: "power2.in",
        onComplete: () => setShown(false),
      });
    }, sheet);
    return () => ctx.revert();
  }, [open, shown]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openMenu() {
    setShown(true);
    setOpen(true);
  }

  return (
    <header className={`topbar${open ? " is-open" : ""}`}>
      <NavLink to={paths.home} end className="topbar-brand">
        <img className="topbar-icon" src="/favicon.svg" alt="" width={22} height={22} />
        <span>Tune</span>
      </NavLink>
      <nav className="topbar-nav" ref={navRef} aria-label="Navegación principal">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `topbar-link${isActive ? " on" : ""}`}
          >
            {item.label}
            <Count show={item.to === paths.history} value={historyCount} />
          </NavLink>
        ))}
        <span className="topbar-mark" ref={markRef} aria-hidden="true" />
      </nav>
      <button
        type="button"
        className="topbar-burger"
        aria-expanded={open}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        {open ? (
          <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M5 5l12 12M17 5 5 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M3 6.5h16M3 11h16M3 15.5h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {shown && (
        <div id="nav-sheet" className="nav-sheet" role="dialog" aria-modal="true" aria-label="Navegación" ref={sheetRef}>
          <nav className="nav-sheet-list">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-sheet-link${isActive ? " on" : ""}`}
                onClick={() => setOpen(false)}
              >
                {item.label}
                <Count show={item.to === paths.history} value={historyCount} />
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
