import { useEffect, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { Alert, Box } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import {
  canAccessRefereeSession,
  listRefereeAssignments,
} from "../../features/identity/services/refereeSessionService.js";
import { guardRefereeSessionRoute } from "../../features/mobile/services/refereeMatchGuard.js";
import RefereeScoreboard from "./RefereeScoreboard.jsx";

/**
 * Chấm điểm qua session REFEREE — token lấy từ state (không hiện trên URL).
 */
export default function RefereeSessionScoreboard() {
  const { matchId } = useParams();
  const location = useLocation();
  const { user, rbacEnabled } = useAuth();
  const { activeClubId, activeClub } = useClub();

  const refereeToken = location.state?.refereeToken;
  const [assignmentGuard, setAssignmentGuard] = useState({ ok: true, loading: true });

  useEffect(() => {
    let cancelled = false;

    async function verifyAssignment() {
      if (!matchId || !user) {
        setAssignmentGuard({ ok: false, loading: false, code: "UNAUTHORIZED" });
        return;
      }

      const result = await listRefereeAssignments({ clubId: activeClubId });
      if (cancelled) {
        return;
      }

      const guard = guardRefereeSessionRoute({
        user,
        matchId,
        assignments: result.ok ? result.matches : [],
        scope: { clubId: activeClubId, venueId: activeClub?.venueId },
      });

      setAssignmentGuard({ ...guard, loading: false });
    }

    verifyAssignment();
    return () => {
      cancelled = true;
    };
  }, [activeClub?.venueId, activeClubId, matchId, user]);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const allowed = canAccessRefereeSession(user, {
    clubId: activeClubId,
    venueId: activeClub?.venueId,
  });

  if (rbacEnabled && !allowed) {
    return <Navigate to="/403" replace />;
  }

  if (assignmentGuard.loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Đang kiểm tra phân công trận...</Alert>
      </Box>
    );
  }

  if (!assignmentGuard.ok) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {assignmentGuard.error || "Bạn không được phân công trận này."}{" "}
          <a href="/referee">Quay lại danh sách</a>
        </Alert>
      </Box>
    );
  }

  if (!refereeToken) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Không tìm thấy phiên trận đấu. Quay lại{" "}
          <a href="/referee">danh sách trọng tài</a> và chọn trận (match {matchId}).
        </Alert>
      </Box>
    );
  }

  return <RefereeScoreboard sessionToken={refereeToken} sessionMode />;
}
