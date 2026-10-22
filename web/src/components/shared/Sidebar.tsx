import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { paths } from "../../router/paths";

const NAV: { to: string; label: string; end?: boolean; icon: ReactNode }[] = [
  {
    to: paths.home,
    label: "Inicio",
    end: true,
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M3.5 8.2 10 3l6.5 5.2V16a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V8.2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: paths.analysis,
    label: "Análisis",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 12.5h14M8.5 3v14" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: paths.history,
    label: "Historial",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6.5V10l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: paths.docs,
    label: "Documentación",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M5 3.5h7.5L15.5 6v10.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M12.5 3.5V6h2.5M7 9.5h6M7 12.5h6M7 15.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

interface Props {
  historyCount: number | null;
}

export function Sidebar({ historyCount }: Props) {
  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <div className="sidebar-brand">
        <img className="sidebar-mark" src="/favicon.svg" alt="" width="28" height="28" />
        <span className="sidebar-title">Tune</span>
        <span className="sidebar-tagline">Análisis satelital</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar-link${isActive ? " on" : ""}`}
          >
            <span className="sidebar-icon">
              {item.icon}
              {item.to === paths.history && historyCount != null && historyCount > 0 && (
                <span className="sidebar-badge num">{historyCount}</span>
              )}
            </span>
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
