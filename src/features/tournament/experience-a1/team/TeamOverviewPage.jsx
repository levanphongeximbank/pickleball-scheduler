import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import TimelineIcon from "@mui/icons-material/Timeline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Grid, Stack, Typography } from "@mui/material";

import { useAuth } from "../../../../context/AuthContext.jsx";
import { useClub } from "../../../../context/ClubContext.jsx";
import ClubAssignmentBanner from "../../../../components/auth/ClubAssignmentBanner.jsx";
import { PERMISSIONS } from "../../../../auth/permissions.js";
import {
  teamTournamentDashboardPath,
  teamTournamentPath,
  TEAM_TAB_QUERY,
} from "../../../../config/tournamentRoutes.js";
import { useCanonicalCaptainAthleteId } from "../../../team-tournament/ui/useCanonicalCaptainAthleteId.js";
import { useTeamTournamentDashboard } from "../../../team-tournament/dashboard/useTeamTournamentDashboard.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceHero from "../visual/ExperienceHero.jsx";
import ExperiencePageHeader from "../visual/ExperiencePageHeader.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import {
  TOURNAMENT_COLOR,
  outlinedActionSx,
  primaryActionSx,
} from "../visual/tournamentExperienceTokens.js";
import { projectTeamOverview } from "./TeamTournamentExperienceAdapter.js";
import { buildTeamExperienceNav } from "./teamExperienceNav.js";
import {
  teamExperiencePath,
  teamTournamentLegacyPath,
} from "./teamExperienceRoutes.js";

function OverviewState({ children }) {
  return (
    <Box
      data-testid="team-tournament-overview-page"
      sx={{ width: "100%", minWidth: 0, overflowX: "hidden", bgcolor: TOURNAMENT_COLOR.pageBg }}
    >
      {children}
    </Box>
  );
}

function kpiDisplay(value) {
  if (value == null) return "—";
  return value;
}

