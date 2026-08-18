import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
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
import { Alert, Box, Button, Grid, LinearProgress, Paper, Stack, Typography } from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import ClubAssignmentBanner from "../../../../components/auth/ClubAssignmentBanner.jsx";
import {
  individualPublicTournamentPath,
  isIndividualTournament,
  isTeamTournament,
} from "../../../../config/tournamentRoutes.js";
import { TOURNAMENT_MODE } from "../../../../models/tournament/constants.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import { deriveOverviewVisual } from "../deriveOverview.js";
import { individualSettingsPath } from "../routes.js";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceHero from "../visual/ExperienceHero.jsx";
import ExperiencePageHeader from "../visual/ExperiencePageHeader.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import ExperienceStatusChip from "../visual/ExperienceStatusChip.jsx";
import {
  TOURNAMENT_COLOR,
  TOURNAMENT_ELEVATION,
  TOURNAMENT_RADIUS,
  outlinedActionSx,
  primaryActionSx,
} from "../visual/tournamentExperienceTokens.js";

const ACCENT = {
  blue: TOURNAMENT_COLOR.primary,
  purple: TOURNAMENT_COLOR.purple,
  pink: "#DB2777",
  orange: TOURNAMENT_COLOR.orange,
  green: TOURNAMENT_COLOR.success,
};

function OverviewState({ children }) {
  return (
    <Box
      data-testid="tournament-overview-page"
      sx={{ width: "100%", minWidth: 0, overflowX: "hidden", bgcolor: TOURNAMENT_COLOR.pageBg }}
    >
      {children}
    </Box>
  );
}

