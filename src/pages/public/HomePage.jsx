import { useEffect, useState } from "react";
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
import {
  PublicDataSourceNotice,
  PublicEmptyState,
  PublicErrorState,
  PublicLoadingState,
  PublicUnavailableState,
} from "../../components/public/states/index.js";
import { usePublicDocumentTitle } from "../../components/public/usePublicDocumentTitle.js";
import { PUBLIC_DATA_RESULT_STATUS } from "../../features/experience-channels/public-portal/data-source/index.js";
import {
  getPublicHomeSyncSections,
  projectHomeNewsSection,
  PUBLIC_HOME_SECTION_ID,
} from "../../features/public-portal/services/publicHomeDataSource.js";
import { getPublicNews } from "../../features/public-portal/services/publicPortalService.js";
import {
  loadPublicClubsPageResult,
  loadPublicCourtsPageResult,
} from "../../features/public-portal/services/publicClubsCourtsDataSource.js";
import {
  PUBLIC_PORTAL_EMPTY_CLUBS_MESSAGE,
  PUBLIC_PORTAL_EMPTY_COURTS_MESSAGE,
  PUBLIC_PORTAL_ERROR_USER_MESSAGE,
  PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE,
} from "../../features/public-portal/runtime/constants.js";
import { sanitizePublicPortalUserMessage } from "../../features/public-portal/runtime/resolvePublicPortalRuntime.js";
import { isPlatformHardCutoverEnabled } from "../../features/platform-hard-cutover/index.js";

function SectionBody({
  result,
  children,
  emptyTitle,
  emptyMessage,
  errorTitle,
  unavailableTitle,
  onRetry,
}) {
  if (!result) return null;

  if (result.status === PUBLIC_DATA_RESULT_STATUS.ERROR) {
    return (
      <PublicErrorState
        title={errorTitle}
        message={sanitizePublicPortalUserMessage(
          result.error,
          PUBLIC_PORTAL_ERROR_USER_MESSAGE
        )}
        actionLabel="Thử lại"
        onAction={onRetry}
      />
    );
  }

  if (result.status === PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE) {
    return (
      <PublicUnavailableState
        title={unavailableTitle}
        message={PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE}
        actionLabel="Thử lại"
        onAction={onRetry}
      />
    );
  }

  const rows = Array.isArray(result.data) ? result.data : [];
  if (result.status === PUBLIC_DATA_RESULT_STATUS.EMPTY || rows.length === 0) {
    return (
      <PublicEmptyState
        title={emptyTitle}
        message={emptyMessage}
        actionLabel="Thử lại"
        onAction={onRetry}
      />
    );
  }

  return children(rows);
}

function projectFeaturedList(result, sectionId, limit) {
  if (!result) return null;
  const all = Array.isArray(result.data) ? result.data : [];
  return Object.freeze({
    ...result,
    sectionId,
    data: all.slice(0, limit),
  });
}

