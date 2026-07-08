import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";

import {
  PUBLIC_COLORS,
  courtThumbnailSx,
  publicCardSx,
  statusChipColors,
} from "../publicPortalStyles.js";

export default function TournamentCard({ tournament, variant = "dark" }) {
  const chip = statusChipColors[tournament.status] || statusChipColors.upcoming;
  const isLight = variant === "light";

  return (
    <Box
      sx={{
        ...(isLight ? {} : publicCardSx),
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 2,
        bgcolor: isLight ? "#fff" : PUBLIC_COLORS.surface,
        border: `1px solid ${isLight ? PUBLIC_COLORS.borderLight : PUBLIC_COLORS.border}`,
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: PUBLIC_COLORS.cardShadow,
        },
      }}
    >
      <Box sx={{ ...courtThumbnailSx, height: 160 }}>
        <Chip
          label={tournament.statusLabel}
          size="small"
          sx={{
            position: "absolute",
            top: 12,
            left: 12,
            bgcolor: chip.bg,
            color: chip.color,
            fontWeight: 700,
            backdropFilter: "blur(6px)",
            zIndex: 1,
          }}
        />
      </Box>

      <Box sx={{ p: 2, flex: 1, display: "flex", flexDirection: "column" }}>
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{
            mb: 1.5,
            lineHeight: 1.35,
            color: isLight ? PUBLIC_COLORS.textDark : PUBLIC_COLORS.text,
          }}
        >
          {tournament.name}
        </Typography>

        <Stack spacing={0.75} sx={{ mb: 2, flex: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <LocationOnOutlinedIcon sx={{ fontSize: 16, color: PUBLIC_COLORS.lime }} />
            <Typography variant="body2" color={PUBLIC_COLORS.textMuted}>
              {tournament.location}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <CalendarMonthOutlinedIcon sx={{ fontSize: 16, color: PUBLIC_COLORS.textMuted }} />
            <Typography variant="body2" color={PUBLIC_COLORS.textMuted}>
              {tournament.date}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <GroupsOutlinedIcon sx={{ fontSize: 16, color: PUBLIC_COLORS.textMuted }} />
            <Typography variant="body2" color={PUBLIC_COLORS.textMuted}>
              {tournament.participants} {tournament.participantLabel}
            </Typography>
          </Stack>
        </Stack>

        <Button
          component={RouterLink}
          to="/tournaments"
          size="small"
          sx={{
            alignSelf: "flex-start",
            color: PUBLIC_COLORS.lime,
            textTransform: "none",
            px: 0,
            fontWeight: 600,
            "&:hover": { bgcolor: "transparent", opacity: 0.8 },
          }}
        >
          Xem chi tiết →
        </Button>
      </Box>
    </Box>
  );
}
