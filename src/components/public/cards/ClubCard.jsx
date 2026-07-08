import { Link as RouterLink } from "react-router-dom";
import { Avatar, Box, Stack, Typography } from "@mui/material";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";

import { courtThumbnailSx, publicCardSx, PUBLIC_COLORS } from "../publicPortalStyles.js";

export default function ClubCard({ club }) {
  const initials = club.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Box
      component={RouterLink}
      to="/clubs"
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
          height: 140,
          backgroundImage: club.image ? `url(${club.image})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <Box sx={{ px: 2, pb: 2.5, pt: 0, mt: -3, position: "relative" }}>
        <Avatar
          src={club.logo || undefined}
          sx={{
            width: 56,
            height: 56,
            mb: 1.5,
            border: `3px solid ${PUBLIC_COLORS.surface}`,
            bgcolor: PUBLIC_COLORS.lime,
            color: "#0B0F19",
            fontWeight: 800,
          }}
        >
          {initials}
        </Avatar>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, lineHeight: 1.3 }}>
          {club.name}
        </Typography>
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <GroupsOutlinedIcon sx={{ fontSize: 16, color: PUBLIC_COLORS.lime }} />
            <Typography variant="body2" color={PUBLIC_COLORS.textMuted}>
              {club.members} thành viên
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <EmojiEventsOutlinedIcon sx={{ fontSize: 16, color: PUBLIC_COLORS.lime }} />
            <Typography variant="body2" color={PUBLIC_COLORS.textMuted}>
              {club.tournaments} giải đã tổ chức
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <LocationOnOutlinedIcon sx={{ fontSize: 16, color: PUBLIC_COLORS.textMuted }} />
            <Typography variant="body2" color={PUBLIC_COLORS.textMuted}>
              {club.city}
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
