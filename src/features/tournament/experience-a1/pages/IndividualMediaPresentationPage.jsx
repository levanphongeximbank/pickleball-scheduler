import { useState } from "react";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import CasinoOutlinedIcon from "@mui/icons-material/CasinoOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import ScoreboardOutlinedIcon from "@mui/icons-material/ScoreboardOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, Button, Dialog, Grid, Stack, Typography } from "@mui/material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useClub } from "../../../../context/ClubContext.jsx";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import {
  BatchBError,
  BatchBLoading,
  BatchBMissingTournament,
  BatchBWrongFamily,
  ExperienceBatchBFrame,
} from "../batchB/ExperienceBatchBFrame.jsx";
import { eventDisplayName } from "../batchB/eventScope.js";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR, TOURNAMENT_RADIUS } from "../visual/tournamentExperienceTokens.js";
import { individualOverviewPath } from "../routes.js";
import { BatchFNav } from "../batchF/BatchFNav.jsx";
import {
  DeviceRow,
  OutputCatalogCard,
  PresentationStatusChip,
} from "../batchF/ExperienceBatchFSurfaces.jsx";
import { deriveMediaPresentationModel } from "../batchF/deriveMediaPresentation.js";
import { PRESENTATION_SESSION, resolvePresentationActions } from "../batchF/presentationSessionState.js";

const TITLE = "Trung tâm truyền thông & trình chiếu";
const SUBTITLE = "Điều khiển trình chiếu / phát sóng — không phải trung tâm thông báo";
const TEST_ID = "tournament-media-page";

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
      {live ? (
        <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.navyTextMuted }}>
          {[live.event, live.stage, live.court].filter(Boolean).join(" • ")}
        </Typography>
      ) : (
        <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.navyTextMuted }}>Chưa có trận live trên hồ sơ</Typography>
      )}
      <Stack direction="row" spacing={1} sx={{ justifyContent: "center", mt: 1.25, mb: 1.5 }}>
        <PresentationStatusChip status={sessionStatus === PRESENTATION_SESSION.LIVE ? "LIVE" : paused ? "READY" : sessionStatus} />
      </Stack>
      {live ? (
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
      ) : (
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.navyTextMuted }}>Không có tỷ số để xem trước.</Typography>
      )}
    </Box>
  );
}

