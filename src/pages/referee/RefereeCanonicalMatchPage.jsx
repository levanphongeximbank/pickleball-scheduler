import { useMemo } from "react";
import { Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { getSupabaseAuthClient } from "../../auth/supabaseClient.js";
import {
  createBrowserRefereeApplicationClient,
  RefereeMatchScreen,
  useCanonicalRefereeMatch,
} from "../../features/referee-production-ui/index.js";
import "../../features/referee-production-ui/styles/referee-production.css";

/**
 * Production One Referee Match Screen.
 * Deep-link: /referee/match/:matchId — location.state is never authority.
 */
export default function RefereeCanonicalMatchPage({ client: clientProp }) {
  const { matchId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();
  const { currentTenantId } = useTenant();

  const actor = useMemo(() => {
    if (!user?.id) return null;
    return {
      actorId: user.id,
      authUid: user.id,
      refereeId: user.id,
      role: "REFEREE",
    };
  }, [user]);

  const client = useMemo(() => {
    if (clientProp) return clientProp;
    return createBrowserRefereeApplicationClient({
      actor,
      env: typeof import.meta !== "undefined" ? import.meta.env : {},
      userClient: getSupabaseAuthClient(),
    });
  }, [actor, clientProp]);

  const competitionId = searchParams.get("competitionId");
  const competitionMode = searchParams.get("mode");

  const match = useCanonicalRefereeMatch({
    client,
    matchId,
    tenantId: currentTenantId,
    actor,
    competitionId,
    competitionMode,
  });

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <RefereeMatchScreen
      view={match.view}
      loading={match.loading}
      error={match.error}
      pendingAction={match.pendingAction}
      stale={match.stale}
      onStart={match.startMatch}
      onPointA={() => match.submitPoint("SIDE_A")}
      onPointB={() => match.submitPoint("SIDE_B")}
      onChangeServe={match.changeServe}
      onUndoLastScoringAction={match.undoLastScoringAction}
      onSuspend={match.suspendMatch}
      onResume={match.resumeMatch}
      onChangeEnds={match.confirmChangeEnds}
      onSwitchPositions={match.switchPositions}
      onConfigureLineup={match.configureLineup}
      onSubmitResult={() => match.submitResult(false)}
      onCorrect={match.correctResult}
      onReload={match.reload}
    />
  );
}
