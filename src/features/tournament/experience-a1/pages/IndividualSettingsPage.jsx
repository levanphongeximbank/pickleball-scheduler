import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Alert,
  Box,
  Button,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import PermissionGate from "../../../../components/auth/PermissionGate.jsx";
import ClubAssignmentBanner from "../../../../components/auth/ClubAssignmentBanner.jsx";
import { PERMISSIONS } from "../../../../auth/permissions.js";
import {
  individualPublicTournamentPath,
  isIndividualTournament,
} from "../../../../config/tournamentRoutes.js";
import {
  EVENT_TYPE,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_OPTIONS,
  OFFICIAL_MODE,
} from "../../../../models/tournament/constants.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import {
  deriveFormatSteps,
  eventHasStartedCompetition,
  isInternalCompatibilityFamily,
  isOfficialOpenFamily,
  listTournamentEvents,
  MULTI_CONTENT_LIMITATION_INTERNAL,
  resolveSelectedEvent,
} from "../deriveOverview.js";
import { individualOverviewPath } from "../routes.js";
import {
  OFFICIAL_MATCH_FORMAT,
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_SCORING_METHOD,
  BEST_OF_3_OPERATIONAL,
  SIDEOUT_OPERATIONAL,
  getOfficialCompetitionSettings,
} from "../../../individual-tournament/engines/officialTournamentSettingsEngine.js";
import { getEligibilityRules } from "../../../individual-tournament/engines/eligibilityEngine.js";
import {
  resolveTournamentExperienceAdapter,
  isOfficialTournamentExperience,
} from "../experienceModeResolver.js";
import { buildOfficialSettingsSavePatch } from "../../official-tournament-experience/officialExperienceCommands.js";
import {
  buildAddOfficialEventPatch,
  buildIdentityPatch,
  buildUpdateEventPatch,
} from "../settingsWriters.js";
import CenterIdentitySurface from "../visual/CenterIdentitySurface.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceOperatorCard from "../visual/ExperienceOperatorCard.jsx";
import ExperiencePageHeader from "../visual/ExperiencePageHeader.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import ExperienceStatusChip from "../visual/ExperienceStatusChip.jsx";
import {
  TOURNAMENT_COLOR,
  TOURNAMENT_RADIUS,
  outlinedActionSx,
  primaryActionSx,
} from "../visual/tournamentExperienceTokens.js";
import { modeLabelVi, statusLabelVi } from "../../constants/tournamentLabels.js";

const TABS = [
  { id: "info", label: "Thông tin chung" },
  { id: "format", label: "Thiết kế thể thức" },
  { id: "rules", label: "Quy định" },
  { id: "fees", label: "Lệ phí & Giải thưởng" },
  { id: "schedule", label: "Lịch trình" },
];

const OFFICIAL_MODE_LABELS = {
  [OFFICIAL_MODE.OPEN]: "Mở rộng",
  [OFFICIAL_MODE.AI_BALANCE]: "Cân bằng AI",
};

const CONFIG_CARDS = [
  { title: "Độ tuổi", detail: "Mở trang quy định độ tuổi hiện có.", path: "/tournament/config/age-rules" },
  { title: "Giới tính", detail: "Mở trang quy định giới tính hiện có.", path: "/tournament/config/gender-rules" },
  { title: "Điều kiện tham gia", detail: "Mở trang điều kiện tham gia hiện có.", path: "/tournament/eligibility/check" },
  { title: "Mẫu điều lệ", detail: "Mở trang điều lệ hiện có.", path: "/tournament/config/regulations" },
];

function configPath(path, tournamentId) {
  const id = String(tournamentId || "").trim();
  return id ? `${path}?tournamentId=${encodeURIComponent(id)}` : path;
}

