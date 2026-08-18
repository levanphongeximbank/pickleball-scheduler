import { BrowserRouter, Routes } from "react-router-dom";

import { PrototypeExperienceLayoutRoute } from "./prototypeExperienceRoutes.jsx";

/**
 * Isolated Tournament Experience prototype router.
 * Must not import production App / Auth / MainLayout / court-resource.
 */
export default function TournamentExperiencePrototypeApp() {
  return (
    <BrowserRouter>
      <Routes>{PrototypeExperienceLayoutRoute()}</Routes>
    </BrowserRouter>
  );
}