export default function IndividualOverviewPage() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);

  if (loading) {
    return (
      <OverviewState>
        <ExperiencePageHeader title="Tổng quan giải đấu" subtitle="Bảng điều hành vận hành một giải" />
        <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
          <Alert severity="info">Đang tải tổng quan giải…</Alert>
        </Box>
      </OverviewState>
    );
  }

  if (error) {
    return (
      <OverviewState>
        <ExperiencePageHeader title="Tổng quan giải đấu" subtitle="Bảng điều hành vận hành một giải" />
        <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </OverviewState>
    );
  }

  if (!tournament) {
    return (
      <OverviewState>
        <ExperiencePageHeader title="Tổng quan giải đấu" subtitle="Bảng điều hành vận hành một giải" />
        <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
          <ClubAssignmentBanner />
          <Alert severity="warning">Không tìm thấy giải. Chọn CLB trên thanh công cụ rồi mở lại giải.</Alert>
        </Box>
      </OverviewState>
    );
  }

  if (!isIndividualTournament(tournament)) {
    const fallback = isTeamTournament(tournament)
      ? `/tournaments/${encodeURIComponent(tournament.id)}`
      : tournament.mode === TOURNAMENT_MODE.DAILY_PLAY
        ? `/tournament/daily/${encodeURIComponent(tournament.id)}`
        : "/tournament";
    return (
      <OverviewState>
        <ExperiencePageHeader title="Tổng quan giải đấu" subtitle="Bảng điều hành vận hành một giải" />
        <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
          <Alert severity="info">
            Tổng quan này dành cho giải cá nhân / chính thức.{" "}
            <Button component={RouterLink} to={fallback} size="small">
              Mở trang hiện tại
            </Button>
          </Alert>
        </Box>
      </OverviewState>
    );
  }

  const model = deriveOverviewVisual(tournament, { clubName: activeClub?.name || "" });
  const settingsTo = individualSettingsPath(tournament.id);
  const publicTo = individualPublicTournamentPath(tournament.id);

  return (
    <OverviewState>
      <ExperiencePageHeader
        title="Tổng quan giải đấu"
        subtitle="Bảng điều hành vận hành một giải"
        actions={
          <Stack direction="row" spacing={0.75}>
            <Button
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/tournament")}
              sx={outlinedActionSx}
            >
              Trung tâm giải đấu
            </Button>
            <Button component={RouterLink} to={settingsTo} variant="contained" size="small" sx={primaryActionSx}>
              Cài đặt
            </Button>
          </Stack>
        }
      />

      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
        <ClubAssignmentBanner />
        <ExperienceHero
          typeLabel={model.typeLabel}
          statusLabel={model.heroStatusLabel}
          statusTone={model.heroStatusTone}
          name={model.name}
          dates={model.datesLabel}
          venue={model.venue.label}
          publicTo={publicTo}
        />

        <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <CenterKpiCard
              label="VĐV"
              value={model.athleteCount}
              hint={model.kpis.entryCount ? `${model.kpis.entryCount} đăng ký` : "Chưa có đăng ký"}
              tone="success"
              icon={<GroupsOutlinedIcon />}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <CenterKpiCard
              label="Nội dung"
              value={model.kpis.eventCount}
              hint={model.eventInitHint}
              tone="purple"
              icon={<EventNoteOutlinedIcon />}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <CenterKpiCard
              label="Sân"
              value={model.kpis.courtConfigured ? model.kpis.courtCount : "—"}
              hint={model.courtHint}
              tone="info"
              icon={<SportsTennisIcon />}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <CenterKpiCard
              label="Trận"
              value={model.kpis.matchCount}
              hint={model.matchHint}
              icon={<TimelineIcon />}
            />
          </Grid>
        </Grid>

        <TournamentExperienceWorkspace
          rail={
            <>
              <CenterRightRailCard title="Vòng đời giải đấu" icon={<TimelineIcon sx={{ fontSize: 16 }} />}>
                <Stack spacing={0.85}>
                  {model.lifecycle.map((step) => (
                    <Stack key={step.id} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
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
              </CenterRightRailCard>
              <CenterRightRailCard
                title="Cần xử lý"
                priority
                icon={<ErrorOutlineIcon sx={{ fontSize: 16 }} />}
              >
                {model.attention.length ? (
                  <Stack spacing={0.75}>
                    {model.attention.map((item) => (
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
                ) : (
                  <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                    Không có mục cần xử lý ngay.
                  </Typography>
                )}
              </CenterRightRailCard>
              <CenterRightRailCard title="Thông báo" icon={<NotificationsNoneIcon sx={{ fontSize: 16 }} />}>
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                  Chưa có thông báo giải đấu trên hồ sơ này.
                </Typography>
              </CenterRightRailCard>
              <Button
                fullWidth
                size="small"
                component={RouterLink}
                to="/tournament/organize"
              >
                Xem tất cả trận đấu →
              </Button>
            </>
          }
        >
          <ExperienceSectionTitle icon={<EventNoteOutlinedIcon sx={{ fontSize: 16 }} />}>
            Nội dung
          </ExperienceSectionTitle>
          {model.eventCards.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 1.5,
                border: `1px dashed ${TOURNAMENT_COLOR.divider}`,
                borderRadius: `${TOURNAMENT_RADIUS.card}px`,
              }}
            >
              <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
                Chưa có nội dung trên hồ sơ giải.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={1} sx={{ mb: 1.5 }}>
              {model.eventCards.map((event) => {
                const accent = ACCENT[event.accent] || TOURNAMENT_COLOR.primary;
                const pct = event.total ? Math.round((event.done / event.total) * 100) : 0;
                return (
                  <Grid key={event.id} size={{ xs: 12, sm: 6, xl: 4 }}>
                    <Paper
                      component={RouterLink}
                      to={individualSettingsPath(tournament.id, event.id)}
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
                        <ExperienceStatusChip tone={event.statusTone} label={event.statusLabel} />
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
                        {event.total
                          ? `${event.done}/${event.total} trận • ${pct}%`
                          : "Chưa có trận trên hồ sơ"}
                      </Typography>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          )}

          <ExperienceSectionTitle icon={<SportsTennisIcon sx={{ fontSize: 16 }} />}>
            Điều hành giải
          </ExperienceSectionTitle>
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
              { label: "Đang thi đấu", value: model.ops.playing, tone: TOURNAMENT_COLOR.success, Icon: SportsTennisIcon },
              { label: "Chờ sân", value: model.ops.waiting, tone: TOURNAMENT_COLOR.warning, Icon: TimelapseIcon },
              { label: "Trễ giờ", value: model.ops.late, tone: TOURNAMENT_COLOR.danger, Icon: WarningAmberIcon },
              { label: "Hoàn thành", value: model.ops.completedToday, tone: TOURNAMENT_COLOR.primary, Icon: CheckCircleIcon },
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

          <ExperienceSectionTitle icon={<SportsTennisIcon sx={{ fontSize: 16, color: TOURNAMENT_COLOR.live }} />}>
            Trận đấu đang diễn ra
          </ExperienceSectionTitle>
          {model.liveMatches.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: `1px dashed ${TOURNAMENT_COLOR.divider}`,
                borderRadius: `${TOURNAMENT_RADIUS.card}px`,
              }}
            >
              <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
                Không có trận đang thi đấu trên hồ sơ giải.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={0.85}>
              {model.liveMatches.map((match) => (
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
                        <ExperienceStatusChip tone="live" label="ĐANG THI ĐẤU" />
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
          )}
        </TournamentExperienceWorkspace>
      </Box>
    </OverviewState>
  );
}
