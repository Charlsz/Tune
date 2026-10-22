import { Link } from "react-router";
import { paths } from "../router/paths";

export function NotFound() {
  return (
    <main className="page">
      <div className="empty-state">
        <div className="empty-copy">
          <p className="welcome-title">Página no encontrada</p>
          <p className="caption">
            Esa dirección no existe. Vuelve a Inicio o elige otra vista en la barra.
          </p>
          <Link to={paths.home} className="primary">
            Ir a Inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
