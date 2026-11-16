import "@fontsource-variable/inter";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import MapApp from "./MapApp";
import "./styles/tokens.css";
import "./styles/map.css";

// Entrada de producción: MapApp. La SPA con router (HomeScreen, Docs, etc.)
// queda en código no montado; ver web/src/legacy/README.md.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MapApp />
  </StrictMode>,
);
