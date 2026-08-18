import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import AddIcon from "@mui/icons-material/Add";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlineOutlined";
import HistoryIcon from "@mui/icons-material/History";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import SearchIcon from "@mui/icons-material/Search";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../../../context/SeasonContext.jsx";
import ClubAssignmentBanner from "../../../../components/auth/ClubAssignmentBanner.jsx";
import { TournamentStatusChip } from "../../../../components/tournament/TournamentStatusChip.jsx";
import { usePageRuntimeAccess } from "../../../../components/shell/usePageRuntimeAccess.js";
import { TOURNAMENT_ROUTES } from "../../../../config/tournamentRoutes.js";
import { TOURNAMENT_MODE } from "../../../../models/tournament/constants.js";
import { useCanonicalTournamentList } from "../../hooks/useCanonicalTournament.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import { resolveA1OpenPath } from "../routes.js";
import CenterIdentitySurface from "../visual/CenterIdentitySurface.jsx";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";
import CenterPageHeader from "../visual/CenterPageHeader.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import {
  CENTER_STATUS_FILTERS,
  deriveAttentionItems,
  deriveCenterCard,
  deriveCenterKpis,
  filterCenterTournaments,
} from "../visual/centerListModel.js";
import {
  TOURNAMENT_COLOR,
  TOURNAMENT_ELEVATION,
  TOURNAMENT_RADIUS,
  TYPE_BANNER,
  primaryActionSx,
} from "../visual/tournamentExperienceTokens.js";

const CREATE_TYPES = [
  {
    key: "daily",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
    title: "Chơi trong ngày",
    hint: "Phiên chơi trong ngày, xếp cặp nhanh.",
    color: TOURNAMENT_COLOR.primary,
    Icon: SportsTennisIcon,
  },
  {
    key: "internal",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    title: "Giải nội bộ",
    hint: "Giải CLB / nội bộ, vận hành gọn.",
    color: TOURNAMENT_COLOR.purple,
    Icon: GroupsOutlinedIcon,
  },
  {
    key: "official",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    title: "Chính thức / Mở rộng",
    hint: "Giải mở, nhiều nội dung, trang công khai.",
    color: TOURNAMENT_COLOR.success,
    Icon: EmojiEventsOutlinedIcon,
  },
  {
    key: "team",
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    title: "Giải đồng đội",
    hint: "Team Cup, lineup và trận đồng đội.",
    color: TOURNAMENT_COLOR.orange,
    Icon: FlagOutlinedIcon,
  },
];

const GUIDE_LINKS = [
  { label: "Cách tạo giải", to: TOURNAMENT_ROUTES.create },
  { label: "Thiết lập nội dung", to: TOURNAMENT_ROUTES.configHub },
  { label: "Xuất trang giải đấu công khai", to: "/public/tournaments" },
];

function bannerStatusSx(status) {
  const tone = {
    active: { bgcolor: TOURNAMENT_COLOR.successSurface, color: TOURNAMENT_COLOR.success },
    ready: { bgcolor: TOURNAMENT_COLOR.primarySurface, color: TOURNAMENT_COLOR.primary },
    registration: { bgcolor: TOURNAMENT_COLOR.warningSurface, color: TOURNAMENT_COLOR.warning },
    draft: { bgcolor: "#F1F5F9", color: TOURNAMENT_COLOR.textMuted },
    completed: { bgcolor: "#F1F5F9", color: TOURNAMENT_COLOR.textMuted },
    cancelled: { bgcolor: TOURNAMENT_COLOR.dangerSurface, color: TOURNAMENT_COLOR.danger },
  }[status] || { bgcolor: TOURNAMENT_COLOR.primarySurface, color: TOURNAMENT_COLOR.primary };

  return {
    height: 20,
    fontSize: 10,
    fontWeight: 700,
    border: 0,
    ...tone,
  };
}