export default function TeamOverviewPage() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, can } = useAuth();
  const { activeClubId } = useClub();
  const captainIdentity = useCanonicalCaptainAthleteId(user);
  const canOrganize = Boolean(
    can?.(PERMISSIONS.TOURNAMENT_UPDATE) || can?.(PERMISSIONS.TEAM_MANAGE)
  );
  const { loading, error, view } = useTeamTournamentDashboard({
    tournamentId,
    clubId: activeClubId,
    playerId: captainIdentity.athleteId || null,
    userId: user?.id || null,
    canOrganize,
    isAuthenticated,
  });

  const model = view?.ok ? projectTeamOverview(view) : null;
  const nav = buildTeamExperienceNav(tournamentId);

  if (loading) {
    return (
      <OverviewState>
        <ExperiencePageHeader title="Tổng quan giải đồng đội" subtitle="Bảng điều hành giải đấu đồng đội" />
        <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
          <Alert severity="info">Đang tải tổng quan giải đồng đội…</Alert>
        </Box>
      </OverviewState>
    );
  }

  if (error || (view && view.ok === false)) {
    const message = error || view?.error || "Không tải được tổng quan.";
    return (
      <OverviewState>
        <ExperiencePageHeader title="Tổng quan giải đồng đội" subtitle="Bảng điều hành giải đấu đồng đội" />
        <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
          <ClubAssignmentBanner />
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {message}
          </Alert>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button
              component={RouterLink}
              to={teamTournamentLegacyPath(tournamentId, TEAM_TAB_QUERY.teams)}
              size="small"
              variant="contained"
              sx={primaryActionSx}
            >
              Mở thiết lập hiện tại
            </Button>
            <Button
              component={RouterLink}
              to="/tournament"
              size="small"
              sx={outlinedActionSx}
            >
              Trung tâm giải đấu
            </Button>
          </Stack>
        </Box>
      </OverviewState>
    );
  }

  if (!model) {
    return (
      <OverviewState>
        <ExperiencePageHeader title="Tổng quan giải đồng đội" subtitle="Bảng điều hành giải đấu đồng đội" />
        <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
          <Alert severity="warning">Không tải được dữ liệu tổng quan giải đồng đội.</Alert>
        </Box>
      </OverviewState>
    );
  }

  const legacySetupTo = teamTournamentLegacyPath(tournamentId, TEAM_TAB_QUERY.teams);
  const opsDashboardTo = teamTournamentDashboardPath(tournamentId);
  const settingsTo = teamExperiencePath(tournamentId, "settings");
  const participantsTo = teamExperiencePath(tournamentId, "participants");
  const scheduleTo = teamExperiencePath(tournamentId, "schedule");

  return (
    <OverviewState>
      <ExperiencePageHeader
        title="Tổng quan giải đồng đội"
        subtitle="Một giải · nhiều nội dung · vận hành đồng đội"
        actions={
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/tournament")}
              sx={outlinedActionSx}
            >
              Trung tâm giải đấu
            </Button>
            <Button component={RouterLink} to={legacySetupTo} size="small" variant="contained" sx={primaryActionSx}>
              Thiết lập đầy đủ
            </Button>
          </Stack>
        }
      />

      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
        <ClubAssignmentBanner />
        <ExperienceHero
          typeLabel={model.identity.modeLabel}
          statusLabel={model.identity.statusLabel}
          statusTone={model.identity.isDraft ? "warning" : "success"}
          name={model.identity.name}
          dates={model.identity.formatPreset ? `Định dạng: ${model.identity.formatPreset}` : null}
          venue={null}
          actions={
            <Button component={RouterLink} to={opsDashboardTo} size="small" sx={outlinedActionSx}>
              Bảng điều khiển
            </Button>
          }
        />

        <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <CenterKpiCard
              label="Đội"
              value={kpiDisplay(model.kpis.teamCount)}
              hint="Số đội trên hồ sơ giải"
              tone="success"
              icon={<GroupsOutlinedIcon />}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <CenterKpiCard
              label="Nội dung"
              value={kpiDisplay(model.kpis.disciplineCount)}
              hint={
                model.kpis.disciplineCount == null
                  ? "Xem trong thiết lập đầy đủ"
                  : "Số nội dung thi đấu"
              }
              tone="purple"
              icon={<FlagOutlinedIcon />}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <CenterKpiCard
              label="Trận đồng đội"
              value={kpiDisplay(model.kpis.matchupCount)}
              hint={`${model.kpis.completedMatchupCount} hoàn thành`}
              icon={<TimelineIcon />}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <CenterKpiCard
              label="Knockout"
              value={kpiDisplay(model.kpis.knockoutMatchupCount)}
              hint={model.knockoutStatus.label}
              tone="info"
              icon={<EmojiEventsOutlinedIcon />}
            />
          </Grid>
        </Grid>

        <TournamentExperienceWorkspace
          rail={
            <>
              <CenterRightRailCard title="Trạng thái vận hành" icon={<TimelineIcon sx={{ fontSize: 16 }} />}>
                <Stack spacing={0.85}>
                  <Typography sx={{ fontSize: 12.5 }}>
                    Bảng: {model.groupStatus.label}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5 }}>
                    Knockout: {model.knockoutStatus.label}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5 }}>
                    Trọng tài: {model.refereeReadiness.label}
                  </Typography>
                  {model.nextAction ? (
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>
                      Tiếp theo: {model.nextAction.label}
                    </Typography>
                  ) : null}
                </Stack>
              </CenterRightRailCard>
              <CenterRightRailCard
                title="Điều hướng"
                icon={<SportsTennisIcon sx={{ fontSize: 16 }} />}
              >
                <Stack spacing={0.5}>
                  {nav.map((item) => (
                    <Button
                      key={item.key}
                      component={RouterLink}
                      to={item.to}
                      size="small"
                      sx={{
                        justifyContent: "flex-start",
                        textTransform: "none",
                        fontWeight: item.adopted && item.kind === "canonical" ? 700 : 500,
                      }}
                    >
                      {item.label}
                      {!item.adopted ? " · chưa chuyển" : ""}
                    </Button>
                  ))}
                </Stack>
              </CenterRightRailCard>
              <CenterRightRailCard
                title="Lưu ý"
                priority
                icon={<ErrorOutlineIcon sx={{ fontSize: 16 }} />}
              >
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "flex-start" }}>
                  <WarningAmberIcon sx={{ fontSize: 14, color: TOURNAMENT_COLOR.warning, mt: "2px" }} />
                  <Typography sx={{ fontSize: 12 }}>
                    Màn tổng quan chỉ đọc trạng thái giải. Bảng xếp hạng, Dreambreaker, lineup, trọng tài
                    và sân vẫn dùng luồng vận hành hiện có.
                  </Typography>
                </Stack>
              </CenterRightRailCard>
            </>
          }
        >
          <ExperienceSectionTitle icon={<FlagOutlinedIcon sx={{ fontSize: 16 }} />}>
            Lối vào vận hành
          </ExperienceSectionTitle>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ mb: 1.5, flexWrap: "wrap" }}>
            <Button component={RouterLink} to={settingsTo} variant="contained" size="small" sx={primaryActionSx}>
              Cài đặt
            </Button>
            <Button component={RouterLink} to={participantsTo} size="small" sx={outlinedActionSx}>
              Đội tham dự
            </Button>
            <Button component={RouterLink} to={scheduleTo} size="small" sx={outlinedActionSx}>
              Lịch đối đầu
            </Button>
            <Button component={RouterLink} to={legacySetupTo} size="small" sx={outlinedActionSx}>
              Thiết lập đầy đủ
            </Button>
            <Button
              component={RouterLink}
              to={teamTournamentPath(tournamentId, TEAM_TAB_QUERY.standings)}
              size="small"
              sx={outlinedActionSx}
            >
              Bảng xếp hạng
            </Button>
            <Button component={RouterLink} to={opsDashboardTo} size="small" sx={outlinedActionSx}>
              Bảng điều khiển vận hành
            </Button>
          </Stack>
          <Alert severity="info" sx={{ mb: 1 }}>
            Hiện chỉ màn Tổng quan dùng giao diện giải đấu mới. Các màn còn lại vẫn mở thiết lập /
            portal hiện tại cho đến khi chuyển tiếp.
          </Alert>
        </TournamentExperienceWorkspace>
      </Box>
    </OverviewState>
  );
}
