export type NavId = "home" | "analysis" | "history" | "docs";

const NAV: { id: NavId; label: string; icon: React.ReactNode }[] = [
  {
    id: "home",
    label: "Inicio",
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
    id: "analysis",
    label: "Análisis",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 12.5h14M8.5 3v14" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "history",
    label: "Historial",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6.5V10l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "docs",
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
  active: NavId;
  onNavigate: (id: NavId) => void;
  historyCount: number | null;
}

export function Sidebar({ active, onNavigate, historyCount }: Props) {
  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <div className="sidebar-brand">
        <img className="sidebar-mark" src="/favicon.svg" alt="" width="28" height="28" />
        <span className="sidebar-title">Tune</span>
        <span className="sidebar-tagline">Análisis satelital</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-link${active === item.id ? " on" : ""}`}
            aria-current={active === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-icon">
              {item.icon}
              {item.id === "history" && historyCount != null && historyCount > 0 && (
                <span className="sidebar-badge num">{historyCount}</span>
              )}
            </span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
