import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";

import { getGroupTheme } from "./animationConfig.js";
import { VISUAL_MODES } from "./animationConfig.js";

export default function DrawRevealCard({
  name = "",
  seed = null,
  groupLabel = null,
  statusText = "Đang bốc thăm",
  visualMode = VISUAL_MODES.PROFESSIONAL,
  phase = "spotlight",
  compact = false,
  selected = false,
}) {
  const theme = groupLabel ? getGroupTheme(groupLabel) : null;
  const isCeremony = visualMode === VISUAL_MODES.CEREMONY;
  const isFlying = phase === "fly";

  return (
    <Box
      className={`draw-spotlight-stage${phase === "spotlight" ? " draw-spotlight-stage--active" : ""}`}
      sx={{ position: "relative", minHeight: compact ? 180 : 240, py: 2 }}
    >
      <Box className="draw-spotlight-vignette" />

      <Paper
        elevation={8}
        className={`draw-reveal-card${isFlying ? " draw-reveal-card--fly" : ""}${
          isCeremony ? " draw-reveal-card--ceremony" : ""
        }${selected ? " draw-reveal-card--selected" : ""}`}
        sx={{
          position: "relative",
          zIndex: 2,
          mx: "auto",
          maxWidth: compact ? 320 : 420,
          p: compact ? 2 : 2.5,
          borderRadius: 3,
          border: theme ? `2px solid ${theme.main}` : "1px solid",
          borderColor: theme ? theme.main : "divider",
          bgcolor: "background.paper",
        }}
      >
        {isCeremony && (
          <Box className="draw-ceremony-shell" sx={{ mb: 1.5, textAlign: "center" }}>
            <SportsTennisIcon sx={{ fontSize: 42, color: "warning.main" }} />
            <Typography variant="caption" color="text.secondary" display="block">
              Mở thăm bốc
            </Typography>
          </Box>
        )}

        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 1 }}>
          <EmojiEventsIcon sx={{ color: "primary.main", fontSize: 20 }} />
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2 }}>
            {statusText}
          </Typography>
        </Stack>

        <Typography
          variant={compact ? "h6" : "h5"}
          fontWeight="bold"
          align="center"
          sx={{ wordBreak: "break-word", lineHeight: 1.25 }}
        >
          {name || "—"}
        </Typography>

        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
          {seed != null && seed !== "" && (
            <Chip size="small" label={`Seed ${seed}`} variant="outlined" />
          )}
          {groupLabel && (
            <Chip
              size="small"
              label={`Bảng ${groupLabel}`}
              sx={{ bgcolor: theme?.light, color: theme?.main, fontWeight: 700 }}
            />
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
