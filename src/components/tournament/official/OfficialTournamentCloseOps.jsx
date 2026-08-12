import { Alert, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import {
  evaluateOfficialCloseGate,
} from "../../../features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";
import {
  closeTournament,
  buildTournamentSummary,
} from "../../../features/individual-tournament/engines/tournamentClosingEngine.js";
import { buildAwardsPreview, AWARD_KEY } from "../../../features/individual-tournament/engines/awardsEngine.js";

/**
 * Official close stage — competition completion via closeTournament only.
 * VPR remains post-completion reconciliation (not a second close authority).
 */
export default function OfficialTournamentCloseOps({
  tournament,
  eventId = "",
  canManage = true,
  onPersistTournament,
  onMessage,
  onError,
}) {
  const gate = evaluateOfficialCloseGate(tournament);
  const awardsPreview = buildAwardsPreview(tournament, { eventId });
  const awards = Array.isArray(awardsPreview)
    ? awardsPreview
    : awardsPreview?.awards || [];
  const champion = awards.find((item) => item.key === AWARD_KEY.CHAMPION);
  const summary = buildTournamentSummary(tournament);

  const handleClose = async () => {
    if (!canManage) return;
    const result = closeTournament(tournament, {
      autoAwards: true,
      actor: null,
      reason: "official_control_center_close",
    });
    if (!result.ok) {
      onError?.(result.error);
      return;
    }
    const saved = await onPersistTournament?.(result.tournament);
    if (!saved) {
      onError?.("Đã tính đóng giải nhưng không lưu được lên cloud.");
      return;
    }
    onMessage?.(
      result.summary?.champion?.entryName || result.summary?.champion?.name
        ? `Đã đóng giải. Vô địch: ${
            result.summary.champion.entryName || result.summary.champion.name
          }`
        : "Đã đóng giải."
    );
  };

  return (
    <Stack spacing={2}>
      {champion ? (
        <Alert severity="success">
          Vô địch hiện tại: <strong>{champion.entryName || champion.name}</strong>
        </Alert>
      ) : (
        <Alert severity="info">Chưa xác định vô địch — sẽ gán tự động khi đóng nếu đủ dữ liệu.</Alert>
      )}

      <Typography variant="body2" color="text.secondary">
        Trận hoàn tất: {summary.completedMatchCount}/{summary.matchCount}
      </Typography>

      {!gate.ok ? <Alert severity="warning">{gate.error}</Alert> : null}

      <Button
        variant="contained"
        color="error"
        disabled={!canManage || !gate.ok}
        onClick={handleClose}
      >
        Đóng giải (canonical)
      </Button>

      <Button
        component={RouterLink}
        to={`/tournament/awards?tournamentId=${encodeURIComponent(tournament?.id || "")}`}
        variant="outlined"
        size="small"
      >
        Mở trang giải thưởng / đóng giải chi tiết
      </Button>

      <Alert severity="info" icon={false}>
        VPR (nếu bật) là bước đối soát sau đóng giải — không phải authority đóng giải thứ hai.
      </Alert>
    </Stack>
  );
}
