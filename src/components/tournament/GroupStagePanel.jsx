import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { MATCH_STATUS } from "../../models/tournament/constants.js";
import { resolveEntryLabel } from "../../tournament/engines/tournamentDirectorEngine.js";
import { useScoreDrafts } from "../../tournament/useScoreDrafts.js";
import { touchButtonSx } from "./mobileUi.js";

function GroupMatchScoreRow({ match, entries, players, onSubmitScore, draft }) {
  const [localScoreA, setLocalScoreA] = useState(match.scoreA ?? "");
  const [localScoreB, setLocalScoreB] = useState(match.scoreB ?? "");

  const draftScores = draft ? draft.resolveScores(match.id, match) : null;
  const scoreA = draftScores ? draftScores.scoreA : localScoreA;
  const scoreB = draftScores ? draftScores.scoreB : localScoreB;

  const completed =
    match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.FORFEIT;
  const labelA = resolveEntryLabel(match.entryAId, entries, players);
  const labelB = resolveEntryLabel(match.entryBId, entries, players);

  const handleScoreChange = (field, value) => {
    if (draft) {
      draft.updateScores(match.id, match, { [field]: value });
      return;
    }

    if (field === "scoreA") {
      setLocalScoreA(value);
      return;
    }

    setLocalScoreB(value);
  };

  const handleSubmit = () => {
    const scores = { scoreA, scoreB };
    const ok = onSubmitScore(match.id, scores);
    if (draft && ok !== false) {
      draft.clearDraft(match.id);
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        bgcolor: completed ? "success.50" : "background.paper",
      }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="body2" fontWeight="bold" sx={{ wordBreak: "break-word", flex: 1 }}>
          {labelA} vs {labelB}
        </Typography>
        <Chip
          size="small"
          label={completed ? "Đã xong" : "Chờ điểm"}
          color={completed ? "success" : "default"}
        />
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="stretch">
        <TextField
          size="small"
          type="number"
          label={`Điểm ${labelA}`}
          value={scoreA}
          inputProps={{ min: 0, inputMode: "numeric" }}
          sx={{ flex: 1 }}
          onChange={(event) => handleScoreChange("scoreA", event.target.value)}
        />
        <TextField
          size="small"
          type="number"
          label={`Điểm ${labelB}`}
          value={scoreB}
          inputProps={{ min: 0, inputMode: "numeric" }}
          sx={{ flex: 1 }}
          onChange={(event) => handleScoreChange("scoreB", event.target.value)}
        />
        <Button
          size="large"
          variant="contained"
          sx={{ ...touchButtonSx, whiteSpace: "nowrap" }}
          onClick={handleSubmit}
        >
          Lưu điểm
        </Button>
      </Stack>
    </Paper>
  );
}

export default function GroupStagePanel({ event, players = [], onSubmitScore, draftScope }) {
  const draft = useScoreDrafts(draftScope);
  const groups = event?.groups || [];
  const entries = event?.entries || [];
  const groupMatches = (event?.matches || []).filter((match) => !match.bracketMatchId);

  if (!groups.length || !groupMatches.length) {
    return null;
  }

  const completedCount = groupMatches.filter(
    (match) =>
      match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.FORFEIT
  ).length;

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight="bold">
            Nhập điểm vòng bảng
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Đã hoàn thành {completedCount}/{groupMatches.length} trận. Điểm đang nhập được giữ
            khi chuyển tab. Khi nhập đủ, bracket knock-out sẽ được tạo tự động từ BXH.
          </Typography>
        </Box>
        <Chip label={`${completedCount}/${groupMatches.length} trận`} color="primary" />
      </Stack>

      <Stack spacing={2}>
        {groups.map((group) => {
          const matches = groupMatches.filter(
            (match) => String(match.groupId) === String(group.id)
          );

          if (!matches.length) {
            return null;
          }

          return (
            <Box key={group.id}>
              <Typography fontWeight="bold" sx={{ mb: 1 }}>
                {group.name || `Bảng ${group.label}`}
              </Typography>
              <Stack spacing={1}>
                {matches.map((match) => (
                  <GroupMatchScoreRow
                    key={match.id}
                    match={match}
                    entries={entries}
                    players={players}
                    onSubmitScore={onSubmitScore}
                    draft={draft}
                  />
                ))}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
