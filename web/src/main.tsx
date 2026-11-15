import "@fontsource-variable/inter";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import MapApp from "./MapApp";
import "./styles/tokens.css";
import "./styles/map.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MapApp />
  </StrictMode>,
);
