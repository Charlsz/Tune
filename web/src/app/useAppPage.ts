import { useLocation } from "react-router";
import { pageFromPath, type AppPage } from "./paths";

/** Página activa derivada de la URL (fuente de verdad de los tabs). */
export function useAppPage(): AppPage {
  const { pathname } = useLocation();
  return pageFromPath(pathname);
}