export default function TournamentCenterExperiencePage() {
  const navigate = useNavigate();
  const { activeClub, activeClubId, revision } = useClub();
  const { activeSeason, activeLeague } = useSeasonLeague();
  const { accessAllowed } = usePageRuntimeAccess(
    "tournament.manage",
    activeClub?.tenantId || activeClubId,
    { source: "tournament.experience-a1.center" }
  );
  const { tournaments, loading, error } = useCanonicalTournamentList(activeClub, revision);
  const [query, setQuery] = useState("");
  const [filterKey, setFilterKey] = useState("all");

  const contextChips = [
    activeClub?.name ? `CLB ${activeClub.name}` : null,
    activeSeason?.name || null,
    activeLeague?.name || null,
  ].filter(Boolean);

  const kpis = useMemo(() => deriveCenterKpis(tournaments), [tournaments]);
  const attentionItems = useMemo(() => deriveAttentionItems(tournaments), [tournaments]);
  const filtered = useMemo(
    () => filterCenterTournaments(tournaments, { query, filterKey }),
    [tournaments, query, filterKey]
  );

  const goCreate = () => navigate(TOURNAMENT_ROUTES.create);

  return (
    <Box
      data-testid="tournament-center-page"
      sx={{
        width: "100%",
        minWidth: 0,
        overflowX: "hidden",
        bgcolor: TOURNAMENT_COLOR.pageBg,
      }}
    >
      <CenterPageHeader
        title="Trung tâm giải đấu"
        subtitle="Vận hành toàn bộ giải của PICK_VN"
        contextChips={contextChips}
        onCreate={goCreate}
      />

      <ClubAssignmentBanner />

      {!accessAllowed ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Tài khoản hiện tại bị hạn chế thao tác quản lý giải đấu.
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      ) : null}
      {loading ? <LinearProgress sx={{ mb: 1.5, borderRadius: 99 }} /> : null}

      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        {CREATE_TYPES.map((item) => {
          const Icon = item.Icon;
          return (
            <Grid key={item.key} size={{ xs: 6, lg: 3 }}>
              <Paper
                elevation={0}
                role="button"
                tabIndex={0}
                onClick={goCreate}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    goCreate();
                  }
                }}
                sx={{
                  p: 1.25,
                  borderRadius: `${TOURNAMENT_RADIUS.card}px`,
                  border: `1px solid ${TOURNAMENT_COLOR.divider}`,
                  cursor: "pointer",
                  height: "100%",
                  bgcolor: TOURNAMENT_COLOR.cardBg,
                  transition: "border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease",
                  "&:hover": {
                    borderColor: item.color,
                    boxShadow: TOURNAMENT_ELEVATION.cardHover,
                    transform: "translateY(-1px)",
                  },
                }}
              >
                <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.25,
                      bgcolor: `${item.color}18`,
                      color: item.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 20 }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{item.title}</Typography>
                    <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 0.25 }}>
                      {item.hint}
                    </Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: TOURNAMENT_COLOR.primary, mt: 0.75 }}>
                      Tạo giải →
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, lg: 3 }}>
          <CenterKpiCard
            label="Đang diễn ra"
            value={kpis.ongoing}
            tone="success"
            icon={<SportsTennisIcon />}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <CenterKpiCard
            label="Sắp diễn ra"
            value={kpis.upcoming}
            tone="info"
            icon={<CalendarMonthOutlinedIcon />}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <CenterKpiCard
            label="Đang đăng ký"
            value={kpis.registering}
            tone="warning"
            icon={<GroupsOutlinedIcon />}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <CenterKpiCard
            label="Cần xử lý"
            value={kpis.attention}
            tone="danger"
            icon={<WarningAmberIcon />}
          />
        </Grid>
      </Grid>

      <TournamentExperienceWorkspace
        rail={
          <>
            <CenterRightRailCard
              title="Cần xử lý"
              priority
              icon={<ErrorOutlineIcon sx={{ fontSize: 16 }} />}
            >
              {attentionItems.length ? (
                <Stack spacing={0.75}>
                  {attentionItems.map((item) => (
                    <Stack
                      key={item.label}
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center" }}
                    >
                      <Typography sx={{ fontSize: 12.5 }}>{item.label}</Typography>
                      <Chip
                        size="small"
                        label={item.count}
                        sx={{
                          height: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          bgcolor:
                            item.tone === "danger"
                              ? TOURNAMENT_COLOR.dangerSurface
                              : TOURNAMENT_COLOR.warningSurface,
                          color:
                            item.tone === "danger" ? TOURNAMENT_COLOR.danger : TOURNAMENT_COLOR.warning,
                        }}
                      />
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                  Không có việc cần xử lý ngay.
                </Typography>
              )}
            </CenterRightRailCard>
            <CenterRightRailCard title="Hoạt động gần đây" icon={<HistoryIcon sx={{ fontSize: 16 }} />}>
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                Chưa có hoạt động gần đây.
              </Typography>
            </CenterRightRailCard>
            <CenterRightRailCard title="Hướng dẫn nhanh" icon={<HelpOutlineIcon sx={{ fontSize: 16 }} />}>
              <Stack spacing={0.6}>
                {GUIDE_LINKS.map((item) => (
                  <Typography
                    key={item.to}
                    component={RouterLink}
                    to={item.to}
                    sx={{
                      fontSize: 12.5,
                      color: TOURNAMENT_COLOR.primary,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    {item.label} →
                  </Typography>
                ))}
              </Stack>
            </CenterRightRailCard>
          </>
        }
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ mb: 1.25, alignItems: { sm: "center" } }}
        >
          <TextField
            size="small"
            placeholder="Tìm kiếm giải đấu..."
            fullWidth
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
            {CENTER_STATUS_FILTERS.map((item) => (
              <Chip
                key={item.key}
                label={item.label}
                clickable
                color={filterKey === item.key ? "primary" : "default"}
                variant={filterKey === item.key ? "filled" : "outlined"}
                size="small"
                onClick={() => setFilterKey(item.key)}
                sx={{
                  height: 26,
                  ...(filterKey === item.key
                    ? { bgcolor: TOURNAMENT_COLOR.primary, color: "#FFF" }
                    : { borderColor: TOURNAMENT_COLOR.divider }),
                }}
              />
            ))}
          </Stack>
        </Stack>

        {filtered.length === 0 ? (
          <Paper
            elevation={0}
            data-testid="tournament-center-empty"
            sx={{
              p: 2.5,
              borderRadius: `${TOURNAMENT_RADIUS.card}px`,
              border: `1px solid ${TOURNAMENT_COLOR.divider}`,
              boxShadow: TOURNAMENT_ELEVATION.card,
              textAlign: "center",
              bgcolor: TOURNAMENT_COLOR.cardBg,
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 0.5 }}>Chưa có giải đấu</Typography>
            <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 1.25 }}>
              Không có giải trong bộ lọc hiện tại. Tạo giải mới khi CLB đã sẵn sàng.
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={goCreate}
              sx={primaryActionSx}
            >
              Tạo giải
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={1.25}>
            {filtered.map((tournament) => (
              <Grid key={tournament.id} size={{ xs: 12, md: 6 }}>
                <TournamentCenterCard
                  tournament={tournament}
                  clubName={activeClub?.name || ""}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </TournamentExperienceWorkspace>
    </Box>
  );
}

function TournamentCenterCard({ tournament, clubName }) {
  const card = deriveCenterCard(tournament, { clubName });
  const gradient = TYPE_BANNER[card.mode] || TYPE_BANNER.official_tournament;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${TOURNAMENT_COLOR.divider}`,
        boxShadow: TOURNAMENT_ELEVATION.card,
        overflow: "hidden",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: TOURNAMENT_COLOR.cardBg,
        "&:hover": { borderColor: TOURNAMENT_COLOR.primaryLight },
      }}
    >
      <CenterIdentitySurface gradient={gradient} height={64}>
        <Box
          sx={{
            px: 1.5,
            py: 1,
            minHeight: 64,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <Chip
              size="small"
              label={card.typeLabel}
              sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: "rgba(255,255,255,0.16)", color: "#FFF" }}
            />
            <TournamentStatusChip status={card.status} sx={bannerStatusSx(card.status)} />
          </Stack>
          <Typography sx={{ color: "#FFF", fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>
            {card.name}
          </Typography>
        </Box>
      </CenterIdentitySurface>
      <Box sx={{ p: 1.25, flex: 1, minWidth: 0 }}>
        <Stack spacing={0.4} sx={{ mb: 1 }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <CalendarMonthOutlinedIcon sx={{ fontSize: 14, color: TOURNAMENT_COLOR.textMuted }} />
            <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
              {card.dates || "Chưa có lịch thi đấu"}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <PlaceOutlinedIcon sx={{ fontSize: 14, color: TOURNAMENT_COLOR.textMuted }} />
            <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
              {card.location || "Chưa có địa điểm"}
            </Typography>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1.5} sx={{ mb: 1 }}>
          <Typography sx={{ fontSize: 12 }}>
            <Box component="span" sx={{ fontWeight: 700 }}>{card.athletes}</Box> VĐV
          </Typography>
          <Typography sx={{ fontSize: 12 }}>
            <Box component="span" sx={{ fontWeight: 700 }}>{card.events}</Box> nội dung
          </Typography>
          <Typography sx={{ fontSize: 12 }}>
            <Box component="span" sx={{ fontWeight: 700 }}>{card.matches}</Box> trận
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={card.progress}
          sx={{
            height: 4,
            borderRadius: 99,
            mb: 1,
            bgcolor: TOURNAMENT_COLOR.divider,
            "& .MuiLinearProgress-bar": { bgcolor: TOURNAMENT_COLOR.primary },
          }}
        />
        <Button
          component={RouterLink}
          to={resolveA1OpenPath(tournament)}
          size="small"
          variant="contained"
          endIcon={<ChevronRightIcon />}
          sx={primaryActionSx}
        >
          Mở giải
        </Button>
      </Box>
    </Paper>
  );
}
