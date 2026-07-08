import { Link as RouterLink } from "react-router-dom";
import { Box, Stack, Typography } from "@mui/material";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import StarIcon from "@mui/icons-material/Star";

import { courtThumbnailSx, publicCardSx, PUBLIC_COLORS } from "../publicPortalStyles.js";

export default function CourtCard({ court }) {
  return (
    <Box
      component={RouterLink}
      to="/courts"
      sx={{
        ...publicCardSx,
        display: "block",
        height: "100%",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <Box
        sx={{
          ...courtThumbnailSx,
          backgroundImage: court.image ? `url(${court.image})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {court.rating && (
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              bgcolor: "rgba(8,12,20,0.75)",
              px: 1,
              py: 0.25,
              borderRadius: 1,
            }}
          >
            <StarIcon sx={{ fontSize: 14, color: PUBLIC_COLORS.lime }} />
            <Typography variant="caption" fontWeight={700}>
              {court.rating}
            </Typography>
          </Stack>
        )}
      </Box>

      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          {court.name}
        </Typography>
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={0.75} alignItems="flex-start">
            <LocationOnOutlinedIcon sx={{ fontSize: 16, color: PUBLIC_COLORS.textMuted, mt: 0.2 }} />
            <Typography variant="body2" color={PUBLIC_COLORS.textMuted} sx={{ lineHeight: 1.4 }}>
              {court.address}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <SportsTennisIcon sx={{ fontSize: 16, color: PUBLIC_COLORS.lime }} />
            <Typography variant="body2" color={PUBLIC_COLORS.textMuted}>
              {court.courtCount} sân
            </Typography>
          </Stack>
          {court.pricePerHour && (
            <Typography variant="body2" fontWeight={700} color={PUBLIC_COLORS.lime}>
              {court.pricePerHour}
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
