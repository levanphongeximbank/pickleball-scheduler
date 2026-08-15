import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import LockIcon from "@mui/icons-material/Lock";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { assertLoadedTournamentAccess } from "../../features/tournament/guards/tournamentAccess.js";
import { shouldBlockTournamentManageGate } from "../../features/tournament/guards/tournamentManageGatePolicy.js";
import { useCanonicalTournament } from "../../features/tournament/hooks/useCanonicalTournament.js";
import { resolveTournamentManageGatePresentation } from "../../features/tournament/internal/internalWorkspaceSections.js";

function AccessDenied({ title, message, to = "/tournament" }) {
  return (
    <Box sx={{ p: 3, maxWidth: 480 }}>
      <Stack spacing={2} alignItems="flex-start">
        <LockIcon color="warning" fontSize="large" />
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
        <Button component={RouterLink} to={to} variant="contained">
          Về trang Giải đấu
        </Button>
      </Stack>
    </Box>
  );
}

/**
 * Chặn trang setup giải khi RBAC bật:
 * - không có TOURNAMENT_UPDATE
 * - tournament không thuộc tenant hiện tại (cloud authority)
 */
export default function TournamentManageGate({
  children,
  tournamentId = null,
  tournament: tournamentProp = null,
  loadedTournament = null,
}) {
  const { rbacEnabled, isAuthenticated, can } = useAuth();
  const { activeClub, activeClubId } = useClub();
  const { currentTenantId } = useTenant();
  const { tournament: fetchedTournament, loading } = useCanonicalTournament(
    activeClub,
    tournamentId
  );
  const tournament = tournamentProp || loadedTournament || fetchedTournament;
  const presentation = resolveTournamentManageGatePresentation({
    tournamentId,
    loading,
    tournament,
    activeClubId,
  });

  if (!rbacEnabled || !isAuthenticated) {
    return children;
  }

  if (
    presentation.showFullPageLoading ||
    shouldBlockTournamentManageGate({
      rbacEnabled,
      isAuthenticated,
      tournamentId,
      loading,
      tournament,
    })
  ) {
    return (
      <Box sx={{ p: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (presentation.keepChildren) {
    return children;
  }

  if (presentation.assertAccess && tournamentId) {
    const tournamentAccess = assertLoadedTournamentAccess(activeClubId, tournament, {
      tenantId: currentTenantId,
    });
    if (!tournamentAccess.ok) {
      return (
        <AccessDenied
          title="Không thể truy cập giải này"
          message={
            tournamentAccess.error ||
            "Giải đấu không thuộc tenant hiện tại hoặc bạn không có quyền."
          }
        />
      );
    }
  }

  const allowed = can(PERMISSIONS.TOURNAMENT_UPDATE, {
    clubId: activeClubId,
    venueId: currentTenantId,
    tenantId: currentTenantId,
  });

  if (allowed) {
    return children;
  }

  return (
    <AccessDenied
      title="Không có quyền quản lý giải"
      message="Vai trò hiện tại không được phép cấu hình giải đấu. Liên hệ chủ CLB hoặc quản lý sân."
    />
  );
}
