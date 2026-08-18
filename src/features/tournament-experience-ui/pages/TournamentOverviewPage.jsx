import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import TimelineIcon from "@mui/icons-material/Timeline";
import TimelapseIcon from "@mui/icons-material/Timelapse";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Grid, LinearProgress, Paper, Stack, Typography } from "@mui/material";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentHero from "../components/TournamentHero.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import TournamentStatusChip from "../components/TournamentStatusChip.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import {
  TOURNAMENT_COLOR,
  TOURNAMENT_ELEVATION,
  TOURNAMENT_RADIUS,
} from "../design/tournamentDesignTokens.js";
import {
  FIXTURE_EVENTS,
  FIXTURE_LIFECYCLE,
  FIXTURE_LIVE_MATCHES,
  FIXTURE_NOTIFICATIONS,
  FIXTURE_OPS,
  FIXTURE_OVERVIEW_ATTENTION,
  FIXTURE_TOURNAMENT_ID,
  getFixtureTournament,
} from "../fixtures/prototypeFixture.js";
import { tournamentPath } from "../navigation/tournamentNav.js";

const ACCENT = {
  blue: TOURNAMENT_COLOR.primary,
  purple: TOURNAMENT_COLOR.purple,
  pink: "#DB2777",
  orange: TOURNAMENT_COLOR.orange,
  green: TOURNAMENT_COLOR.success,
};