export default function HomePage() {
  usePublicDocumentTitle("Trang chủ");
  const [retryToken, setRetryToken] = useState(0);
  const [newsSection, setNewsSection] = useState(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [clubsSection, setClubsSection] = useState(null);
  const [courtsSection, setCourtsSection] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const hardCutover = isPlatformHardCutoverEnabled(import.meta.env);
  const sections = getPublicHomeSyncSections({
    hardCutover,
    env: import.meta.env,
  });

  useEffect(() => {
    let cancelled = false;
    setNewsLoading(true);
    setNewsSection(null);
    getPublicNews({ limit: 4 }).then((result) => {
      if (!cancelled) {
        setNewsSection(projectHomeNewsSection(result));
        setNewsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    Promise.all([
      loadPublicClubsPageResult({ hardCutover, env: import.meta.env }),
      loadPublicCourtsPageResult({ hardCutover, env: import.meta.env }),
    ])
      .then(([clubsResult, courtsResult]) => {
        if (cancelled) return;
        setClubsSection(
          projectFeaturedList(clubsResult, PUBLIC_HOME_SECTION_ID.FEATURED_CLUBS, 5)
        );
        setCourtsSection(
          projectFeaturedList(courtsResult, PUBLIC_HOME_SECTION_ID.FEATURED_COURTS, 4)
        );
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retryToken, hardCutover]);

  const retry = () => setRetryToken((value) => value + 1);

  const stats = Array.isArray(sections.stats.data) ? sections.stats.data : [];
  const liveScores = Array.isArray(sections.liveScores.data) ? sections.liveScores.data : [];
  const schedule = Array.isArray(sections.schedule.data) ? sections.schedule.data : [];
  const results = Array.isArray(sections.results.data) ? sections.results.data : [];
  const featuredClubs = clubsSection || sections.clubs;
  const featuredCourts = courtsSection || sections.courts;

  return (
    <Box sx={{ bgcolor: PUBLIC_COLORS.bg }}>
      <HeroSection />
      <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, pt: 2 }}>
        <Box sx={publicContainerSx}>
          <PublicDataSourceNotice
            source={sections.stats.source}
            fallbackReason={sections.stats.fallbackReason}
          />
        </Box>
      </Box>
      {stats.length ? <StatsSection stats={stats} /> : null}

      {/* Giải đấu nổi bật */}
      <Box sx={sectionDarkSx}>
        <Box sx={publicContainerSx}>
          <PublicSectionHeader
            eyebrow="GIẢI ĐẤU"
            title="Giải đấu nổi bật"
            actionLabel="Xem tất cả giải đấu"
            actionTo="/tournaments"
          />
          <PublicDataSourceNotice
            source={sections.tournaments.source}
            fallbackReason={sections.tournaments.fallbackReason}
          />
          <SectionBody
            result={sections.tournaments}
            emptyTitle="Chưa có giải đấu nổi bật"
            emptyMessage="Hiện chưa có giải đấu công khai để giới thiệu trên trang chủ."
            errorTitle="Không tải được giải đấu nổi bật"
            unavailableTitle="Giải đấu nổi bật tạm thời không khả dụng"
            onRetry={retry}
          >
            {(tournaments) => (
              <Grid container spacing={2}>
                {tournaments.map((t) => (
                  <Grid key={t.id} size={{ xs: 12, sm: 6, md: 3 }}>
                    <TournamentCard tournament={t} />
                  </Grid>
                ))}
              </Grid>
            )}
          </SectionBody>
        </Box>
      </Box>

      <LiveDataHubSection
        liveMatch={liveScores[0] || null}
        schedule={schedule}
        results={results}
        scoreSource={sections.liveScores.source}
        scheduleSource={sections.schedule.source}
        resultsSource={sections.results.source}
        scoreFallbackReason={sections.liveScores.fallbackReason}
        scheduleFallbackReason={sections.schedule.fallbackReason}
        resultsFallbackReason={sections.results.fallbackReason}
      />

      {/* CLB nổi bật */}
      <Box sx={{ ...sectionDarkSx, bgcolor: PUBLIC_COLORS.bgAlt }}>
        <Box sx={publicContainerSx}>
          <PublicSectionHeader
            eyebrow="CỘNG ĐỒNG"
            title="Câu lạc bộ nổi bật"
            actionLabel="Xem tất cả"
            actionTo="/clubs"
          />
          <PublicDataSourceNotice
            source={featuredClubs.source}
            fallbackReason={featuredClubs.fallbackReason}
          />
          {catalogLoading && !clubsSection ? (
            <PublicLoadingState title="Đang tải câu lạc bộ nổi bật…" />
          ) : (
            <SectionBody
              result={featuredClubs}
              emptyTitle="Chưa có câu lạc bộ nổi bật"
              emptyMessage={PUBLIC_PORTAL_EMPTY_CLUBS_MESSAGE}
              errorTitle="Không tải được câu lạc bộ nổi bật"
              unavailableTitle="Câu lạc bộ nổi bật tạm thời không khả dụng"
              onRetry={retry}
            >
              {(clubs) => (
                <Grid container spacing={2}>
                  {clubs.map((club) => (
                    <Grid key={club.id} size={{ xs: 12, sm: 6, md: 2.4 }}>
                      <ClubCard club={club} />
                    </Grid>
                  ))}
                </Grid>
              )}
            </SectionBody>
          )}
        </Box>
      </Box>

      {/* Sân + Sự kiện mẫu */}
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
              <PublicDataSourceNotice
                source={featuredCourts.source}
                fallbackReason={featuredCourts.fallbackReason}
              />
              {catalogLoading && !courtsSection ? (
                <PublicLoadingState title="Đang tải sân nổi bật…" />
              ) : (
                <SectionBody
                  result={featuredCourts}
                  emptyTitle="Chưa có sân nổi bật"
                  emptyMessage={PUBLIC_PORTAL_EMPTY_COURTS_MESSAGE}
                  errorTitle="Không tải được sân nổi bật"
                  unavailableTitle="Sân nổi bật tạm thời không khả dụng"
                  onRetry={retry}
                >
                  {(courts) => (
                    <Grid container spacing={2}>
                      {courts.map((court) => (
                        <Grid key={court.id} size={{ xs: 12, sm: 6 }}>
                          <CourtCard court={court} />
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </SectionBody>
              )}
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <PublicSectionHeader eyebrow="SỰ KIỆN" title="Sự kiện minh họa" />
              <PublicDataSourceNotice
                source={sections.upcomingEvents.source}
                fallbackReason={sections.upcomingEvents.fallbackReason}
              />
              <SectionBody
                result={sections.upcomingEvents}
                emptyTitle="Chưa có sự kiện minh họa"
                emptyMessage="Danh sách sự kiện mẫu đang trống."
                errorTitle="Không tải được sự kiện"
                unavailableTitle="Sự kiện tạm thời không khả dụng"
                onRetry={retry}
              >
                {(events) => (
                  <Stack spacing={1.5}>
                    {events.map((ev) => (
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
                          <Typography
                            variant="h6"
                            fontWeight={800}
                            color={PUBLIC_COLORS.lime}
                            lineHeight={1}
                          >
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
                )}
              </SectionBody>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* Tin tức + Sponsors */}
      <Box sx={{ ...sectionDarkSx, bgcolor: PUBLIC_COLORS.bgAlt }}>
        <Box sx={publicContainerSx}>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 8 }}>
              <PublicSectionHeader
                eyebrow="MEDIA"
                title="Tin tức & media"
                actionTo="/news"
                actionLabel="Xem thêm"
              />
              {newsSection ? (
                <PublicDataSourceNotice
                  source={newsSection.source}
                  fallbackReason={newsSection.fallbackReason}
                />
              ) : null}
              {newsLoading ? (
                <PublicLoadingState
                  title="Đang tải tin tức…"
                  message="Vui lòng chờ trong giây lát."
                />
              ) : (
                <SectionBody
                  result={newsSection}
                  emptyTitle="Chưa có tin tức công khai"
                  emptyMessage="Hiện chưa có bài viết hoặc media để hiển thị trên trang chủ."
                  errorTitle="Không tải được tin tức"
                  unavailableTitle="Tin tức tạm thời không khả dụng"
                  onRetry={retry}
                >
                  {(news) => (
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
                  )}
                </SectionBody>
              )}
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <PublicSectionHeader eyebrow="ĐỐI TÁC" title="Nhà tài trợ & Đối tác (mẫu)" />
              <PublicDataSourceNotice
                source={sections.sponsors.source}
                fallbackReason={sections.sponsors.fallbackReason}
              />
              <SectionBody
                result={sections.sponsors}
                emptyTitle="Chưa có nhà tài trợ mẫu"
                emptyMessage="Danh sách đối tác minh họa đang trống."
                errorTitle="Không tải được nhà tài trợ"
                unavailableTitle="Nhà tài trợ tạm thời không khả dụng"
                onRetry={retry}
              >
                {(sponsors) => (
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
                )}
              </SectionBody>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* CTA Banner */}
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
