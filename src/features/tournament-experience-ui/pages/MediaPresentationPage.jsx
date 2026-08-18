import { useMemo, useState } from "react";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import CasinoOutlinedIcon from "@mui/icons-material/CasinoOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import ScoreboardOutlinedIcon from "@mui/icons-material/ScoreboardOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import { Box, Button, Dialog, Grid, Stack, Typography } from "@mui/material";

import { DeviceRow, OutputCatalogCard, PresentationStatusChip } from "../components/closureSurfaces.jsx";
import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import { FixtureAuthorityNote } from "../components/prototypeSurfaces.jsx";
import { TOURNAMENT_COLOR, TOURNAMENT_RADIUS } from "../design/tournamentDesignTokens.js";
import {
  FIXTURE_OUTPUTS,
  FIXTURE_PRESENTATION_DEVICES,
  FIXTURE_SPONSORS,
} from "../fixtures/opsFixture.js";
import { FIXTURE_LIVE_MATCHES, getFixtureTournament } from "../fixtures/prototypeFixture.js";
import { PRESENTATION_SESSION, resolvePresentationActions } from "../presentation/presentationSessionState.js";

const OUTPUT_ICONS = {
  draw: <CasinoOutlinedIcon fontSize="small" />,
  live: <ScoreboardOutlinedIcon fontSize="small" />,
  standings: <LeaderboardOutlinedIcon fontSize="small" />,
  bracket: <AccountTreeOutlinedIcon fontSize="small" />,
  court: <GridViewOutlinedIcon fontSize="small" />,
  champion: <EmojiEventsOutlinedIcon fontSize="small" />,
  sponsor: <CampaignOutlinedIcon fontSize="small" />,
  media: <VideocamOutlinedIcon fontSize="small" />,
};

function LiveScorePreview({ live, tournament, sessionStatus }) {
  const paused = sessionStatus === PRESENTATION_SESSION.PAUSED || sessionStatus === PRESENTATION_SESSION.READY;
  return (
    <Box sx={{ textAlign: "center" }}>
      <Typography sx={{ fontSize: 11, letterSpacing: 1.6, color: TOURNAMENT_COLOR.primaryLight, fontWeight: 700 }}>
        PICK_VN TRÌNH CHIẾU
      </Typography>
      <Typography sx={{ fontSize: { xs: 22, md: 30 }, fontWeight: 800, color: "#FFF", mt: 0.5 }}>{tournament.name}</Typography>
      <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.navyTextMuted }}>
        {live.event} • {live.stage} • {live.court}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ justifyContent: "center", mt: 1.25, mb: 1.5 }}>
        <PresentationStatusChip status={sessionStatus === PRESENTATION_SESSION.LIVE ? "LIVE" : paused ? "READY" : sessionStatus} />
        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.navyTextMuted, alignSelf: "center" }}>
          {sessionStatus === PRESENTATION_SESSION.LIVE ? "XEM TRƯỚC PHÁT SÓNG" : "XEM TRƯỚC — TẠM DỪNG"}
        </Typography>
      </Stack>
      <Stack spacing={0.75} sx={{ maxWidth: 720, mx: "auto" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.navyTextMuted }}>NHÀ</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: 16, md: 18 }, color: "#FFF" }}>{live.a}</Typography>
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.navyTextMuted }}>KHÁCH</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: 16, md: 18 }, color: "#FFF" }}>{live.b}</Typography>
          </Box>
        </Stack>
        <Box>
          <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.live, fontWeight: 800 }}>TỶ SỐ</Typography>
          <Typography
            data-testid="presentation-live-score"
            sx={{
              fontWeight: 800,
              fontSize: { xs: 16, md: 18 },
              color: TOURNAMENT_COLOR.live,
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {live.score}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

function OutputPreviewBody({ outputId, tournament, sessionStatus }) {
  const live = FIXTURE_LIVE_MATCHES[0];
  if (outputId === "live") return <LiveScorePreview live={live} tournament={tournament} sessionStatus={sessionStatus} />;
  if (outputId === "champion") {
    return (
      <Box sx={{ textAlign: "center" }}>
        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.navyTextMuted }}>Đầu ra vô địch</Typography>
        <Typography sx={{ fontSize: 28, fontWeight: 800, color: "#FFF" }}>Chưa xác định</Typography>
        <Typography sx={{ color: TOURNAMENT_COLOR.warning }}>Nội dung vẫn đang thi đấu — chưa xác định vô địch</Typography>
      </Box>
    );
  }
  if (outputId === "sponsor") {
    const active = FIXTURE_SPONSORS.find((item) => item.active);
    return (
      <Box sx={{ textAlign: "center" }}>
        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.navyTextMuted }}>Luân phiên nhà tài trợ</Typography>
        <Typography sx={{ fontSize: 32, fontWeight: 800, color: "#FFF", mt: 1 }}>{active?.name}</Typography>
        <Typography sx={{ color: TOURNAMENT_COLOR.primaryLight }}>{active?.slot} • {active?.duration}</Typography>
      </Box>
    );
  }
  const output = FIXTURE_OUTPUTS.find((item) => item.id === outputId);
  return (
    <Box sx={{ textAlign: "center" }}>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.navyTextMuted }}>{tournament.name}</Typography>
      <Typography sx={{ fontSize: { xs: 24, md: 32 }, fontWeight: 800, color: "#FFF", mt: 1 }}>{output?.label}</Typography>
      <Typography sx={{ color: TOURNAMENT_COLOR.navyTextMuted, mt: 1 }}>{output?.hint}</Typography>
    </Box>
  );
}

