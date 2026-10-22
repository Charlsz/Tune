import { BrowserRouter, Route, Routes } from "react-router";
import { App } from "../App";
import { AnalysisPage } from "../pages/AnalysisPage";
import { DocsPage } from "../pages/DocsPage";
import { HistoryPage } from "../pages/HistoryPage";
import { HomePage } from "../pages/HomePage";
import { NotFound } from "../pages/NotFound";
import { paths } from "./paths";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path={paths.home} element={<HomePage />} />
          <Route path={paths.analysis} element={<AnalysisPage />} />
          <Route path={paths.history} element={<HistoryPage />} />
          <Route path={paths.docs} element={<DocsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
