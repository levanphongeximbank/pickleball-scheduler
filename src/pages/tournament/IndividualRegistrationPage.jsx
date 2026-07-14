import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { loadPlayersForClub } from "../../domain/clubStorage.js";
import { getTournament, updateTournament } from "../../domain/tournamentService.js";
import {
  ENTRY_STATUS,
  ENTRY_STATUS_LABELS,
  EVENT_TYPE_LABELS,
} from "../../models/tournament/index.js";
import {
  cancelRegistration,
  canSubmitRegistration,
  getPlayerRegistrationStatus,
  getRegistrationSettings,
  getRegistrationPolicy,
  getEntryFee,
  resolveFeeAmount,
  isRegistrationLocked,
  gatedSubmitRegistration,
  gatedConfirmPartnerInvite,
} from "../../features/individual-tournament/index.js";
import { buildIndividualAllGroupStandings } from "../../features/individual-tournament/adapters/individualStandingsAdapter.js";
import PlayerSeedStandingsPanel from "../../components/tournament/PlayerSeedStandingsPanel.jsx";
import PlayerSchedulePanel from "../../components/tournament/PlayerSchedulePanel.jsx";
import PlayerLiveResultsPanel from "../../components/tournament/PlayerLiveResultsPanel.jsx";
import { getTournamentSetupPath } from "../../utils/tournamentNavigation.js";

function resolveIsSingle(eventType) {
  return eventType === "men_single" || eventType === "women_single";
}

