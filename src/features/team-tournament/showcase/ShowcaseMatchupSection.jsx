import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import {
  showcaseActionsSx,
  showcaseCardSx,
  showcaseMutedSx,
} from "./showcaseStyles.js";
import { SHOWCASE_COPY } from "./showcaseConstants.js";

export default function ShowcaseMatchupSection({
  matchupPreview,
  onGenerate,
  onConfirm,
  onContinueSchedule,
  generateDisabled,
  generateReason,
  confirmDisabled,
  confirmReason,
  saving = false,
}) {
  const matchups = matchupPreview?.matchups || [];
  const summary = matchupPreview?.summary;

  return (
    <Stack spacing={2}>
      <Typography fontWeight={800} fontSize="1.1rem">
        Cặp đấu (tùy chọn)
      </Typography>
      <Box sx={showcaseMutedSx}>
        Ghép cặp đấu = tạo team-vs-team trong từng bảng. Không tự động khi chỉ có bảng.
      </Box>

      {summary ? (
        <Box sx={showcaseCardSx}>
          <Box>
            Tổng cặp đấu: <strong>{summary.totalMatchups}</strong>
          </Box>
          {(summary.byGroup || []).map((group) => (
            <Box key={group.groupId} sx={showcaseMutedSx}>
              {group.groupName}: {group.matchupCount} trận
            </Box>
          ))}
        </Box>
      ) : null}

      {matchups.length > 0 ? (
        <Box sx={{ ...showcaseCardSx, maxHeight: 180, overflowY: "auto" }}>
          {matchups.slice(0, 12).map((matchup) => (
            <Box key={matchup.id} sx={showcaseMutedSx}>
              {matchup.teamAId} vs {matchup.teamBId}
              {matchup.groupId ? ` · ${matchup.groupId}` : ""}
            </Box>
          ))}
          {matchups.length > 12 ? (
            <Box sx={showcaseMutedSx}>… và {matchups.length - 12} cặp khác</Box>
          ) : null}
        </Box>
      ) : (
        <Alert severity="info">Chưa có preview cặp đấu.</Alert>
      )}

      <Box sx={showcaseActionsSx}>
        <Button
          variant="outlined"
          color="inherit"
          disabled={generateDisabled}
          title={generateReason || ""}
          onClick={onGenerate}
        >
          {SHOWCASE_COPY.generateMatchups}
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={confirmDisabled || saving}
          title={confirmReason || ""}
          onClick={onConfirm}
        >
          {SHOWCASE_COPY.confirmMatchups}
        </Button>
        {onContinueSchedule ? (
          <Button variant="text" color="inherit" onClick={onContinueSchedule}>
            {SHOWCASE_COPY.continueMatchups}
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}
