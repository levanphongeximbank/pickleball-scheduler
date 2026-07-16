import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import {
  showcaseActionsSx,
  showcaseCardSx,
  showcaseMutedSx,
  showcaseTitleSx,
} from "./showcaseStyles.js";
import { SHOWCASE_COPY } from "./showcaseConstants.js";

export default function ShowcaseGroupPreview({
  diagnostics,
  onRegenerate,
  onStartReveal,
  onBack,
  regenerateDisabled,
  regenerateReason,
  startDisabled,
  startReason,
}) {
  const groups = diagnostics?.groups || [];

  return (
    <Stack spacing={3} maxWidth={900} mx="auto" width="100%">
      <Typography component="h1" sx={showcaseTitleSx}>
        Xem trước chia bảng (Owner)
      </Typography>

      <Box sx={showcaseCardSx}>
        <Stack spacing={1}>
          <Box>
            <strong>{diagnostics?.groupCount ?? 0}</strong> bảng
          </Box>
          <Box sx={showcaseMutedSx}>
            balancing: {diagnostics?.balancingMethod || "—"} · rulesVersion:{" "}
            {diagnostics?.rulesVersion || "—"}
          </Box>
        </Stack>
      </Box>

      {diagnostics?.duplicateTeamIds?.length ? (
        <Alert severity="error">
          Trùng đội giữa các bảng: {diagnostics.duplicateTeamIds.join(", ")}
        </Alert>
      ) : null}
      {diagnostics?.missingTeamIds?.length ? (
        <Alert severity="warning">
          Thiếu đội trong bảng: {diagnostics.missingTeamIds.join(", ")}
        </Alert>
      ) : null}

      <Box sx={showcaseCardSx}>
        {groups.map((group) => (
          <Box key={group.id} mb={1.5}>
            <Typography fontWeight={700}>{group.name}</Typography>
            <Box sx={showcaseMutedSx}>
              TB {Number(group.avgRating || 0).toFixed(2)} · {group.teamCount} đội
            </Box>
            <Box sx={showcaseMutedSx}>
              {(group.teams || []).map((team) => team.name).join(" · ")}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={showcaseActionsSx}>
        <Button variant="outlined" color="inherit" onClick={onBack}>
          Quay lại
        </Button>
        <Button
          variant="outlined"
          color="warning"
          disabled={regenerateDisabled}
          title={regenerateReason || ""}
          onClick={onRegenerate}
        >
          Chia lại bảng
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={startDisabled}
          title={startReason || ""}
          onClick={onStartReveal}
        >
          {SHOWCASE_COPY.startGroupReveal}
        </Button>
      </Box>
    </Stack>
  );
}
