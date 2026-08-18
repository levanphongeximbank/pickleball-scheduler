import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { Box, Button, Stack, Typography } from "@mui/material";

import { TOURNAMENT_COLOR, TOURNAMENT_RADIUS, TOURNAMENT_TYPE } from "../design/tournamentDesignTokens.js";
import TournamentIdentitySurface from "./TournamentIdentitySurface.jsx";
import TournamentStatusChip from "./TournamentStatusChip.jsx";

export default function TournamentHero({ tournament, actions }) {
  return (
    <Box
      sx={{
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        overflow: "hidden",
        mb: 1.5,
        boxShadow: "0 10px 28px rgba(15, 27, 45, 0.22)",
      }}
    >
      <TournamentIdentitySurface
        gradient={`linear-gradient(120deg, ${TOURNAMENT_COLOR.navy} 0%, #16325C 42%, ${TOURNAMENT_COLOR.primary} 100%)`}
      >
        <Box sx={{ px: { xs: 1.75, md: 2.25 }, py: { xs: 1.25, md: 1.5 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ alignItems: { sm: "flex-start" }, justifyContent: "space-between" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 0.6, flexWrap: "wrap" }}>
                <Box
                  sx={{
                    px: 1,
                    py: 0.2,
                    borderRadius: 99,
                    border: "1px solid rgba(255,255,255,0.45)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                  }}
                >
                  {tournament.typeLabel || "Chính thức / Mở rộng"}
                </Box>
                <TournamentStatusChip tone="success" label="ĐANG DIỄN RA" />
              </Stack>
              <Typography
                sx={{
                  fontSize: { xs: 22, md: TOURNAMENT_TYPE.tournamentTitle.size },
                  fontWeight: TOURNAMENT_TYPE.tournamentTitle.weight,
                  lineHeight: 1.08,
                  letterSpacing: "-0.02em",
                }}
              >
                {tournament.name}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              {actions}
              <Button
                variant="outlined"
                size="small"
                endIcon={<OpenInNewIcon />}
                sx={{
                  color: "#FFFFFF",
                  borderColor: "rgba(255,255,255,0.45)",
                  "&:hover": { borderColor: "#FFFFFF", bgcolor: "rgba(255,255,255,0.08)" },
                }}
              >
                Xem trang công khai
              </Button>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={2} useFlexGap sx={{ mt: 1, flexWrap: "wrap", opacity: 0.95 }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <CalendarMonthOutlinedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{tournament.dates}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <PlaceOutlinedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                {tournament.venue || tournament.location}
                {tournament.city ? ` • ${tournament.city}` : ""}
              </Typography>
            </Stack>
          </Stack>
        </Box>
      </TournamentIdentitySurface>
    </Box>
  );
}
