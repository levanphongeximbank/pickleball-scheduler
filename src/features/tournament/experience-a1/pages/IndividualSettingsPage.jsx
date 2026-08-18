import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import PermissionGate from "../../../../components/auth/PermissionGate.jsx";
import TournamentPageHeader from "../../../../components/tournament/TournamentPageHeader.jsx";
import { TournamentStatusChip } from "../../../../components/tournament/TournamentStatusChip.jsx";
import { touchButtonSx } from "../../../../components/tournament/mobileUi.js";
import { PERMISSIONS } from "../../../../auth/permissions.js";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import {
  EVENT_TYPE,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_OPTIONS,
  OFFICIAL_MODE,
} from "../../../../models/tournament/constants.js";
import { getTournamentSetupPath } from "../../../../utils/tournamentNavigation.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import { TournamentRightRailCard } from "../components/TournamentKpiCard.jsx";
import {
  isInternalCompatibilityFamily,
  isOfficialOpenFamily,
  listTournamentEvents,
  MULTI_CONTENT_LIMITATION_INTERNAL,
  resolveSelectedEvent,
} from "../deriveOverview.js";
import { individualOverviewPath, A1_CONFIG_LINKS, configLinkWithTournament } from "../routes.js";
import {
  A1_SETTINGS_WRITER,
  buildAddOfficialEventPatch,
  buildIdentityPatch,
  buildUpdateEventPatch,
} from "../settingsWriters.js";

const TABS = [
  { id: "tournament", label: "Phạm vi giải đấu" },
  { id: "event", label: "Phạm vi nội dung" },
  { id: "rules", label: "Quy định & lệ phí" },
];

const OFFICIAL_MODE_LABELS = {
  [OFFICIAL_MODE.OPEN]: "Mở rộng (Open)",
  [OFFICIAL_MODE.AI_BALANCE]: "Cân bằng AI",
};

