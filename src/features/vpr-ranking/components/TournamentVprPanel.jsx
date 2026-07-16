import { useState } from "react";
import {
  Alert,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import { updateTournament } from "../../../domain/tournamentService.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { updateTeamTournamentClassification } from "../../team-tournament/services/teamTournamentService.js";
import TournamentLevelSelect from "./TournamentLevelSelect.jsx";
import {
  applyTournamentLevelPatch,
  confirmTournamentResults,
  onTournamentSaved,
} from "../services/vprTournamentBridge.js";

function isTeamTournamentMode(tournament) {
  return (
    String(tournament?.mode || "") === TOURNAMENT_MODE.TEAM_TOURNAMENT ||
    Boolean(tournament?.teamData)
  );
}

export default function TournamentVprPanel({
  clubId,
  tournament,
  onUpdated,
  canEdit = true,
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  if (!tournament) {
    return null;
  }

  const handleLevelChange = async (nextLevel) => {
    setError(null);
    setMessage(null);

    if (isTeamTournamentMode(tournament)) {
      const result = await updateTeamTournamentClassification(
        clubId,
        tournament.id,
        nextLevel
      );
      if (!result.ok) {
        setError(
          result.error ||
            "Không lưu được phân loại giải. Cloud chưa ghi nhận — không báo thành công."
        );
        return;
      }
      // cloud_primary: never claim success without durable cloud write.
      if (result.cloudSynced !== true && result.cloudRequired === true) {
        setError(
          result.error ||
            "Không lưu được phân loại giải lên cloud — không báo thành công local-only."
        );
        return;
      }
      onUpdated?.(result.tournament);
      await onTournamentSaved(clubId, result.tournament);
      setMessage(
        result.cloudSynced
          ? "Đã lưu phân loại giải lên cloud."
          : "Đã lưu phân loại giải (local)."
      );
      return;
    }

    const patch = applyTournamentLevelPatch(tournament, nextLevel);
    const result = updateTournament(clubId, tournament.id, patch);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onUpdated?.(result.tournament);
    await onTournamentSaved(clubId, result.tournament);
    setMessage("Đã gửi yêu cầu xác thực giải (nếu áp dụng VPR).");
  };

  const handleConfirmResults = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await confirmTournamentResults(clubId, tournament.id, {
      actorUserId: user?.id || null,
      force: false,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Không thể xác nhận kết quả.");
      return;
    }
    onUpdated?.(result.tournament);
    if (result.award?.ok && !result.award?.skipped) {
      setMessage(`Đã kết thúc giải và cộng điểm VPR (${result.award.entries || 0} bản ghi).`);
    } else if (result.award?.reason) {
      setMessage(`Đã kết thúc giải. VPR: ${result.award.reason}.`);
    } else {
      setMessage("Đã xác nhận kết quả và kết thúc giải.");
    }
  };

  const canConfirm =
    tournament.status === TOURNAMENT_STATUS.ACTIVE &&
    tournament.resultsConfirmation?.confirmed !== true;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle2" fontWeight={700}>
          Pick_VN Ranking (VPR)
        </Typography>
        <TournamentLevelSelect
          value={tournament.tournamentLevel}
          onChange={handleLevelChange}
          certificationStatus={tournament.certificationStatus}
          rankingEnabled={tournament.rankingEnabled}
          disabled={!canEdit || busy}
        />
        {tournament.resultsConfirmation?.confirmed && (
          <Alert severity="success" variant="outlined">
            Kết quả đã xác nhận lúc{" "}
            {new Date(tournament.resultsConfirmation.confirmedAt).toLocaleString("vi-VN")}
          </Alert>
        )}
        {canConfirm && canEdit && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<CheckCircleIcon />}
            disabled={busy}
            onClick={handleConfirmResults}
          >
            Xác nhận kết quả &amp; kết thúc giải
          </Button>
        )}
        {message && (
          <Alert severity="info" onClose={() => setMessage(null)}>
            {message}
          </Alert>
        )}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
