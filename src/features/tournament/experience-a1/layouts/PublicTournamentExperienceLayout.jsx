import { Outlet } from "react-router-dom";

import { ClubProvider } from "../../../../context/ClubContext.jsx";
import { TenantProvider } from "../../../../context/TenantContext.jsx";

/** Minimal tenant/club scope for public tournament experience — no admin shell. */
export default function PublicTournamentExperienceLayout() {
  return (
    <TenantProvider>
      <ClubProvider>
        <Outlet />
      </ClubProvider>
    </TenantProvider>
  );
}