export default function MediaPresentationPage() {
  const tournament = getFixtureTournament();
  const live = FIXTURE_LIVE_MATCHES[0];
  const [active, setActive] = useState("live");
  const [sessionStatus, setSessionStatus] = useState(PRESENTATION_SESSION.LIVE);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const output = useMemo(() => FIXTURE_OUTPUTS.find((item) => item.id === active), [active]);
  const actions = resolvePresentationActions(sessionStatus);
  const outputUrl = `fixture://pick-vn-open-2026/${active}`;
  const obsUrl = `fixture://obs/pick-vn-open-2026/${active}`;
  const startedAt = "10:20";

  const startPresentation = () => {
    if (!actions.startEnabled) return;
    setSessionStatus(PRESENTATION_SESSION.LIVE);
  };
  const previewSession = () => {
    if (!actions.previewEnabled) return;
    setSessionStatus(PRESENTATION_SESSION.READY);
  };
  const pauseSession = () => {
    if (!actions.pauseEnabled) return;
    setSessionStatus(PRESENTATION_SESSION.PAUSED);
  };
  const resumePresentation = () => {
    if (!actions.resumeEnabled) return;
    setSessionStatus(PRESENTATION_SESSION.LIVE);
  };

  const previewSurface = (
    <Box
      sx={{
        p: { xs: 1.5, md: 2.5 },
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        bgcolor: TOURNAMENT_COLOR.drawBg,
        border: "1px solid rgba(255,255,255,0.08)",
        minHeight: { xs: 260, md: 320 },
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <OutputPreviewBody outputId={active} tournament={tournament} sessionStatus={sessionStatus} />
      <Box
        sx={{
          mt: 2,
          px: 1.25,
          py: 0.85,
          borderRadius: `${TOURNAMENT_RADIUS.control}px`,
          bgcolor: TOURNAMENT_COLOR.drawSurface,
          textAlign: "center",
        }}
      >
        <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.navyTextMuted }}>Ô NHÀ TÀI TRỢ / THƯƠNG HIỆU</Typography>
        <Typography sx={{ fontWeight: 800, color: "#FFF", fontSize: 14 }}>PICK_VN • Yonex • Nam Long Courts</Typography>
      </Box>
    </Box>
  );

  return (
    <TournamentExperienceShell
      title="Trung tâm truyền thông & trình chiếu"
      subtitle="Điều khiển trình chiếu / phát sóng — không phải trung tâm thông báo"
      showEventContext
    >
      <FixtureAuthorityNote>
        Màn này không phát luồng thật. Phiên trình chiếu chỉ là nguyên mẫu.
      </FixtureAuthorityNote>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", lg: `minmax(0, 1fr) 300px` },
          gridTemplateAreas: {
            xs: `"catalog" "preview" "rail" "controls"`,
            lg: `"catalog catalog" "preview rail" "controls rail"`,
          },
        }}
      >
        <Box sx={{ gridArea: "catalog", minWidth: 0 }}>
          <TournamentSectionTitle>Danh mục nội dung trình chiếu</TournamentSectionTitle>
          <Grid container spacing={1}>
            {FIXTURE_OUTPUTS.map((item) => (
              <Grid key={item.id} size={{ xs: 6, sm: 4, md: 3 }}>
                <OutputCatalogCard
                  item={item}
                  selected={active === item.id}
                  onSelect={() => setActive(item.id)}
                  icon={OUTPUT_ICONS[item.id]}
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box sx={{ gridArea: "preview", minWidth: 0 }}>
          <TournamentSectionTitle>Xem trước trình chiếu đang chọn</TournamentSectionTitle>
          {previewSurface}
        </Box>

        <Box sx={{ gridArea: "rail", minWidth: 0 }}>
          <TournamentRightRailCard title="Phiên trình chiếu">
            <Stack spacing={0.7}>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Trạng thái phiên</Typography>
                <PresentationStatusChip status={sessionStatus} />
              </Stack>
              <Typography sx={{ fontSize: 13 }}><b>Đầu ra đang chọn:</b> {output?.label}</Typography>
              <Typography sx={{ fontSize: 13 }}><b>Bắt đầu:</b> {startedAt}</Typography>
              <Typography sx={{ fontSize: 13 }}><b>Điều hành:</b> Admin BTC</Typography>
              <Typography sx={{ fontSize: 12, wordBreak: "break-all" }}><b>URL đầu ra:</b> {outputUrl}</Typography>
              <Typography sx={{ fontSize: 13 }}><b>Chế độ:</b> {actions.modeLabel}</Typography>
            </Stack>
          </TournamentRightRailCard>
          <TournamentRightRailCard title="Đầu ra / Thiết bị">
            {FIXTURE_PRESENTATION_DEVICES.map((device) => (
              <DeviceRow key={device.id} device={device} />
            ))}
          </TournamentRightRailCard>
          <TournamentRightRailCard title="OBS / Ngữ cảnh phát sóng">
            <Typography sx={{ fontSize: 12.5 }}><b>Đầu ra OBS:</b> {obsUrl}</Typography>
            <Typography sx={{ fontSize: 12.5 }}><b>Đích phát sóng:</b> YouTube / Facebook — dữ liệu mẫu</Typography>
            <Typography sx={{ fontSize: 12.5, mb: 0.75 }}><b>Xem trước:</b> {live.event} • {live.score}</Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setCopied(true)}
            >
              {copied ? "Đã sao chép (mẫu)" : "Sao chép liên kết"}
            </Button>
          </TournamentRightRailCard>
          <TournamentRightRailCard title="Luân phiên nhà tài trợ">
            {FIXTURE_SPONSORS.map((item) => (
              <Stack key={item.id} direction="row" sx={{ justifyContent: "space-between", py: 0.45, alignItems: "center" }}>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{item.name}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{item.slot} • {item.duration}</Typography>
                </Box>
                <PresentationStatusChip status={item.active ? "LIVE" : "READY"} />
              </Stack>
            ))}
          </TournamentRightRailCard>
        </Box>

        <Box sx={{ gridArea: "controls", minWidth: 0 }}>
          <TournamentSectionTitle>Điều khiển trình chiếu</TournamentSectionTitle>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button size="small" variant="outlined" disabled={!actions.previewEnabled} onClick={previewSession}>Xem trước</Button>
            {actions.resumeVisible ? (
              <Button size="small" variant="contained" disabled={!actions.resumeEnabled} onClick={resumePresentation}>
                Tiếp tục trình chiếu
              </Button>
            ) : (
              <Button size="small" variant="contained" disabled={!actions.startEnabled} onClick={startPresentation}>
                Bắt đầu trình chiếu
              </Button>
            )}
            <Button size="small" variant="outlined" disabled={!actions.pauseEnabled} onClick={pauseSession}>Tạm dừng</Button>
            <Button
              size="small"
              variant="outlined"
              disabled={!actions.switchEnabled}
              onClick={() => {
                if (!actions.switchEnabled) return;
                const ids = FIXTURE_OUTPUTS.map((item) => item.id);
                const next = ids[(ids.indexOf(active) + 1) % ids.length];
                setActive(next);
              }}
            >
              Chuyển nội dung phát
            </Button>
            <Button size="small" variant="outlined" disabled={!actions.fullscreenEnabled} onClick={() => actions.fullscreenEnabled && setFullscreen(true)}>Toàn màn hình</Button>
          </Stack>
        </Box>
      </Box>
      <Dialog fullScreen open={fullscreen} onClose={() => setFullscreen(false)}>
        <Box sx={{ bgcolor: TOURNAMENT_COLOR.drawBg, minHeight: "100%", p: 2 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", mb: 2 }}>
            <Typography sx={{ color: "#FFF", fontWeight: 800 }}>Xem trước toàn màn hình</Typography>
            <Button size="small" variant="contained" onClick={() => setFullscreen(false)}>Đóng</Button>
          </Stack>
          {previewSurface}
        </Box>
      </Dialog>
    </TournamentExperienceShell>
  );
}
