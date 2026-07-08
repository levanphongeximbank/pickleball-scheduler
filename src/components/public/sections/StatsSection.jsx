import { Box, Divider, Stack, Typography } from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import PersonIcon from "@mui/icons-material/Person";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";
import StarIcon from "@mui/icons-material/Star";

import { PUBLIC_COLORS, publicContainerSx } from "../publicPortalStyles.js";

const ICON_MAP = {
  groups: GroupsIcon,
  court: SportsTennisIcon,
  players: PersonIcon,
  trophy: EmojiEventsIcon,
  match: ScoreboardIcon,
  star: StarIcon,
};

export default function StatsSection({ stats }) {
  return (
    <Box
      sx={{
        bgcolor: PUBLIC_COLORS.bgAlt,
        borderTop: `1px solid ${PUBLIC_COLORS.border}`,
        borderBottom: `1px solid ${PUBLIC_COLORS.border}`,
        py: { xs: 2.5, md: 3 },
        px: { xs: 2, sm: 3, md: 4 },
      }}
    >
      <Box sx={publicContainerSx}>
        <Stack
          direction="row"
          divider={
            <Divider
              orientation="vertical"
              flexItem
              sx={{
                display: { xs: "none", lg: "block" },
                borderColor: PUBLIC_COLORS.border,
                my: 0.5,
              }}
            />
          }
          spacing={{ xs: 2, lg: 0 }}
          sx={{
            flexWrap: "wrap",
            justifyContent: { xs: "center", md: "space-between" },
            alignItems: "center",
          }}
        >
          {stats.map((stat) => {
            const Icon = ICON_MAP[stat.icon] || EmojiEventsIcon;
            return (
              <Stack
                key={stat.label}
                direction="row"
                alignItems="center"
                spacing={1.25}
                sx={{
                  flex: { xs: "1 1 40%", sm: "1 1 30%", lg: "0 1 auto" },
                  px: { lg: 1 },
                  minWidth: { lg: 140 },
                }}
              >
                <Icon sx={{ fontSize: 22, color: PUBLIC_COLORS.lime }} />
                <Box>
                  <Typography
                    variant="h6"
                    fontWeight={800}
                    color={PUBLIC_COLORS.text}
                    sx={{ lineHeight: 1.2 }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" color={PUBLIC_COLORS.textMuted}>
                    {stat.label}
                  </Typography>
                </Box>
              </Stack>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}
