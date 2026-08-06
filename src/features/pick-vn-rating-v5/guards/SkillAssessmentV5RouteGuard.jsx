import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

import { useAuth } from "../../../context/AuthContext.jsx";
import { isPickVnRatingV5Enabled } from "../config/flags.js";
import {
  evaluateSkillAssessmentV5RouteAccess,
  evaluateSkillAssessmentV5SyncAccess,
} from "../services/skillAssessmentV5RouteAccess.js";

/**
 * Phase 4 OD-B03 — pilot-aligned shadow guard for /player/skill-assessment-v5.
 * SUPER_ADMIN / PLATFORM_ADMIN allowed; PLAYER only with flag + enrollment; others 403.
 */
export default function SkillAssessmentV5RouteGuard({ children }) {
  const location = useLocation();
  const { user, isAuthenticated, authLoading } = useAuth();
  const [state, setState] = useState({ loading: true, ok: false, passToPage: false });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (authLoading) return;

      if (!isAuthenticated || !user?.id) {
        if (!cancelled) setState({ loading: false, ok: false, unauthenticated: true });
        return;
      }

      const sync = evaluateSkillAssessmentV5SyncAccess({
        user,
        flagEnabled: isPickVnRatingV5Enabled(),
      });

      if (sync.decision === "allow" || sync.decision === "controlled_unavailable") {
        if (!cancelled) {
          setState({
            loading: false,
            ok: true,
            passToPage: sync.decision === "controlled_unavailable",
          });
        }
        return;
      }

      if (sync.decision === "deny") {
        if (!cancelled) setState({ loading: false, ok: false });
        return;
      }

      const full = await evaluateSkillAssessmentV5RouteAccess({
        user,
        flagEnabled: isPickVnRatingV5Enabled(),
      });
      if (!cancelled) {
        setState({
          loading: false,
          ok: Boolean(full.ok),
          passToPage: Boolean(full.passToPage),
        });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, user]);

  if (authLoading || state.loading) {
    return (
      <Box sx={{ py: 8, display: "flex", justifyContent: "center" }} role="status">
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (state.unauthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!state.ok) {
    return <Navigate to="/403" replace state={{ from: location }} />;
  }

  return children;
}
