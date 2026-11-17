import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import MapApp from "./app/MapApp";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MapApp />
  </StrictMode>,
);