export default function IndividualMediaPresentationPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "all";
  const [active, setActive] = useState("live");
  const [sessionStatus, setSessionStatus] = useState(PRESENTATION_SESSION.OFFLINE);
  const [fullscreen, setFullscreen] = useState(false);

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải trình chiếu…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;

  const model = deriveMediaPresentationModel(tournament, { selectedEventId, activeOutputId: active });
  const output = model.outputs.find((item) => item.id === active);
  const actions = resolvePresentationActions(sessionStatus);
  const setEvent = (id) => {
    const next = new URLSearchParams(searchParams);
    if (!id || id === "all") next.delete("eventId");
    else next.set("eventId", id);
    setSearchParams(next);
  };

  const previewBody = (() => {
    if (active === "live") {
      return <LiveScorePreview live={model.livePreview} tournament={tournament} sessionStatus={sessionStatus} />;
    }
    if (active === "champion") {
      return (
        <Box sx={{ textAlign: "center" }}>
          <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.navyTextMuted }}>Đầu ra vô địch</Typography>
          <Typography sx={{ fontSize: 28, fontWeight: 800, color: "#FFF" }}>
            {model.championPreview || "Chưa xác định"}
          </Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ textAlign: "center" }}>
        <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.navyTextMuted }}>{tournament.name}</Typography>
        <Typography sx={{ fontSize: { xs: 24, md: 32 }, fontWeight: 800, color: "#FFF", mt: 1 }}>{output?.label}</Typography>
        <Typography sx={{ color: TOURNAMENT_COLOR.navyTextMuted, mt: 1 }}>{output?.hint}</Typography>
      </Box>
    );
  })();

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
      {previewBody}
    </Box>
  );

  return (
    <ExperienceBatchBFrame
      testId={TEST_ID}
      title={TITLE}
      subtitle={SUBTITLE}
      contextLine={[model.tournamentName, model.eventName].filter(Boolean).join(" • ")}
      actions={
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
          Tổng quan
        </Button>
      }
    >
      <BatchFNav tournamentId={tournamentId} eventId={selectedEventId === "all" ? "" : selectedEventId} current="media" />
      {model.events.length > 1 ? (
        <ExperienceChipRow
          value={selectedEventId}
          onChange={setEvent}
          items={[{ id: "all", label: "Mọi nội dung" }, ...model.events.map((event) => ({ id: event.id, label: eventDisplayName(event) }))]}
        />
      ) : null}
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 300px" },
          gridTemplateAreas: {
            xs: `"catalog" "preview" "rail" "controls"`,
            lg: `"catalog catalog" "preview rail" "controls rail"`,
          },
        }}
      >
        <Box sx={{ gridArea: "catalog", minWidth: 0 }}>
          <ExperienceSectionTitle>Danh mục nội dung trình chiếu</ExperienceSectionTitle>
          <Grid container spacing={1}>
            {model.outputs.map((item) => (
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
          <ExperienceSectionTitle>Xem trước trình chiếu đang chọn</ExperienceSectionTitle>
          {previewSurface}
        </Box>
        <Box sx={{ gridArea: "rail", minWidth: 0 }}>
          <CenterRightRailCard title="Phiên trình chiếu">
            <Stack spacing={0.7}>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Trạng thái phiên</Typography>
                <PresentationStatusChip status={sessionStatus} />
              </Stack>
              <Typography sx={{ fontSize: 13 }}><b>Đầu ra đang chọn:</b> {output?.label}</Typography>
              <Typography sx={{ fontSize: 13 }}><b>Chế độ:</b> {actions.modeLabel}</Typography>
              <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                Phiên trình chiếu chỉ trên máy này — không ghi hồ sơ phát sóng.
              </Typography>
            </Stack>
          </CenterRightRailCard>
          <CenterRightRailCard title="Đầu ra / Thiết bị">
            {model.devices.length ? model.devices.map((device) => <DeviceRow key={device.id} device={device} />) : (
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có thiết bị trên hồ sơ.</Typography>
            )}
          </CenterRightRailCard>
          <CenterRightRailCard title="OBS / Ngữ cảnh phát sóng">
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
              Chưa có liên kết OBS/phát sóng trên hồ sơ giải.
            </Typography>
          </CenterRightRailCard>
        </Box>
        <Box sx={{ gridArea: "controls", minWidth: 0 }}>
          <ExperienceSectionTitle>Điều khiển trình chiếu</ExperienceSectionTitle>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button size="small" variant="outlined" disabled={!actions.previewEnabled} onClick={() => setSessionStatus(PRESENTATION_SESSION.READY)}>
              Xem trước
            </Button>
            {actions.resumeVisible ? (
              <Button size="small" variant="contained" disabled={!actions.resumeEnabled} onClick={() => setSessionStatus(PRESENTATION_SESSION.LIVE)}>
                Tiếp tục trình chiếu
              </Button>
            ) : (
              <Button size="small" variant="contained" disabled={!actions.startEnabled} onClick={() => setSessionStatus(PRESENTATION_SESSION.LIVE)}>
                Bắt đầu trình chiếu
              </Button>
            )}
            <Button size="small" variant="outlined" disabled={!actions.pauseEnabled} onClick={() => setSessionStatus(PRESENTATION_SESSION.PAUSED)}>
              Tạm dừng
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={!actions.switchEnabled}
              onClick={() => {
                const ids = model.outputs.map((item) => item.id);
                setActive(ids[(ids.indexOf(active) + 1) % ids.length]);
              }}
            >
              Chuyển nội dung phát
            </Button>
            <Button size="small" variant="outlined" disabled={!actions.fullscreenEnabled} onClick={() => setFullscreen(true)}>
              Toàn màn hình
            </Button>
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
    </ExperienceBatchBFrame>
  );
}
