import { Outlet } from "react-router-dom";

import { ClubProvider } from "../../../../context/ClubContext.jsx";

/** Minimal club scope for public tournament experience — no admin shell. */
export default function PublicTournamentExperienceLayout() {
  return (
    <ClubProvider>
      <Outlet />
    </ClubProvider>
  );
}