export default function IndividualSettingsPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, refreshClubs } = useClub();
  const { tournament, loading, error, update } = useCanonicalTournament(activeClub, tournamentId);
  const [tab, setTab] = useState("tournament");
  const [name, setName] = useState("");
  const [hostClubName, setHostClubName] = useState("");
  const [officialMode, setOfficialMode] = useState(OFFICIAL_MODE.OPEN);
  const [eventType, setEventType] = useState(EVENT_TYPE.MEN_DOUBLE);
  const [addEventType, setAddEventType] = useState(EVENT_TYPE.MEN_DOUBLE);
  const [eventName, setEventName] = useState("");
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const selectedEventId = searchParams.get("eventId") || "";
  const events = listTournamentEvents(tournament);
  const selectedEvent = resolveSelectedEvent(events, selectedEventId);
  const official = isOfficialOpenFamily(tournament);
  const internal = isInternalCompatibilityFamily(tournament);

  useEffect(() => {
    if (!tournament) return;
    setName(tournament.name || "");
    setHostClubName(tournament.hostClubName || "");
    setOfficialMode(tournament.officialMode || OFFICIAL_MODE.OPEN);
  }, [tournament]);

  useEffect(() => {
    if (selectedEvent) {
      setEventName(selectedEvent.name || "");
      setEventType(selectedEvent.eventType || EVENT_TYPE.MEN_DOUBLE);
    } else {
      setEventName("");
    }
  }, [selectedEvent]);

  const persist = async (patch) => {
    setBusy(true);
    setMessage(null);
    const result = await update(patch);
    setBusy(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không lưu được." });
      return false;
    }
    refreshClubs();
    setMessage({ type: "success", text: "Đã lưu bằng writer hiện tại (canonical_tournament_update)." });
    return true;
  };

  const handleSaveIdentity = async () => {
    const patch = buildIdentityPatch({
      name,
      hostClubName,
      officialMode: official ? officialMode : undefined,
    });
    await persist(patch);
  };

  const handleAddEvent = async () => {
    if (!official) return;
    const { patch, event } = buildAddOfficialEventPatch(tournament, addEventType);
    if (await persist(patch)) {
      const next = new URLSearchParams(searchParams);
      next.set("eventId", event.id);
      setSearchParams(next);
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
    await persist(result.patch);
  };

  const selectEvent = (eventId) => {
    const next = new URLSearchParams(searchParams);
    if (eventId) next.set("eventId", eventId);
    else next.delete("eventId");
    setSearchParams(next);
  };

  if (loading) {
    return <Alert severity="info">Đang tải cài đặt giải...</Alert>;
  }
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (!tournament) {
    return <Alert severity="warning">Không tìm thấy giải.</Alert>;
  }
  if (!isIndividualTournament(tournament)) {
    return (
      <Alert severity="info">
        Cài đặt Wave A1 chỉ dành cho giải cá nhân / chính thức.{" "}
        <Button component={RouterLink} to="/tournament" size="small">
          Quay lại
        </Button>
      </Alert>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, overflowX: "hidden" }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(individualOverviewPath(tournament.id))}
        sx={{ mb: 1 }}
      >
        Tổng quan
      </Button>
      <TournamentPageHeader
        title="Cài đặt Giải đấu / Nội dung"
        description="Tách phạm vi giải và nội dung. Writer giữ nguyên: updateTournamentCommand."
        badge={<TournamentStatusChip status={tournament.status} />}
      />

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, minHeight: 48 }}
      >
        {TABS.map((item) => (
          <Tab key={item.id} value={item.id} label={item.label} sx={{ minHeight: 48 }} />
        ))}
      </Tabs>

      <TournamentExperienceWorkspace
        rail={
          <>
            <TournamentRightRailCard title="Writer hiện tại">
              <Typography variant="body2">{A1_SETTINGS_WRITER.command}</Typography>
              <Typography variant="caption" color="text.secondary">
                Không có LOCK / PUBLISH / COMPLETE mới trong Wave A1.
              </Typography>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Trang thiết lập đầy đủ">
              <Button
                component={RouterLink}
                to={getTournamentSetupPath(tournament)}
                size="small"
                variant="outlined"
                sx={touchButtonSx}
              >
                Mở Internal / Official setup
              </Button>
            </TournamentRightRailCard>
          </>
        }
      >
        {tab === "tournament" ? (
          <Stack spacing={2} sx={{ maxWidth: 560 }}>
            <Typography fontWeight={700}>Phạm vi giải đấu</Typography>
            <TextField
              label="Tên giải đấu"
              value={name}
              onChange={(event) => setName(event.target.value)}
              fullWidth
            />
            <TextField
              label="CLB chủ nhà / địa điểm trên hồ sơ"
              value={hostClubName}
              onChange={(event) => setHostClubName(event.target.value)}
              fullWidth
              helperText="Lưu vào hostClubName hiện có. Không tạo trường venue mới."
            />
            {official ? (
              <FormControl fullWidth>
                <InputLabel>Chế độ giải chính thức</InputLabel>
                <Select
                  label="Chế độ giải chính thức"
                  value={officialMode}
                  onChange={(event) => setOfficialMode(event.target.value)}
                >
                  {Object.entries(OFFICIAL_MODE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
              <Button variant="contained" disabled={busy} onClick={handleSaveIdentity} sx={touchButtonSx}>
                Lưu thông tin giải
              </Button>
            </PermissionGate>
          </Stack>
        ) : null}

        {tab === "event" ? (
          <Stack spacing={2}>
            <Typography fontWeight={700}>Phạm vi nội dung</Typography>
            {internal ? <Alert severity="info">{MULTI_CONTENT_LIMITATION_INTERNAL}</Alert> : null}
            {events.length === 0 ? (
              <Alert severity="info">Chưa có nội dung. Dùng trang thiết lập đầy đủ hoặc thêm nội dung (giải chính thức).</Alert>
            ) : (
              <FormControl fullWidth>
                <InputLabel>Chọn nội dung</InputLabel>
                <Select
                  label="Chọn nội dung"
                  value={selectedEvent?.id || ""}
                  displayEmpty
                  onChange={(event) => selectEvent(event.target.value)}
                >
                  <MenuItem value="">
                    <em>Chọn nội dung</em>
                  </MenuItem>
                  {events.map((event) => (
                    <MenuItem key={event.id} value={event.id}>
                      {event.name || EVENT_TYPE_LABELS[event.eventType] || event.id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {!selectedEvent && events.length > 1 ? (
              <Alert severity="info">Có nhiều nội dung — hãy chọn rõ nội dung cần sửa. Wave A1 không tự lấy nội dung đầu tiên.</Alert>
            ) : null}
            {selectedEvent ? (
              <Stack spacing={2} sx={{ maxWidth: 560 }}>
                <TextField
                  label="Tên nội dung"
                  value={eventName}
                  onChange={(event) => setEventName(event.target.value)}
                  fullWidth
                />
                <FormControl fullWidth>
                  <InputLabel>Loại nội dung</InputLabel>
                  <Select
                    label="Loại nội dung"
                    value={eventType}
                    onChange={(event) => setEventType(event.target.value)}
                  >
                    {EVENT_TYPE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
                  <Button variant="contained" disabled={busy} onClick={handleSaveEvent} sx={touchButtonSx}>
                    Lưu nội dung đang chọn
                  </Button>
                </PermissionGate>
              </Stack>
            ) : null}
            {official ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                <FormControl sx={{ minWidth: 220 }}>
                  <InputLabel>Thêm loại nội dung</InputLabel>
                  <Select
                    label="Thêm loại nội dung"
                    value={addEventType}
                    onChange={(event) => setAddEventType(event.target.value)}
                  >
                    {EVENT_TYPE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
                  <Button variant="outlined" disabled={busy} onClick={handleAddEvent} sx={touchButtonSx}>
                    Thêm nội dung
                  </Button>
                </PermissionGate>
              </Stack>
            ) : null}
          </Stack>
        ) : null}

        {tab === "rules" ? (
          <Stack spacing={1.25}>
            <Typography fontWeight={700}>Quy định hiện có</Typography>
            <Typography variant="body2" color="text.secondary">
              Mở đúng trang cấu hình production — cùng writer `useIndividualTournamentConfig`.
            </Typography>
            {A1_CONFIG_LINKS.map((item) => (
              <Button
                key={item.key}
                component={RouterLink}
                to={configLinkWithTournament(item.path, tournament.id)}
                variant="outlined"
                sx={{ justifyContent: "flex-start", ...touchButtonSx }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
        ) : null}
      </TournamentExperienceWorkspace>
    </Box>
  );
}
