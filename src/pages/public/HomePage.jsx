import { Link as RouterLink } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import TournamentCard from "../../components/public/cards/TournamentCard.jsx";
import ClubCard from "../../components/public/cards/ClubCard.jsx";
import CourtCard from "../../components/public/cards/CourtCard.jsx";
import HeroSection from "../../components/public/sections/HeroSection.jsx";
import PublicSectionHeader from "../../components/public/sections/PublicSectionHeader.jsx";
import StatsSection from "../../components/public/sections/StatsSection.jsx";
import LiveDataHubSection from "../../components/public/sections/LiveDataHubSection.jsx";
import {
  PUBLIC_COLORS,
  publicContainerSx,
  sectionDarkSx,
} from "../../components/public/publicPortalStyles.js";
import { MOCK_UPCOMING_EVENTS } from "../../data/public/mockPublicData.js";
import {
  getFeaturedClubs,
  getFeaturedCourts,
  getFeaturedTournaments,
  getPublicLiveScores,
  getPublicNews,
  getPublicSponsors,
  getPublicStats,
} from "../../features/public-portal/services/publicPortalService.js";

export default function HomePage() {
  const stats = getPublicStats();
  const tournaments = getFeaturedTournaments(4);
  const clubs = getFeaturedClubs(5);
  const courts = getFeaturedCourts(4);
  const liveScores = getPublicLiveScores();
  const news = getPublicNews().slice(0, 4);
  const sponsors = getPublicSponsors();

  return (
    <Box sx={{ bgcolor: PUBLIC_COLORS.bg }}>
      <HeroSection />
      <StatsSection stats={stats} />

      {/* Giải đấu nổi bật */}
      <Box sx={sectionDarkSx}>
        <Box sx={publicContainerSx}>
          <PublicSectionHeader
            eyebrow="GIẢI ĐẤU"
            title="Giải đấu nổi bật"
            actionLabel="Xem tất cả giải đấu"
            actionTo="/tournaments"
          />
          <Grid container spacing={2}>
            {tournaments.map((t) => (
              <Grid key={t.id} size={{ xs: 12, sm: 6, md: 3 }}>
                <TournamentCard tournament={t} />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      <LiveDataHubSection liveMatch={liveScores[0]} />

      {/* CLB nổi bật */}
      <Box sx={{ ...sectionDarkSx, bgcolor: PUBLIC_COLORS.bgAlt }}>
        <Box sx={publicContainerSx}>
          <PublicSectionHeader
            eyebrow="CỘNG ĐỒNG"
            title="Câu lạc bộ nổi bật"
            actionLabel="Xem tất cả"
            actionTo="/clubs"
          />
          <Grid container spacing={2}>
            {clubs.map((club) => (
              <Grid key={club.id} size={{ xs: 12, sm: 6, md: 2.4 }}>
                <ClubCard club={club} />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      {/* Sân + Sự kiện sắp diễn ra */}
      <Box sx={sectionDarkSx}>
        <Box sx={publicContainerSx}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <PublicSectionHeader
                eyebrow="SÂN CHƠI"
                title="Sân pickleball nổi bật"
                actionLabel="Xem tất cả"
                actionTo="/courts"
              />
              <Grid container spacing={2}>
                {courts.map((court) => (
                  <Grid key={court.id} size={{ xs: 12, sm: 6 }}>
                    <CourtCard court={court} />
                  </Grid>
                ))}
              </Grid>
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <PublicSectionHeader eyebrow="SỰ KIỆN" title="Sự kiện sắp diễn ra" />
              <Stack spacing={1.5}>
                {MOCK_UPCOMING_EVENTS.map((ev) => (
                  <Stack
                    key={ev.title}
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: PUBLIC_COLORS.surface,
                      border: `1px solid ${PUBLIC_COLORS.border}`,
                    }}
                  >
                    <Box
                      sx={{
                        minWidth: 52,
                        textAlign: "center",
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: "rgba(197,232,49,0.12)",
                      }}
                    >
                      <Typography variant="h6" fontWeight={800} color={PUBLIC_COLORS.lime} lineHeight={1}>
                        {ev.day}
                      </Typography>
                      <Typography variant="caption" color={PUBLIC_COLORS.textMuted}>
                        {ev.month}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {ev.title}
                      </Typography>
                      <Typography variant="caption" color={PUBLIC_COLORS.textMuted}>
                        {ev.city}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* Tin tức + Sponsors */}
      <Box sx={{ ...sectionDarkSx, bgcolor: PUBLIC_COLORS.bgAlt }}>
        <Box sx={publicContainerSx}>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 8 }}>
              <PublicSectionHeader eyebrow="MEDIA" title="Thư viện hình ảnh" actionTo="/news" actionLabel="Xem thêm" />
              <Grid container spacing={1.5}>
                {news.map((item) => (
                  <Grid key={item.id} size={{ xs: 6, sm: 3 }}>
                    <Box
                      sx={{
                        height: 100,
                        borderRadius: 2,
                        bgcolor: PUBLIC_COLORS.surface,
                        border: `1px solid ${PUBLIC_COLORS.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.type === "video" ? (
                        <PlayArrowIcon sx={{ color: PUBLIC_COLORS.lime, fontSize: 32 }} />
                      ) : (
                        <ArticleOutlinedIcon sx={{ color: PUBLIC_COLORS.textMuted }} />
                      )}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <PublicSectionHeader eyebrow="ĐỐI TÁC" title="Nhà tài trợ & Đối tác" />
              <Stack direction="row" flexWrap="wrap" gap={1.5}>
                {sponsors.map((s) => (
                  <Avatar
                    key={s.id}
                    variant="rounded"
                    sx={{
                      width: 90,
                      height: 40,
                      bgcolor: PUBLIC_COLORS.surface,
                      border: `1px solid ${PUBLIC_COLORS.border}`,
                      borderRadius: 1.5,
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      color: PUBLIC_COLORS.textMuted,
                    }}
                  >
                    {s.name.split(" ")[0]}
                  </Avatar>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* CTA Banner — lime gradient như mockup */}
      <Box
        sx={{
          mx: { xs: 2, md: 4 },
          mb: 4,
          borderRadius: 3,
          background: PUBLIC_COLORS.ctaBannerGradient,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            ...publicContainerSx,
            py: { xs: 4, md: 5 },
            px: { xs: 3, md: 4 },
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "space-between",
            gap: 3,
          }}
        >
          <Box sx={{ maxWidth: 560 }}>
            <Typography variant="h5" fontWeight={800} color="#0B0F19" sx={{ mb: 1 }}>
              Bạn muốn tổ chức giải đấu? Quản lý CLB hoặc sân Pickleball?
            </Typography>
            <Typography variant="body2" color="rgba(11,15,25,0.75)">
              Đăng ký ngay để trải nghiệm hệ thống quản lý pickleball toàn diện nhất tại Việt Nam.
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            to="/login"
            endIcon={<ArrowForwardIcon />}
            sx={{
              bgcolor: "#0B0F19",
              color: PUBLIC_COLORS.lime,
              fontWeight: 700,
              px: 3,
              py: 1.5,
              borderRadius: 2,
              textTransform: "none",
              whiteSpace: "nowrap",
              "&:hover": { bgcolor: "#1a2030" },
            }}
          >
            Đăng ký miễn phí ngay
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
