import { useState } from "react";
import { Button, Stack, Typography } from "@mui/material";
import VerifiedIcon from "@mui/icons-material/Verified";

import { useAuth } from "../../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { getPlayerCurrentRating } from "../../../models/player.js";
import PickVnRatingBadge from "./PickVnRatingBadge.jsx";
import { isVerifiedRatingStatus, normalizeRatingStatus } from "../constants/ratingStatus.js";
import { verifyTournamentPlayerRating } from "../services/ratingVerificationService.js";

export function resolveTournamentEntryPlayers(entry, playerPool = []) {
  const pool = new Map(playerPool.map((player) => [String(player.id), player]));
  return (entry?.playerIds || [])
    .map((id) => pool.get(String(id)))
    .filter(Boolean);
}

export default function TournamentRegistrationRatingPanel({
  players = [],
  tournamentId = null,
  hostClubId = null,
  onVerified = null,
  compact = false,
}) {
  const { can, rbacEnabled, isAuthenticated, user } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);

  const canVerify =
    !rbacEnabled ||
    !isAuthenticated ||
    can(PERMISSIONS.SKILL_LEVEL_VERIFY_TOURNAMENT, {
      clubId: hostClubId,
      tournamentId,
    });

  if (!players.length) {
    return null;
  }

  const handleVerify = async (player) => {
    const clubId = player.sourceClubId || hostClubId;
    if (!clubId) {
      setMessage("Không xác định được CLB của VĐV.");
      return;
    }

    const rating = getPlayerCurrentRating(player);
    setBusyId(player.id);
    setMessage(null);

    const result = verifyTournamentPlayerRating(clubId, player.id, rating, {
      verifiedBy: user?.id || null,
      tournamentId,
      authUserId: player.authUserId || null,
      note: "BTC xác thực lúc đăng ký giải",
    });

    setBusyId(null);

    if (!result.ok) {
      setMessage(result.error || "Không thể xác thực trình.");
      return;
    }

    setMessage(`Đã xác thực ${player.name}.`);
    onVerified?.(result);
  };

  return (
    <Stack spacing={compact ? 0.75 : 1}>
      {players.map((player) => {
        const status = normalizeRatingStatus(
          player.rating_status ?? player.ratingStatus
        );
        const verified = isVerifiedRatingStatus(status);
        const rating = getPlayerCurrentRating(player);

        return (
          <Stack
            key={player.id}
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
          >
            <Stack spacing={0.25}>
              {!compact ? (
                <Typography variant="caption" color="text.secondary">
                  {player.name}
                </Typography>
              ) : null}
              <PickVnRatingBadge
                rating={rating}
                status={status}
                confidence={player.rating_confidence ?? player.ratingConfidence}
                size="small"
              />
            </Stack>
            {canVerify && !verified ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<VerifiedIcon />}
                disabled={busyId === player.id}
                onClick={() => handleVerify(player)}
              >
                Xác thực
              </Button>
            ) : null}
          </Stack>
        );
      })}
      {message ? (
        <Typography variant="caption" color="text.secondary">
          {message}
        </Typography>
      ) : null}
    </Stack>
  );
}