function FormatDesigner({ steps, locked = false, emptyText }) {
  return (
    <Box>
      <ExperienceSectionTitle
        action={locked ? <ExperienceStatusChip tone="success" label="ĐÃ KHÓA" /> : null}
      >
        Thiết kế thể thức
      </ExperienceSectionTitle>
      {locked ? (
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning, mb: 1 }}>
          Các cấu hình ảnh hưởng thi đấu đã khóa vì nội dung đã có trận. Không đổi thể thức trên màn này.
        </Typography>
      ) : null}
      {steps.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
          {emptyText}
        </Typography>
      ) : (
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          useFlexGap
          sx={{ alignItems: { xs: "stretch", md: "center" }, flexWrap: { xs: "nowrap", md: "wrap" } }}
        >
          {steps.map((step, index) => (
            <Stack
              key={step.id}
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              sx={{ alignItems: { xs: "stretch", md: "center" } }}
            >
              <ExperienceOperatorCard
                sx={{
                  minWidth: { xs: 0, md: 128 },
                  textAlign: "center",
                  bgcolor: index === 0 ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
                  borderColor: index === 0 ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider,
                }}
              >
                <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>Bước {index + 1}</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{step.label}</Typography>
                <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>{step.vi}</Typography>
              </ExperienceOperatorCard>
              {index < steps.length - 1 ? (
                <ArrowForwardIcon
                  sx={{
                    display: { xs: "none", md: "block" },
                    color: TOURNAMENT_COLOR.primary,
                    fontSize: 18,
                  }}
                />
              ) : null}
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function SettingsShell({ children, actions, contextLine }) {
  return (
    <Box
      data-testid="tournament-settings-page"
      sx={{ width: "100%", minWidth: 0, overflowX: "hidden", bgcolor: TOURNAMENT_COLOR.pageBg }}
    >
      <ExperiencePageHeader
        title="Cài đặt Giải đấu / Nội dung"
        subtitle="Cài đặt giải đấu tách cài đặt nội dung"
        contextLine={contextLine}
        actions={actions}
      />
      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>{children}</Box>
    </Box>
  );
}

export default function IndividualSettingsPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, refreshClubs } = useClub();
  const { tournament, loading, error, update } = useCanonicalTournament(activeClub, tournamentId);
  const [scope, setScope] = useState(searchParams.get("eventId") ? "event" : "tournament");
  const [tab, setTab] = useState("info");
  const [name, setName] = useState("");
  const [hostClubName, setHostClubName] = useState("");
  const [officialMode, setOfficialMode] = useState(OFFICIAL_MODE.OPEN);
  const [eventType, setEventType] = useState(EVENT_TYPE.MEN_DOUBLE);
  const [addEventType, setAddEventType] = useState(EVENT_TYPE.MEN_DOUBLE);
  const [eventName, setEventName] = useState("");
  const [registrationMode, setRegistrationMode] = useState(OFFICIAL_REGISTRATION_MODE.INDIVIDUAL);
  const [groupCount, setGroupCount] = useState(4);
  const [scoringMethod, setScoringMethod] = useState(OFFICIAL_SCORING_METHOD.RALLY);
  const [matchFormat, setMatchFormat] = useState(OFFICIAL_MATCH_FORMAT.BEST_OF_1);
  const [maxLevel, setMaxLevel] = useState("");
  const [maxRating, setMaxRating] = useState("");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const selectedEventId = searchParams.get("eventId") || "";
  const events = listTournamentEvents(tournament);
  const selectedEvent = resolveSelectedEvent(events, selectedEventId);
  const official = isOfficialOpenFamily(tournament);
  const internal = isInternalCompatibilityFamily(tournament);
  const competitionLocked = Boolean(selectedEvent && eventHasStartedCompetition(selectedEvent));
  const formatSteps = deriveFormatSteps(selectedEvent);
  const officialAdapter =
    tournament && isOfficialTournamentExperience(tournament)
      ? resolveTournamentExperienceAdapter(tournament, { selectedEventId })
      : null;

  useEffect(() => {
    if (!tournament || dirty) return;
    setName(tournament.name || "");
    setHostClubName(tournament.hostClubName || "");
    setOfficialMode(tournament.officialMode || OFFICIAL_MODE.OPEN);
    if (isOfficialOpenFamily(tournament)) {
      const competition = getOfficialCompetitionSettings(tournament);
      const eligibility = getEligibilityRules(tournament);
      setRegistrationMode(competition.registrationMode || OFFICIAL_REGISTRATION_MODE.INDIVIDUAL);
      setGroupCount(competition.groupCount || 4);
      setScoringMethod(competition.scoringMethodOperational || OFFICIAL_SCORING_METHOD.RALLY);
      setMatchFormat(competition.matchFormatOperational || OFFICIAL_MATCH_FORMAT.BEST_OF_1);
      setMaxLevel(
        eligibility?.skill?.maxLevel != null ? String(eligibility.skill.maxLevel) : ""
      );
      setMaxRating(
        eligibility?.rating?.maxRating != null ? String(eligibility.rating.maxRating) : ""
      );
    }
  }, [tournament, dirty]);

  useEffect(() => {
    if (dirty) return;
    if (selectedEvent) {
      setEventName(selectedEvent.name || "");
      setEventType(selectedEvent.eventType || EVENT_TYPE.MEN_DOUBLE);
    } else {
      setEventName("");
    }
  }, [selectedEvent, dirty]);

  const persist = async (patch, successText) => {
    setBusy(true);
    setMessage(null);
    const result = await update(patch);
    setBusy(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không lưu được." });
      return false;
    }
    setDirty(false);
    refreshClubs();
    setMessage({ type: "success", text: successText });
    return true;
  };

  const handleSaveIdentity = async () => {
    if (official) {
      const built =
        officialAdapter?.commands?.saveSettings?.(tournament, {
          name,
          hostClubName,
          officialMode,
          registrationMode,
          groupCount: Number(groupCount) || 4,
          scoringMethod,
          matchFormat,
          maxLevel,
          maxRating,
        }) ||
        buildOfficialSettingsSavePatch(tournament, {
          name,
          hostClubName,
          officialMode,
          registrationMode,
          groupCount: Number(groupCount) || 4,
          scoringMethod,
          matchFormat,
          maxLevel,
          maxRating,
        });
      if (!built.ok) {
        setMessage({ type: "error", text: built.error || "Không lưu được." });
        return;
      }
      await persist(built.patch, "Đã lưu cài đặt Official (readback từ hồ sơ).");
      return;
    }
    const patch = buildIdentityPatch({
      name,
      hostClubName,
      officialMode: official ? officialMode : undefined,
    });
    await persist(patch, "Đã lưu thông tin giải.");
  };

  const handleAddEvent = async () => {
    if (!official) return;
    const { patch, event } = buildAddOfficialEventPatch(tournament, addEventType);
    if (await persist(patch, "Đã thêm nội dung.")) {
      const next = new URLSearchParams(searchParams);
      next.set("eventId", event.id);
      setSearchParams(next);
      setScope("event");
    }
  };

  const handleSaveEvent = async () => {
    if (!selectedEvent) {
      setMessage({ type: "error", text: "Hãy chọn nội dung trước khi lưu." });
      return;
    }
    const result = buildUpdateEventPatch(tournament, selectedEvent.id, {
      name: eventName,
      eventType,
    });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    await persist(result.patch, "Đã lưu nội dung đang chọn.");
  };

  const handlePrimarySave = () => {
    if (scope === "event") return handleSaveEvent();
    return handleSaveIdentity();
  };

  const selectEvent = (eventId) => {
    const next = new URLSearchParams(searchParams);
    if (eventId) next.set("eventId", eventId);
    else next.delete("eventId");
    setSearchParams(next);
  };

  const headerActions = (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
        Tổng quan
      </Button>
      {competitionLocked && scope === "event" ? (
        <Button variant="outlined" size="small" disabled sx={outlinedActionSx}>
          Xem cấu hình
        </Button>
      ) : (
        <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<SaveOutlinedIcon />}
            disabled={busy}
            onClick={handlePrimarySave}
            sx={outlinedActionSx}
          >
            Lưu nháp
          </Button>
        </PermissionGate>
      )}
      <Button
        variant="outlined"
        size="small"
        startIcon={<VisibilityOutlinedIcon />}
        component={RouterLink}
        to={individualPublicTournamentPath(tournamentId)}
        sx={outlinedActionSx}
      >
        Xem trước
      </Button>
      <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
        <Button variant="contained" size="small" disabled={busy} onClick={handlePrimarySave} sx={primaryActionSx}>
          {competitionLocked && scope === "event" ? "Cập nhật thông tin" : "Cập nhật"}
        </Button>
      </PermissionGate>
    </Stack>
  );

  if (loading) {
    return (
      <SettingsShell>
        <Alert severity="info">Đang tải cài đặt giải…</Alert>
      </SettingsShell>
    );
  }
  if (error) {
    return (
      <SettingsShell>
        <Alert severity="error">{error}</Alert>
      </SettingsShell>
    );
  }
  if (!tournament) {
    return (
      <SettingsShell>
        <ClubAssignmentBanner />
        <Alert severity="warning">Không tìm thấy giải. Chọn CLB trên thanh công cụ rồi mở lại giải.</Alert>
      </SettingsShell>
    );
  }
  if (!isIndividualTournament(tournament)) {
    return (
      <SettingsShell>
        <Alert severity="info">
          Cài đặt này dành cho giải cá nhân / chính thức.{" "}
          <Button component={RouterLink} to="/tournament" size="small">
            Quay lại
          </Button>
        </Alert>
      </SettingsShell>
    );
  }

  const scheduleDate = tournament.courtSchedule?.date || "";
  const typeLabel = modeLabelVi(tournament.mode);
  const eventMeta = selectedEvent
    ? `${EVENT_TYPE_LABELS[selectedEvent.eventType] || "Nội dung"} • ${Array.isArray(selectedEvent.entries) ? selectedEvent.entries.length : 0} cặp • ${statusLabelVi(selectedEvent.status) || "Chưa cấu hình"}`
    : "Chưa chọn nội dung để cấu hình";

  return (
    <SettingsShell
      contextLine={scope === "event" ? selectedEvent?.name : null}
      actions={headerActions}
    >
      <ClubAssignmentBanner />
      {message ? (
        <Alert severity={message.type} sx={{ mb: 1.25 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <TournamentExperienceWorkspace
        rail={
          <>
            <CenterRightRailCard title="Phạm vi cấu hình">
              <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mb: 0.75 }}>
                Giải đấu và Nội dung là hai phạm vi riêng.
              </Typography>
              <Stack spacing={0.6}>
                <Typography sx={{ fontSize: 12.5 }}>
                  <strong>Giải đấu</strong> = {tournament.name}
                </Typography>
                <Typography sx={{ fontSize: 12.5 }}>
                  <strong>Nội dung</strong> = {scope === "event" ? selectedEvent?.name || "Chưa chọn để cấu hình" : "Chưa chọn để cấu hình"}
                </Typography>
              </Stack>
            </CenterRightRailCard>
            {competitionLocked && scope === "event" ? (
              <CenterRightRailCard title="Trạng thái cấu hình">
                <ExperienceStatusChip tone="success" label="ĐÃ KHÓA" />
                <Typography sx={{ fontSize: 12.5, mt: 0.75, fontWeight: 700 }}>
                  Nội dung đã bắt đầu thi đấu
                </Typography>
                <Typography sx={{ fontSize: 12.5, mt: 0.5 }}>
                  Các cấu hình ảnh hưởng thi đấu đã khóa. Chỉ thông tin tên / hạng mục còn lưu được.
                </Typography>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 0.75 }}>
                  Thay đổi thể thức sau khi nội dung đã bắt đầu cần quy trình điều chỉnh riêng — chưa có trên màn này.
                </Typography>
              </CenterRightRailCard>
            ) : (
              <CenterRightRailCard title="Mức sẵn sàng">
                <ExperienceStatusChip
                  tone={tournament.status === "draft" ? "info" : "success"}
                  label={statusLabelVi(tournament.status) || "BẢN NHÁP"}
                />
                <Typography sx={{ fontSize: 12.5, mt: 0.75 }}>
                  Lưu chỉ cập nhật hồ sơ giải. Không khóa đăng ký, không công bố, không hoàn tất.
                </Typography>
              </CenterRightRailCard>
            )}
            <CenterRightRailCard title="Tác động">
              <Typography sx={{ fontSize: 12.5 }}>
                {competitionLocked && scope === "event"
                  ? "Cấu hình thi đấu đã khóa. Chỉ thông tin không đổi thể thức có thể cập nhật."
                  : "Lưu nháp không công bố công khai, không khóa đăng ký, không khóa bốc thăm."}
              </Typography>
            </CenterRightRailCard>
            <CenterRightRailCard title="Lưu gần nhất">
              <Typography sx={{ fontSize: 12.5 }}>
                {tournament.updatedAt
                  ? new Date(tournament.updatedAt).toLocaleString("vi-VN")
                  : "Chưa có lần lưu trên hồ sơ"}
              </Typography>
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>
                {busy ? "Đang lưu…" : "Chưa Cập nhật chính thức"}
              </Typography>
            </CenterRightRailCard>
          </>
        }
      >
        <ExperienceChipRow
          value={scope}
          onChange={(next) => {
            setScope(next);
            if (next === "event") {
              const only = resolveSelectedEvent(events, selectedEventId);
              if (only?.id) selectEvent(only.id);
            }
          }}
          items={[
            { id: "tournament", label: "Giải đấu" },
            { id: "event", label: "Nội dung" },
          ]}
        />
        {scope === "event" ? (
          <>
            <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>Chọn nội dung</Typography>
            {internal ? (
              <Alert severity="info" sx={{ mb: 1 }}>
                {MULTI_CONTENT_LIMITATION_INTERNAL}
              </Alert>
            ) : null}
            {events.length === 0 ? (
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mb: 1 }}>
                Chưa có nội dung trên hồ sơ.
              </Typography>
            ) : (
              <ExperienceChipRow
                value={selectedEvent?.id || ""}
                onChange={selectEvent}
                items={events.map((item) => ({
                  id: item.id,
                  label: item.name || EVENT_TYPE_LABELS[item.eventType] || "Nội dung",
                }))}
              />
            )}
          </>
        ) : null}

        <ExperienceOperatorCard sx={{ mb: 1.5, bgcolor: TOURNAMENT_COLOR.primarySurface, borderColor: TOURNAMENT_COLOR.primary }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.primary, letterSpacing: 0.4 }}>
            {scope === "tournament" ? "PHẠM VI GIẢI ĐẤU" : "NỘI DUNG THI ĐẤU"}
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>
            {scope === "tournament" ? tournament.name : selectedEvent?.name || "Chưa chọn nội dung"}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
            {scope === "tournament"
              ? `${typeLabel} • ${hostClubName || "Chưa có địa điểm"} • ${scheduleDate || "Chưa cấu hình ngày"}`
              : eventMeta}
          </Typography>
        </ExperienceOperatorCard>

        <Tabs
          value={tab}
          onChange={(_e, value) => setTab(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mb: 1.5, minHeight: 36, "& .MuiTab-root": { textTransform: "none", minHeight: 36 } }}
        >
          {TABS.map((item) => (
            <Tab key={item.id} value={item.id} label={item.label} />
          ))}
        </Tabs>

        {tab === "info" && scope === "tournament" ? (
          <Stack spacing={1.25}>
            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Tên giải đấu"
                  value={name}
                  onChange={(event) => {
                    setDirty(true);
                    setName(event.target.value);
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField size="small" fullWidth label="Loại giải" value={typeLabel} disabled />
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Cụm sân / Địa điểm"
                  value={hostClubName}
                  onChange={(event) => {
                    setDirty(true);
                    setHostClubName(event.target.value);
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField size="small" fullWidth label="Hiển thị công khai" value="Chưa cấu hình công bố" disabled />
              </Grid>
              {official ? (
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    size="small"
                    fullWidth
                    select
                    label="Chế độ giải"
                    value={officialMode}
                    onChange={(event) => {
                      setDirty(true);
                      setOfficialMode(event.target.value);
                    }}
                  >
                    {Object.entries(OFFICIAL_MODE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              ) : null}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField size="small" fullWidth label="Ngày thi đấu trên hồ sơ" value={scheduleDate || "Chưa cấu hình"} disabled />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Cập nhật gần nhất"
                  value={tournament.updatedAt ? new Date(tournament.updatedAt).toLocaleString("vi-VN") : "—"}
                  disabled
                />
              </Grid>
            </Grid>
            <Box
              sx={{
                borderRadius: `${TOURNAMENT_RADIUS.card}px`,
                overflow: "hidden",
                border: `1px solid ${TOURNAMENT_COLOR.divider}`,
              }}
            >
              <CenterIdentitySurface
                height={112}
                gradient={`linear-gradient(120deg, ${TOURNAMENT_COLOR.navy} 0%, #16325C 42%, ${TOURNAMENT_COLOR.primary} 100%)`}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography sx={{ fontSize: 11, opacity: 0.75 }}>Ảnh / banner đại diện</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{name || tournament.name}</Typography>
                  <Typography sx={{ fontSize: 12, opacity: 0.9 }}>
                    {hostClubName || "Chưa có địa điểm trên hồ sơ"}
                  </Typography>
                </Box>
              </CenterIdentitySurface>
            </Box>
          </Stack>
        ) : null}

        {tab === "info" && scope === "event" ? (
          selectedEvent ? (
            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField size="small" fullWidth label="Tên nội dung" value={eventName} onChange={(event) => setEventName(event.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Trạng thái nội dung"
                  value={statusLabelVi(selectedEvent.status) || "Chưa cấu hình"}
                  disabled
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  select
                  label="Hạng mục"
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value)}
                  disabled={competitionLocked}
                >
                  {EVENT_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Sức chứa cặp / đội"
                  value={String(Array.isArray(selectedEvent.entries) ? selectedEvent.entries.length : 0)}
                  disabled
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Thể thức thi đấu"
                  value={
                    selectedEvent.groups?.length && selectedEvent.bracket
                      ? "Vòng bảng + Loại trực tiếp"
                      : selectedEvent.bracket
                        ? "Loại trực tiếp"
                        : selectedEvent.groups?.length
                          ? "Vòng bảng"
                          : "Chưa cấu hình"
                  }
                  disabled
                />
              </Grid>
              {competitionLocked ? (
                <Grid size={{ xs: 12 }}>
                  <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning }}>
                    Thể thức và sức chứa đã khóa vì nội dung đã có trận.
                  </Typography>
                </Grid>
              ) : null}
              {official ? (
                <Grid size={{ xs: 12 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <TextField
                      size="small"
                      select
                      label="Thêm loại nội dung"
                      value={addEventType}
                      onChange={(event) => setAddEventType(event.target.value)}
                      sx={{ minWidth: 220 }}
                    >
                      {EVENT_TYPE_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
                      <Button variant="outlined" disabled={busy} onClick={handleAddEvent} sx={outlinedActionSx}>
                        Thêm nội dung
                      </Button>
                    </PermissionGate>
                  </Stack>
                </Grid>
              ) : null}
            </Grid>
          ) : (
            <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
              Hãy chọn nội dung để xem và lưu thông tin.
            </Typography>
          )
        ) : null}

        {tab === "format" ? (
          scope === "event" ? (
            <FormatDesigner
              steps={formatSteps}
              locked={competitionLocked}
              emptyText="Chưa cấu hình thể thức trên hồ sơ nội dung này."
            />
          ) : official ? (
            <Stack spacing={1.25} data-testid="official-competition-settings">
              <Alert severity="info">
                Cài đặt Official/Open lưu qua officialCompetition + eligibilityEngine. Không tạo persistence mới.
              </Alert>
              <Grid container spacing={1.25}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    size="small"
                    fullWidth
                    select
                    label="Chế độ đăng ký"
                    value={registrationMode}
                    onChange={(event) => {
                      setDirty(true);
                      setRegistrationMode(event.target.value);
                    }}
                  >
                    <MenuItem value={OFFICIAL_REGISTRATION_MODE.INDIVIDUAL}>Cá nhân</MenuItem>
                    <MenuItem value={OFFICIAL_REGISTRATION_MODE.PAIR}>Theo cặp</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    label="Số bảng (groupCount)"
                    value={groupCount}
                    onChange={(event) => {
                      setDirty(true);
                      setGroupCount(event.target.value);
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    size="small"
                    fullWidth
                    select
                    label="Cách tính điểm"
                    value={scoringMethod}
                    onChange={(event) => {
                      setDirty(true);
                      setScoringMethod(event.target.value);
                    }}
                  >
                    <MenuItem value={OFFICIAL_SCORING_METHOD.RALLY}>Rally (hỗ trợ)</MenuItem>
                    <MenuItem value={OFFICIAL_SCORING_METHOD.SIDE_OUT} disabled={!SIDEOUT_OPERATIONAL}>
                      Side-out {!SIDEOUT_OPERATIONAL ? "(chưa hỗ trợ)" : ""}
                    </MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    size="small"
                    fullWidth
                    select
                    label="Thể thức trận"
                    value={matchFormat}
                    onChange={(event) => {
                      setDirty(true);
                      setMatchFormat(event.target.value);
                    }}
                  >
                    <MenuItem value={OFFICIAL_MATCH_FORMAT.BEST_OF_1}>BEST_OF_1 (hỗ trợ)</MenuItem>
                    <MenuItem value={OFFICIAL_MATCH_FORMAT.BEST_OF_3} disabled={!BEST_OF_3_OPERATIONAL}>
                      BEST_OF_3 {!BEST_OF_3_OPERATIONAL ? "(chưa hỗ trợ)" : ""}
                    </MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Trình độ tối đa"
                    value={maxLevel}
                    onChange={(event) => {
                      setDirty(true);
                      setMaxLevel(event.target.value);
                    }}
                    helperText="eligibilityEngine — max skill ceiling"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Rating tối đa"
                    value={maxRating}
                    onChange={(event) => {
                      setDirty(true);
                      setMaxRating(event.target.value);
                    }}
                    helperText="eligibilityEngine — max rating ceiling"
                  />
                </Grid>
              </Grid>
              <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                WIN_BY deferred · CHANGE_END chưa nối CORE-16 · không giả hỗ trợ.
                {dirty ? " · Đang chỉnh nháp — không ghi đè từ refresh nền." : ""}
              </Typography>
            </Stack>
          ) : (
            <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
              Thể thức thuộc phạm vi Nội dung. Chọn Nội dung để xem thiết kế thể thức.
            </Typography>
          )
        ) : null}

        {tab === "rules" ? (
          <Box>
            {competitionLocked && scope === "event" ? (
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning, mb: 1 }}>
                Quy định thi đấu đã khóa vì nội dung đang có trận.
              </Typography>
            ) : null}
            <Grid container spacing={1.25}>
              {CONFIG_CARDS.map((rule) => (
                <Grid key={rule.title} size={{ xs: 12, md: 6 }}>
                  <ExperienceOperatorCard>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{rule.title}</Typography>
                      {competitionLocked && scope === "event" ? (
                        <ExperienceStatusChip tone="success" label="ĐÃ KHÓA" />
                      ) : null}
                    </Stack>
                    <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mt: 0.4 }}>{rule.detail}</Typography>
                    <Button
                      component={RouterLink}
                      to={configPath(rule.path, tournament.id)}
                      size="small"
                      sx={{ mt: 0.75, ...outlinedActionSx }}
                    >
                      Mở quy định
                    </Button>
                  </ExperienceOperatorCard>
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : null}

        {tab === "fees" ? (
          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ExperienceOperatorCard>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>Lệ phí</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Chưa cấu hình</Typography>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>Không có lệ phí trên hồ sơ giải này.</Typography>
                <Button
                  component={RouterLink}
                  to={configPath("/tournament/config/fee", tournament.id)}
                  size="small"
                  sx={{ mt: 0.75, ...outlinedActionSx }}
                >
                  Mở lệ phí
                </Button>
              </ExperienceOperatorCard>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ExperienceOperatorCard>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>Giải thưởng</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Chưa cấu hình</Typography>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                  Công bố giải thưởng không có trên màn này.
                </Typography>
              </ExperienceOperatorCard>
            </Grid>
          </Grid>
        ) : null}

        {tab === "schedule" ? (
          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ExperienceOperatorCard>
                <Typography sx={{ fontWeight: 800, mb: 0.75 }}>Ngày trên hồ sơ sân</Typography>
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                  {scheduleDate || "Chưa cấu hình ngày thi đấu"}
                </Typography>
                <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, mt: 0.75 }}>
                  Không phải màn Lịch thi đấu & Phân sân.
                </Typography>
              </ExperienceOperatorCard>
            </Grid>
          </Grid>
        ) : null}
      </TournamentExperienceWorkspace>
    </SettingsShell>
  );
}
