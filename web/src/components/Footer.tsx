const PEOPLE = [
  {
    name: "Carlos Andrés Galvis Pájaro",
    links: [
      { name: "GitHub", href: "https://github.com/Charlsz" },
      { name: "LinkedIn", href: "https://www.linkedin.com/in/cgalvisp/" },
      { name: "X", href: "https://x.com/charlswfeelings" },
    ],
  },
  {
    name: "Zenen Contreras Royero",
    links: [
      { name: "GitHub", href: "https://github.com/zenencontreras" },
      { name: "LinkedIn", href: "https://www.linkedin.com/in/zenencontreras/" },
      { name: "X", href: "https://x.com/zenendev" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="foot">
      <p>Estudiantes de la Universidad del Norte.</p>
      <ul className="people">
        {PEOPLE.map((person) => (
          <li key={person.name} className="person">
            <span>{person.name}</span>
            <span className="socials">
              {person.links.map((link) => (
                <a key={link.name} href={link.href} target="_blank" rel="noreferrer" aria-label={`${link.name} de ${person.name}`}>
                  <Mark name={link.name} />
                </a>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </footer>
  );
}

function Mark({ name }: { name: "GitHub" | "LinkedIn" | "X" }) {
  if (name === "GitHub") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 .5C5.37.5.5 5.37.5 12a11.5 11.5 0 0 0 7.86 10.91c.58.1.79-.25.79-.56v-2.17c-3.2.7-3.88-1.36-3.88-1.36-.53-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A10.51 10.51 0 0 0 23.5 12C23.5 5.37 18.63.5 12 .5z" />
      </svg>
    );
  }
  if (name === "LinkedIn") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.98 3.5A2.5 2.5 0 1 1 0 3.5a2.5 2.5 0 0 1 4.98 0zM.5 8.5h4V24h-4V8.5zM8.5 8.5h3.8v2.1h.05c.53-1 1.84-2.1 3.79-2.1 4.05 0 4.8 2.67 4.8 6.14V24h-4v-7.7c0-1.84-.03-4.2-2.56-4.2-2.56 0-2.95 2-2.95 4.06V24h-4V8.5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
