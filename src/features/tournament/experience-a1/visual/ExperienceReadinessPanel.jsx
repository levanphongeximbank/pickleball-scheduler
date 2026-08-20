import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box, Button, Stack, Typography } from "@mui/material";

import CenterRightRailCard from "./CenterRightRailCard.jsx";
import ExperienceStatusChip from "./ExperienceStatusChip.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR } from "./tournamentExperienceTokens.js";

export default function ExperienceReadinessPanel({
  title = "Mức sẵn sàng",
  items = [],
  lockLabel,
  onLock,
  lockDisabled = false,
  lockHint = "",
  statusLabel,
  statusTone,
}) {
  const blocked = items.some((item) => !item.ready);
  const tone = statusTone || (blocked ? "warning" : "success");

  return (
    <CenterRightRailCard title={title} priority={blocked}>
      {statusLabel ? (
        <Box sx={{ mb: 1 }}>
          <ExperienceStatusChip tone={tone} label={statusLabel} />
        </Box>
      ) : null}
      <Stack spacing={0.7} sx={{ mb: 1.25 }}>
        {items.map((item) => (
          <Stack key={item.label} direction="row" spacing={0.75} sx={{ alignItems: "flex-start" }}>
            {item.ready ? (
              <CheckCircleOutlineIcon sx={{ fontSize: 14, mt: "2px", color: TOURNAMENT_COLOR.success }} />
            ) : (
              <WarningAmberIcon sx={{ fontSize: 14, mt: "2px", color: TOURNAMENT_COLOR.warning }} />
            )}
            <Box>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{item.label}</Typography>
              {item.note ? (
                <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>{item.note}</Typography>
              ) : null}
            </Box>
          </Stack>
        ))}
      </Stack>
      {lockLabel ? (
        <span title={lockHint || undefined}>
          <Button
            variant="outlined"
            startIcon={<LockOutlinedIcon />}
            fullWidth
            size="small"
            disabled={lockDisabled}
            onClick={onLock}
            sx={outlinedActionSx}
          >
            {lockLabel}
          </Button>
        </span>
      ) : null}
      {lockHint ? (
        <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, mt: 0.75 }}>
          {lockHint}
        </Typography>
      ) : null}
    </CenterRightRailCard>
  );
}
