import { Alert, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import {
  evaluateOfficialCloseGate,
} from "../../../features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";
import { resolveOfficialChampion } from "../../../features/individual-tournament/engines/officialCompletionEngine.js";
import { buildTournamentSummary } from "../../../features/individual-tournament/engines/tournamentClosingEngine.js";

/**
 * Official close stage — one completion command (server CAS + idempotency).
 */
export default function OfficialTournamentCloseOps({
  tournament,
  eventId = "",
  canManage = true,
  onPersistTournament,
  onMessage,
  onError,
}) {
  const gate = evaluateOfficialCloseGate(tournament, { eventId });
  const champion = resolveOfficialChampion(tournament);
  const summary = buildTournamentSummary(tournament);

  const handleClose = async () => {
    if (!canManage) return;
    if (!gate.ok && !gate.alreadyCompleted) {
      onError?.(gate.error);
      return;
    }
    const saved = await onPersistTournament?.(tournament);
    if (!saved || saved.ok === false) {
      onError?.(saved?.error || "Không đóng được giải trên cloud.");
      return;
    }
    const name = saved.championName || champion.championName;
    onMessage?.(name ? `Đã đóng giải. Vô địch: ${name}` : "Đã đóng giải.");
  };

  return (
    <Stack spacing={2}>
      {champion.ok ? (
        <Alert severity="success">
          Vô địch (Chung kết): <strong>{champion.championName}</strong>
          {champion.runnerUpName ? <> · Á quân: <strong>{champion.runnerUpName}</strong></> : null}
        </Alert>
      ) : (
        <Alert severity="info">
          Vô địch chỉ được ghi nhận từ trận Chung kết đã hoàn tất — không lấy từ BXH bảng.
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary">
        Trận hoàn tất: {summary.completedMatchCount}/{summary.matchCount}
      </Typography>

      {!gate.ok && !gate.alreadyCompleted ? <Alert severity="warning">{gate.error}</Alert> : null}

      <Button
        variant="contained"
        color="error"
        disabled={!canManage || (!gate.ok && !gate.alreadyCompleted)}
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
        Mở trang giải thưởng (không bắt buộc để đóng Official)
      </Button>
    </Stack>
  );
}