export default function IndividualRegistrationPage() {
  const { tournamentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClubId, revision, refreshClubs } = useClub();
  const { user } = useAuth();
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [partnerPlayerId, setPartnerPlayerId] = useState("");
  const [displayName, setDisplayName] = useState("");

  const inviteToken = searchParams.get("invite") || "";

  const tournament = useMemo(
    () => (tournamentId ? getTournament(activeClubId, tournamentId) : null),
    [activeClubId, tournamentId, revision]
  );

  const players = useMemo(() => loadPlayersForClub(activeClubId), [activeClubId, revision]);
  const event = tournament?.events?.[0] || null;
  const isSingle = resolveIsSingle(event?.eventType);
  const linkedPlayerId = user?.playerId ? String(user.playerId) : "";

  const actor = user
    ? { id: user.id, email: user.email || "", name: user.displayName || user.name || "" }
    : null;

  const myEntry = useMemo(() => {
    if (!tournament || !linkedPlayerId) return null;
    return getPlayerRegistrationStatus(tournament, linkedPlayerId, event?.id);
  }, [tournament, linkedPlayerId, event?.id]);

  const gate = tournament ? canSubmitRegistration(tournament) : { ok: false, error: "Không tìm thấy giải." };
  const locked = tournament ? isRegistrationLocked(tournament) : true;
  const settings = tournament ? getRegistrationSettings(tournament) : {};
  const feeInfo = tournament
    ? resolveFeeAmount(tournament, { playerCount: isSingle ? 1 : partnerPlayerId ? 2 : 1 })
    : null;
  const policy = tournament ? getRegistrationPolicy(tournament) : null;

  const playerSeed = useMemo(() => {
    if (!myEntry?.id) return null;
    const seeded =
      tournament?.settings?.engineV4?.seedResult?.participants ||
      tournament?.settings?.engineV4?.participants ||
      [];
    return seeded.find((row) => String(row.id) === String(myEntry.id)) || null;
  }, [tournament, myEntry?.id]);

  const playerStanding = useMemo(() => {
    if (!myEntry?.id || !event?.groups?.length) {
      return { row: null, explanation: "" };
    }
    const groups = buildIndividualAllGroupStandings(event);
    for (const group of groups) {
      const row = (group.standing || []).find((item) => String(item.id) === String(myEntry.id));
      if (row) {
        return { row, explanation: group.tieBreakExplanation || "" };
      }
    }
    return { row: null, explanation: groups[0]?.tieBreakExplanation || "" };
  }, [event, myEntry?.id]);

  const persist = (nextTournament) => {
    const result = updateTournament(activeClubId, tournamentId, {
      events: nextTournament.events,
      settings: nextTournament.settings,
      status: nextTournament.status,
    });
    if (result.ok) {
      refreshClubs();
    }
    return result.ok;
  };

  const handleRegister = () => {
    setError(null);
    setMessage(null);

    if (!linkedPlayerId) {
      setError("Tài khoản chưa liên kết VĐV. Liên kết hồ sơ trước khi đăng ký.");
      return;
    }

    const playerIds = isSingle
      ? [linkedPlayerId]
      : partnerPlayerId
        ? [linkedPlayerId, partnerPlayerId]
        : [linkedPlayerId];

    const player = players.find((item) => String(item.id) === linkedPlayerId);
    const partner = players.find((item) => String(item.id) === String(partnerPlayerId));
    const name =
      displayName.trim() ||
      (partner ? `${player?.name || "VĐV"} / ${partner.name}` : player?.name || "VĐV");

    const result = gatedSubmitRegistration(
      tournament,
      {
        eventId: event?.id,
        playerIds,
        name,
        clubName: player?.clubName || "",
      },
      { actor, clubId: activeClubId, userId: user?.id, players }
    );

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (!persist(result.tournament)) {
      setError("Không lưu được đăng ký.");
      return;
    }

    const policy = getRegistrationPolicy(result.tournament);
    if (result.inviteToken) {
      setMessage(
        `${policy.confirmationMessage} Mời đồng đội: ?invite=${result.inviteToken}`
      );
    } else {
      setMessage(
        `${policy.confirmationMessage} (${ENTRY_STATUS_LABELS[result.entry.status] || result.entry.status}).`
      );
    }
  };

  const handleConfirmInvite = () => {
    setError(null);
    setMessage(null);
    if (!linkedPlayerId) {
      setError("Cần tài khoản liên kết VĐV để xác nhận lời mời.");
      return;
    }
    const player = players.find((item) => String(item.id) === linkedPlayerId);
    const result = gatedConfirmPartnerInvite(tournament, inviteToken, linkedPlayerId, {
      actor,
      clubId: activeClubId,
      userId: user?.id,
      partnerName: player?.name || "",
      players,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!persist(result.tournament)) {
      setError("Không lưu được xác nhận.");
      return;
    }
    setMessage(getRegistrationPolicy(result.tournament).confirmationMessage);
  };

  const handleCancel = () => {
    setError(null);
    setMessage(null);
    if (!myEntry) return;
    const result = cancelRegistration(tournament, myEntry.id, {
      actor,
      clubId: activeClubId,
      userId: user?.id,
      eventId: event?.id,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!persist(result.tournament)) {
      setError("Không hủy được đăng ký.");
      return;
    }
    setMessage("Đã hủy đăng ký.");
  };

  if (!tournament) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Không tìm thấy giải.</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate("/tournament/register")}>
          Quay lại
        </Button>
      </Box>
    );
  }

  if (!event) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">
          Giải chưa có nội dung thi đấu. BTC cần tạo event trước khi mở đăng ký.
        </Alert>
        <Button
          sx={{ mt: 2 }}
          component={RouterLink}
          to={getTournamentSetupPath(tournament)}
          startIcon={<ArrowBackIcon />}
        >
          Mở setup BTC
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 }, maxWidth: 720, mx: "auto" }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/tournament/register")}
        sx={{ mb: 1 }}
      >
        Danh sách giải
      </Button>

      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Đăng ký: {tournament.name}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
        {settings.maxEntries != null ? ` · Sức chứa ${settings.maxEntries}` : ""}
        {feeInfo ? ` · ${feeInfo.label}: ${feeInfo.amount} ${getEntryFee(tournament).currency}` : ""}
      </Typography>

      {policy?.eligibilityFailedMessage && !gate.ok && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {policy.eligibilityFailedMessage}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mb: 1 }} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}

      {locked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Đăng ký đã khóa. Bạn chỉ có thể xem trạng thái hiện tại.
        </Alert>
      )}

      {!gate.ok && !locked && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {gate.error}
        </Alert>
      )}

      {myEntry ? (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography fontWeight="bold">Đăng ký của bạn</Typography>
            <Chip
              size="small"
              label={ENTRY_STATUS_LABELS[myEntry.status] || myEntry.status}
              color={
                myEntry.status === ENTRY_STATUS.APPROVED || myEntry.status === ENTRY_STATUS.ACTIVE
                  ? "success"
                  : myEntry.status === ENTRY_STATUS.PENDING
                    ? "warning"
                    : "default"
              }
            />
          </Stack>
          <Typography variant="body2">{myEntry.name}</Typography>
          {myEntry.waitlistPosition != null && (
            <Typography variant="caption" color="text.secondary">
              Vị trí waitlist: #{myEntry.waitlistPosition}
            </Typography>
          )}
          {!locked && (
            <Button color="error" sx={{ mt: 1 }} onClick={handleCancel}>
              Hủy đăng ký
            </Button>
          )}
        </Paper>
      ) : null}

      {myEntry ? (
        <Box sx={{ mb: 2 }}>
          <PlayerSeedStandingsPanel
            seedNumber={playerSeed?.seed ?? null}
            seedReason={playerSeed?.seedReason || ""}
            standingRow={playerStanding.row}
            tieBreakExplanation={playerStanding.explanation}
          />
        </Box>
      ) : null}

      {myEntry ? (
        <Box sx={{ mb: 2 }}>
          <PlayerSchedulePanel
            tournament={tournament}
            entryId={myEntry.id}
            entryLabels={Object.fromEntries(
              (event?.entries || []).map((entry) => [entry.id, entry.name || entry.id])
            )}
          />
        </Box>
      ) : null}

      {tournament ? (
        <Box sx={{ mb: 2 }}>
          <PlayerLiveResultsPanel tournament={tournament} eventId={event?.id || ""} />
        </Box>
      ) : null}

      {myEntry ? null : inviteToken ? (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography fontWeight="bold" gutterBottom>
            Xác nhận lời mời đồng đội
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Token: {inviteToken}
          </Typography>
          <Button variant="contained" disabled={!gate.ok || !linkedPlayerId} onClick={handleConfirmInvite}>
            Xác nhận tham gia cặp
          </Button>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <TextField
              label="Tên hiển thị (tuỳ chọn)"
              size="small"
              fullWidth
              value={displayName}
              onChange={(event_) => setDisplayName(event_.target.value)}
              disabled={!gate.ok}
            />
            {!isSingle && (
              <FormControl fullWidth size="small" disabled={!gate.ok}>
                <InputLabel>Đồng đội (tuỳ chọn)</InputLabel>
                <Select
                  label="Đồng đội (tuỳ chọn)"
                  value={partnerPlayerId}
                  onChange={(event_) => setPartnerPlayerId(event_.target.value)}
                >
                  <MenuItem value="">
                    <em>Chưa chọn — gửi lời mời sau</em>
                  </MenuItem>
                  {players
                    .filter((player) => String(player.id) !== linkedPlayerId)
                    .map((player) => (
                      <MenuItem key={player.id} value={String(player.id)}>
                        {player.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            )}
            {!linkedPlayerId && (
              <Alert severity="warning">Tài khoản chưa gắn VĐV — chưa thể tự đăng ký.</Alert>
            )}
            <Button
              variant="contained"
              disabled={!gate.ok || !linkedPlayerId}
              onClick={handleRegister}
            >
              Gửi đăng ký
            </Button>
          </Stack>
        </Paper>
      )}

      <Typography variant="caption" color="text.secondary">
        Cửa sổ:{" "}
        {settings.opensAt ? new Date(settings.opensAt).toLocaleString("vi-VN") : "mở ngay"} →{" "}
        {settings.closesAt ? new Date(settings.closesAt).toLocaleString("vi-VN") : "không hạn"}
      </Typography>
    </Box>
  );
}
