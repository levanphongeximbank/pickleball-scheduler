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
import { Link as RouterLink } from "react-router-dom";
import {
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

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentIdentitySurface from "../components/TournamentIdentitySurface.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentStatusChip from "../components/TournamentStatusChip.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import {
  TOURNAMENT_COLOR,
  TOURNAMENT_ELEVATION,
  TOURNAMENT_RADIUS,
} from "../design/tournamentDesignTokens.js";
import {
  FIXTURE_ACTIVITY,
  FIXTURE_CENTER_STATS,
  FIXTURE_TASKS,
  FIXTURE_TOURNAMENTS,
} from "../fixtures/prototypeFixture.js";
import { tournamentPath } from "../navigation/tournamentNav.js";

const CREATE_TYPES = [
  {
    key: "daily",
    title: "Chơi trong ngày",
    hint: "Phiên chơi trong ngày, xếp cặp nhanh.",
    color: TOURNAMENT_COLOR.primary,
    Icon: SportsTennisIcon,
  },
  {
    key: "internal",
    title: "Giải nội bộ",
    hint: "Giải CLB / nội bộ, vận hành gọn.",
    color: TOURNAMENT_COLOR.purple,
    Icon: GroupsOutlinedIcon,
  },
  {
    key: "official",
    title: "Chính thức / Mở rộng",
    hint: "Giải mở, nhiều nội dung, trang công khai.",
    color: TOURNAMENT_COLOR.success,
    Icon: EmojiEventsOutlinedIcon,
  },
  {
    key: "team",
    title: "Giải đồng đội",
    hint: "Team Cup, lineup và trận đồng đội.",
    color: TOURNAMENT_COLOR.orange,
    Icon: FlagOutlinedIcon,
  },
];

const STATUS_TONE = {
  ongoing: { tone: "success", label: "Đang diễn ra" },
  preparing: { tone: "info", label: "Chuẩn bị" },
  registering: { tone: "warning", label: "Đang đăng ký" },
};

const TYPE_BANNER = {
  official: `linear-gradient(135deg, ${TOURNAMENT_COLOR.navy} 0%, ${TOURNAMENT_COLOR.primary} 100%)`,
  internal: `linear-gradient(135deg, ${TOURNAMENT_COLOR.navy} 0%, ${TOURNAMENT_COLOR.purple} 100%)`,
  team: `linear-gradient(135deg, ${TOURNAMENT_COLOR.navy} 0%, ${TOURNAMENT_COLOR.orange} 100%)`,
  daily: `linear-gradient(135deg, ${TOURNAMENT_COLOR.navy} 0%, ${TOURNAMENT_COLOR.success} 100%)`,
};

const ACTIVITY_TONE = {
  live: TOURNAMENT_COLOR.live,
  success: TOURNAMENT_COLOR.success,
  info: TOURNAMENT_COLOR.primary,
};

export default function TournamentCenterPage() {
  return (
    <TournamentExperienceShell
      title="Trung tâm giải đấu"
      subtitle="Vận hành toàn bộ giải của PICK_VN"
      showPublicSite
      actions={
        <Button variant="contained" size="small" startIcon={<AddIcon />}>
          Tạo giải
        </Button>
      }
    >
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        {CREATE_TYPES.map((item) => {
          const Icon = item.Icon;
          return (
            <Grid key={item.key} size={{ xs: 6, lg: 3 }}>
              <Paper
                elevation={0}
                role="button"
                tabIndex={0}
                sx={{
                  p: 1.25,
                  borderRadius: `${TOURNAMENT_RADIUS.card}px`,
                  border: `1px solid ${TOURNAMENT_COLOR.divider}`,
                  cursor: "pointer",
                  height: "100%",
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
          <TournamentKpiCard
            label="Đang diễn ra"
            value={FIXTURE_CENTER_STATS.ongoing.value}
            trend={FIXTURE_CENTER_STATS.ongoing.trend}
            tone="success"
            icon={<SportsTennisIcon />}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <TournamentKpiCard
            label="Sắp diễn ra"
            value={FIXTURE_CENTER_STATS.upcoming.value}
            trend={FIXTURE_CENTER_STATS.upcoming.trend}
            tone="info"
            icon={<CalendarMonthOutlinedIcon />}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <TournamentKpiCard
            label="Đang đăng ký"
            value={FIXTURE_CENTER_STATS.registering.value}
            trend={FIXTURE_CENTER_STATS.registering.trend}
            tone="warning"
            icon={<GroupsOutlinedIcon />}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <TournamentKpiCard
            label="Cần xử lý"
            value={FIXTURE_CENTER_STATS.attention.value}
            trend={FIXTURE_CENTER_STATS.attention.trend}
            tone="danger"
            icon={<WarningAmberIcon />}
          />
        </Grid>
      </Grid>

      <TournamentWorkspace
        rail={
          <>
            <TournamentRightRailCard
              title="Cần xử lý"
              priority
              icon={<ErrorOutlineIcon sx={{ fontSize: 16 }} />}
            >
              <Stack spacing={0.75}>
                {FIXTURE_TASKS.map((item) => (
                  <Stack key={item.label} direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontSize: 12.5 }}>{item.label}</Typography>
                    <Chip
                      size="small"
                      label={item.count}
                      sx={{
                        height: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        bgcolor: item.tone === "danger" ? TOURNAMENT_COLOR.dangerSurface : TOURNAMENT_COLOR.warningSurface,
                        color: item.tone === "danger" ? TOURNAMENT_COLOR.danger : TOURNAMENT_COLOR.warning,
                      }}
                    />
                  </Stack>
                ))}
              </Stack>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Hoạt động gần đây" icon={<HistoryIcon sx={{ fontSize: 16 }} />}>
              <Stack spacing={0.9}>
                {FIXTURE_ACTIVITY.map((item) => (
                  <Stack key={item.time} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        bgcolor: ACTIVITY_TONE[item.tone] || TOURNAMENT_COLOR.primary,
                        mt: 0.7,
                        flexShrink: 0,
                      }}
                    />
                    <Box>
                      <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, fontWeight: 600 }}>
                        {item.time}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, lineHeight: 1.35 }}>{item.text}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Hướng dẫn nhanh" icon={<HelpOutlineIcon sx={{ fontSize: 16 }} />}>
              <Stack spacing={0.6}>
                {["Cách tạo giải", "Thiết lập nội dung", "Xuất trang giải đấu công khai"].map((item) => (
                  <Typography key={item} sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.primary, fontWeight: 600 }}>
                    {item} →
                  </Typography>
                ))}
              </Stack>
            </TournamentRightRailCard>
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
            {["Tất cả", "Nháp", "Đăng ký", "Chuẩn bị", "Đang diễn ra"].map((label, index) => (
              <Chip
                key={label}
                label={label}
                clickable
                color={index === 0 ? "primary" : "default"}
                variant={index === 0 ? "filled" : "outlined"}
                size="small"
                sx={{ height: 26 }}
              />
            ))}
          </Stack>
        </Stack>

        <Grid container spacing={1.25}>
          {FIXTURE_TOURNAMENTS.map((item) => {
            const status = STATUS_TONE[item.status] || STATUS_TONE.preparing;
            const progress = item.matches ? Math.round((item.completedMatches / item.matches) * 100) : 0;
            return (
              <Grid key={item.id} size={{ xs: 12, md: 6 }}>
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
                    "&:hover": { borderColor: TOURNAMENT_COLOR.primaryLight },
                  }}
                >
                  <TournamentIdentitySurface gradient={TYPE_BANNER[item.type] || TYPE_BANNER.official} height={64}>
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
                          label={item.typeLabel}
                          sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: "rgba(255,255,255,0.16)", color: "#FFF" }}
                        />
                        <TournamentStatusChip tone={status.tone} label={status.label} />
                      </Stack>
                      <Typography sx={{ color: "#FFF", fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>
                        {item.name}
                      </Typography>
                    </Box>
                  </TournamentIdentitySurface>
                  <Box sx={{ p: 1.25, flex: 1, minWidth: 0 }}>
                    <Stack spacing={0.4} sx={{ mb: 1 }}>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <CalendarMonthOutlinedIcon sx={{ fontSize: 14, color: TOURNAMENT_COLOR.textMuted }} />
                        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{item.dates}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <PlaceOutlinedIcon sx={{ fontSize: 14, color: TOURNAMENT_COLOR.textMuted }} />
                        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{item.location}</Typography>
                      </Stack>
                    </Stack>
                    <Stack direction="row" spacing={1.5} sx={{ mb: 1 }}>
                      <Typography sx={{ fontSize: 12 }}>
                        <Box component="span" sx={{ fontWeight: 700 }}>{item.athletes}</Box> VĐV
                      </Typography>
                      <Typography sx={{ fontSize: 12 }}>
                        <Box component="span" sx={{ fontWeight: 700 }}>{item.events}</Box> nội dung
                      </Typography>
                      <Typography sx={{ fontSize: 12 }}>
                        <Box component="span" sx={{ fontWeight: 700 }}>{item.matches}</Box> trận
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={item.status === "ongoing" ? progress : item.status === "registering" ? 35 : 12}
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
                      to={tournamentPath(item.id)}
                      size="small"
                      variant="contained"
                      endIcon={<ChevronRightIcon />}
                    >
                      Mở giải
                    </Button>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}