export default function TournamentOverviewPage() {
  const tournament = getFixtureTournament();

  return (
    <TournamentExperienceShell title="Tổng quan giải đấu" subtitle="Bảng điều hành vận hành một giải">
      <TournamentHero tournament={tournament} />

      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <TournamentKpiCard label="VĐV" value={tournament.athletes} hint="+12%" tone="success" icon={<GroupsOutlinedIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <TournamentKpiCard label="Nội dung" value={5} hint="100% khởi tạo" tone="purple" icon={<EventNoteOutlinedIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <TournamentKpiCard label="Sân" value="12" hint="11 đang dùng" tone="info" icon={<SportsTennisIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <TournamentKpiCard
            label="Trận"
            value={tournament.matches}
            hint={`${tournament.completedMatches} xong`}
            icon={<TimelineIcon />}
          />
        </Grid>
      </Grid>

      <TournamentWorkspace
        rail={
          <>
            <TournamentRightRailCard title="Vòng đời giải đấu" icon={<TimelineIcon sx={{ fontSize: 16 }} />}>
              <Stack spacing={0.85}>
                {FIXTURE_LIFECYCLE.map((step) => (
                  <Stack key={step.label} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                    {step.state === "done" ? (
                      <CheckCircleIcon sx={{ fontSize: 16, color: TOURNAMENT_COLOR.success, mt: "1px" }} />
                    ) : step.state === "current" ? (
                      <TimelapseIcon sx={{ fontSize: 16, color: TOURNAMENT_COLOR.primary, mt: "1px" }} />
                    ) : (
                      <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: TOURNAMENT_COLOR.disabled, mt: "1px" }} />
                    )}
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: step.state === "current" ? 700 : 600 }}>
                        {step.label}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>{step.meta}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </TournamentRightRailCard>
            <TournamentRightRailCard
              title="Cần xử lý"
              priority
              icon={<ErrorOutlineIcon sx={{ fontSize: 16 }} />}
            >
              <Stack spacing={0.75}>
                {FIXTURE_OVERVIEW_ATTENTION.map((item) => (
                  <Stack key={item.label} direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                    <WarningAmberIcon
                      sx={{
                        fontSize: 14,
                        color: item.tone === "danger" ? TOURNAMENT_COLOR.danger : TOURNAMENT_COLOR.warning,
                      }}
                    />
                    <Typography sx={{ fontSize: 12.5 }}>{item.label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Thông báo" icon={<NotificationsNoneIcon sx={{ fontSize: 16 }} />}>
              <Stack spacing={0.75}>
                {FIXTURE_NOTIFICATIONS.map((item) => (
                  <Box key={item.text}>
                    <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, fontWeight: 600 }}>
                      {item.time}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5 }}>{item.text}</Typography>
                  </Box>
                ))}
              </Stack>
            </TournamentRightRailCard>
            <Button
              fullWidth
              size="small"
              component={RouterLink}
              to={tournamentPath(FIXTURE_TOURNAMENT_ID, "matches")}
            >
              Xem tất cả trận đấu →
            </Button>
          </>
        }
      >
        <TournamentSectionTitle icon={<EventNoteOutlinedIcon sx={{ fontSize: 16 }} />}>
          Nội dung
        </TournamentSectionTitle>
        <Grid container spacing={1} sx={{ mb: 1.5 }}>
          {FIXTURE_EVENTS.map((event) => {
            const accent = ACCENT[event.accent] || TOURNAMENT_COLOR.primary;
            const pct = Math.round((event.done / event.total) * 100);
            return (
              <Grid key={event.id} size={{ xs: 12, sm: 6, xl: 4 }}>
                <Paper
                  component={RouterLink}
                  to={tournamentPath(FIXTURE_TOURNAMENT_ID, "settings")}
                  elevation={0}
                  sx={{
                    p: 1.1,
                    display: "block",
                    textDecoration: "none",
                    color: "inherit",
                    borderRadius: `${TOURNAMENT_RADIUS.card}px`,
                    border: `1px solid ${TOURNAMENT_COLOR.divider}`,
                    borderLeft: `3px solid ${accent}`,
                    boxShadow: TOURNAMENT_ELEVATION.card,
                    "&:hover": { borderColor: accent },
                  }}
                >
                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{event.name}</Typography>
                    <ChevronRightIcon sx={{ fontSize: 18, color: TOURNAMENT_COLOR.textMuted }} />
                  </Stack>
                  <Stack direction="row" spacing={0.75} sx={{ mb: 0.75, alignItems: "center", flexWrap: "wrap" }}>
                    <TournamentStatusChip
                      tone={event.status === "ongoing" ? "success" : "info"}
                      label={event.status === "ongoing" ? "Đang diễn ra" : "Sắp bắt đầu"}
                    />
                    <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted }}>
                      {event.pairs} cặp • {event.stage}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 4,
                      borderRadius: 99,
                      bgcolor: TOURNAMENT_COLOR.divider,
                      "& .MuiLinearProgress-bar": { bgcolor: accent },
                    }}
                  />
                  <Typography sx={{ fontSize: 11, mt: 0.5, color: TOURNAMENT_COLOR.textMuted }}>
                    {event.done}/{event.total} trận • {pct}%
                  </Typography>
                </Paper>
              </Grid>
            );
          })}
        </Grid>

        <TournamentSectionTitle icon={<SportsTennisIcon sx={{ fontSize: 16 }} />}>
          Điều hành giải
        </TournamentSectionTitle>
        <Paper
          elevation={0}
          sx={{
            mb: 1.5,
            border: `1px solid ${TOURNAMENT_COLOR.divider}`,
            borderRadius: `${TOURNAMENT_RADIUS.card}px`,
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
            overflow: "hidden",
          }}
        >
          {[
            { label: "Đang thi đấu", value: FIXTURE_OPS.playing, tone: TOURNAMENT_COLOR.success, Icon: SportsTennisIcon },
            { label: "Chờ sân", value: FIXTURE_OPS.waiting, tone: TOURNAMENT_COLOR.warning, Icon: TimelapseIcon },
            { label: "Trễ giờ", value: FIXTURE_OPS.late, tone: TOURNAMENT_COLOR.danger, Icon: WarningAmberIcon },
            { label: "Hoàn thành", value: FIXTURE_OPS.completedToday, tone: TOURNAMENT_COLOR.primary, Icon: CheckCircleIcon },
          ].map((item, index) => (
            <Box
              key={item.label}
              sx={{
                px: 1.25,
                py: 1,
                borderRight: {
                  xs: index % 2 === 0 ? `1px solid ${TOURNAMENT_COLOR.divider}` : "none",
                  md: index < 3 ? `1px solid ${TOURNAMENT_COLOR.divider}` : "none",
                },
                borderBottom: {
                  xs: index < 2 ? `1px solid ${TOURNAMENT_COLOR.divider}` : "none",
                  md: "none",
                },
              }}
            >
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <item.Icon sx={{ fontSize: 16, color: item.tone }} />
                <Box>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1, color: item.tone }}>
                    {item.value}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>{item.label}</Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Paper>

        <TournamentSectionTitle icon={<SportsTennisIcon sx={{ fontSize: 16, color: TOURNAMENT_COLOR.live }} />}>
          Trận đấu đang diễn ra
        </TournamentSectionTitle>
        <Stack spacing={0.85}>
          {FIXTURE_LIVE_MATCHES.map((match) => (
            <Paper
              key={match.id}
              elevation={0}
              sx={{
                px: 1.25,
                py: 1,
                borderRadius: `${TOURNAMENT_RADIUS.card}px`,
                border: `1px solid ${TOURNAMENT_COLOR.divider}`,
                borderLeft: `3px solid ${TOURNAMENT_COLOR.live}`,
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} sx={{ mb: 0.35, alignItems: "center", flexWrap: "wrap" }}>
                    <TournamentStatusChip tone="live" label="ĐANG THI ĐẤU" />
                    <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{match.court}</Typography>
                    <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                      {match.event} • {match.stage}
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>
                    {match.a} vs {match.b}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 15, color: TOURNAMENT_COLOR.live, whiteSpace: "nowrap" }}>
                  {match.score}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}
