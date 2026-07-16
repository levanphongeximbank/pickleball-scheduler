import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import {
  showcaseActionsSx,
  showcaseCardSx,
  showcaseMutedSx,
  showcaseTitleSx,
} from "./showcaseStyles.js";
import { SHOWCASE_COPY } from "./showcaseConstants.js";

export default function ShowcaseFinalReview({
  session,
  saving,
  saveError,
  onConfirm,
  onBackTeams,
  onBackGroups,
  onCancel,
  readOnly,
}) {
  const teams = session?.teamCards || [];
  const groups = session?.groupSession?.groupCards || [];
  const waiting = session?.waitingPlayerIds || [];

  return (
    <Stack spacing={3}>
      <Typography component="h1" sx={showcaseTitleSx}>
        Xác nhận kết quả trước khi lưu
      </Typography>

      <Box sx={showcaseCardSx}>
        <Stack spacing={1}>
          <Box>
            <strong>{teams.length}</strong> đội ·{" "}
            <strong>
              {teams.reduce((sum, t) => sum + (t.athletes?.length || 0), 0)}
            </strong>{" "}
            VĐV · <strong>{groups.length}</strong> bảng
          </Box>
          <Box sx={showcaseMutedSx}>
            engineVersion: {session?.engineVersion || "—"} · rulesVersion:{" "}
            {session?.rulesVersion || "—"} · generatedAt: {session?.generatedAt || "—"}
          </Box>
          <Box sx={showcaseMutedSx}>
            Chờ: {waiting.length ? waiting.join(", ") : "0"}
          </Box>
        </Stack>
      </Box>

      <Box sx={showcaseCardSx}>
        <Typography fontWeight={800} mb={1}>
          Đội & đội trưởng
        </Typography>
        {teams.map((team) => (
          <Box key={team.id} mb={1}>
            <strong>{team.name}</strong> — TB {Number(team.avgLevel || 0).toFixed(2)} — ĐT:{" "}
            {team.athletes?.find((a) => a.isCaptain)?.name || SHOWCASE_COPY.missingCaptain}
            <Box sx={showcaseMutedSx}>
              {(team.athletes || [])
                .map((a) => `${a.name} (${a.genderLabel} ${Number(a.ratingValue || 0).toFixed(1)})`)
                .join(" · ")}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={showcaseCardSx}>
        <Typography fontWeight={800} mb={1}>
          Bảng
        </Typography>
        {groups.map((group) => (
          <Box key={group.id} mb={1}>
            <strong>{group.name}</strong> — TB {Number(group.avgRating || 0).toFixed(2)}
            <Box sx={showcaseMutedSx}>{(group.teams || []).map((t) => t.name).join(" · ")}</Box>
          </Box>
        ))}
      </Box>

      {saveError ? <Alert severity="error">{saveError}</Alert> : null}

      <Box sx={showcaseActionsSx}>
        {!readOnly ? (
          <Button
            variant="contained"
            color="success"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving ? "Đang lưu…" : SHOWCASE_COPY.confirmSave}
          </Button>
        ) : null}
        <Button variant="outlined" color="inherit" onClick={onBackTeams} disabled={saving}>
          Quay lại xem đội
        </Button>
        <Button variant="outlined" color="inherit" onClick={onBackGroups} disabled={saving}>
          Quay lại xem bảng
        </Button>
        {!readOnly ? (
          <Button variant="text" color="inherit" onClick={onCancel} disabled={saving}>
            {SHOWCASE_COPY.cancelUnsaved}
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}
