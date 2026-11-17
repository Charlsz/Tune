import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import MapApp from "./app/MapApp";
import "./index.css";

// Un solo MapApp montado: el estado vive en MapAppProvider y la URL solo cambia el tab.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <MapApp />
    </BrowserRouter>
  </StrictMode>,
);
