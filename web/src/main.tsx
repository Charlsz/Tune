import "@fontsource-variable/inter";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRouter } from "./router/AppRouter";
import "./styles/tokens.css";
import "./styles.css";
import "./styles/shell.css";
import "./styles/docs.css";
import "./styles/motion.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
