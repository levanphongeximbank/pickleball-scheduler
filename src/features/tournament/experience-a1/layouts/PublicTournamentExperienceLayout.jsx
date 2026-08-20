import { Outlet } from "react-router-dom";

import { ClubProvider } from "../../../../context/ClubContext.jsx";
import { ClusterProvider } from "../../../../context/ClusterContext.jsx";
import { SeasonProvider } from "../../../../context/SeasonContext.jsx";
import { TenantProvider } from "../../../../context/TenantContext.jsx";
import { VenueProvider } from "../../../../context/VenueContext.jsx";

/** Minimal scope for public tournament experience — no admin shell. */
export default function PublicTournamentExperienceLayout() {
  return (
    <TenantProvider>
      <VenueProvider>
        <ClusterProvider>
          <ClubProvider>
            <SeasonProvider>
              <Outlet />
            </SeasonProvider>
          </ClubProvider>
        </ClusterProvider>
      </VenueProvider>
    </TenantProvider>
  );
}
