import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  Alert,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useClub } from "../../context/ClubContext.jsx";
import { loadCourtsForClub } from "../../domain/clubStorage.js";
import {
  getTournament,
  listTournaments,
  updateTournament,
} from "../../domain/tournamentService.js";
import { isIndividualTournament } from "../../config/tournamentRoutes.js";
import TournamentConfigPageShell from "../../components/tournament/TournamentConfigPageShell.jsx";
import IndividualTournamentSelector from "../../components/tournament/IndividualTournamentSelector.jsx";
import ScheduleBuilderPanel from "../../components/tournament/ScheduleBuilderPanel.jsx";
import {
  canRegenerateSchedule,
  getSchedulePublishStatus,
  lockSchedule,
  publishSchedule,
  reopenSchedule,
  forceRepublishSchedule,
  recordScheduleCreated,
  resolveScheduleReopenPermission,
} from "../../tournament/engines/publishScheduleEngine.js";
import { isDrawPublished } from "../../tournament/engines/publishDrawEngine.js";
import { generateSchedule } from "../../features/tournament-engine/engines/scheduleEngine.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function TournamentPublishSchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournamentId") || "";
  const { activeClubId, revision, refreshClubs } = useClub();
  const { user, can, rbacEnabled } = useAuth();
  const [message, setMessage] = useState(null);
  const [minRestMinutes, setMinRestMinutes] = useState(15);

  const tournaments = useMemo(
    () => listTournaments(activeClubId).filter(isIndividualTournament),
    [activeClubId, revision]
  );

  const tournament = useMemo(() => {
    if (!tournamentId || !activeClubId) return null;
    return getTournament(activeClubId, tournamentId);
  }, [activeClubId, tournamentId, revision]);

  const courts = useMemo(
    () => loadCourtsForClub(activeClubId).filter((c) => c.active !== false),
    [activeClubId, revision]
  );

  const schedulePublish = getSchedulePublishStatus(tournament);
  const matches =
    tournament?.settings?.engineV4?.matches ||
    tournament?.events?.[0]?.matches ||
    schedulePublish.snapshot ||
    [];

  const hasReopenPermission = resolveScheduleReopenPermission({
    canPermission: can,
    rbacEnabled,
    canIntervene: false,
  });

  const entryLabels = useMemo(() => {
    const map = {};
    (tournament?.events?.[0]?.entries || []).forEach((entry) => {
      map[entry.id] = entry.name || entry.id;
    });
    return map;
  }, [tournament]);

  const persistSettings = (nextTournament, alsoMatches) => {
    const patch = { settings: nextTournament.settings };
    if (alsoMatches) {
      patch.settings = {
        ...nextTournament.settings,
        engineV4: {
          ...(nextTournament.settings?.engineV4 || {}),
          matches: alsoMatches,
          scheduleResult: {
            ...(nextTournament.settings?.engineV4?.scheduleResult || {}),
            matches: alsoMatches,
          },
        },
      };
      if (nextTournament.events?.[0]) {
        const events = [...nextTournament.events];
        events[0] = { ...events[0], matches: alsoMatches };
        patch.events = events;
      }
    }
    const result = updateTournament(activeClubId, tournamentId, patch);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không lưu được." });
      return false;
    }
    refreshClubs();
    return true;
  };

  const handleGenerate = (regenerate = false) => {
    if (!tournament) return;
    const editCheck = canRegenerateSchedule(tournament);
    if (!editCheck.ok) {
      setMessage({ type: "error", text: editCheck.error });
      return;
    }
    if (!isDrawPublished(tournament)) {
      setMessage({ type: "error", text: "Cần công bố bốc thăm trước khi tạo lịch chính thức." });
      return;
    }

    const existingMatches =
      tournament.settings?.engineV4?.matches || tournament.events?.[0]?.matches || [];
    const groups = tournament.events?.[0]?.groups || [];

    const result = generateSchedule(
      {
        tournamentId: tournament.id,
        matches: existingMatches,
        groups,
        courts: courts.map((c, index) => ({
          id: String(c.id),
          name: c.name || `Sân ${index + 1}`,
          locked: Boolean(c.locked),
          priority: c.priority ?? courts.length - index,
          availableSessions: c.availableSessions || c.sessions,
        })),
        scheduleConfig: {
          startTime: tournament.courtSchedule?.startTime || "08:00",
          endTime: tournament.courtSchedule?.endTime || "22:00",
          date: tournament.courtSchedule?.date || new Date().toISOString().slice(0, 10),
          averageMatchMinutes: 25,
          bufferMinutes: 5,
          minRestMinutes,
          sessions: tournament.settings?.engineV4?.scheduleConfig?.sessions,
        },
      },
      { regenerate, strictRest: true }
    );

    if (!result.ok) {
      setMessage({
        type: "error",
        text: (result.errors || ["Không tạo được lịch."]).join(" "),
      });
      return;
    }

    const recorded = recordScheduleCreated(tournament, result.data.matches, {
      userId: user?.id,
      actor: user ? { id: user.id, email: user.email || "" } : null,
      clubId: activeClubId,
      minRestMinutes,
    });

    if (!recorded.ok || !persistSettings(recorded.tournament, result.data.matches)) {
      return;
    }

    setMessage({
      type: "success",
      text: `Đã tạo lịch ${result.data.matches.length} trận (nghỉ ≥ ${minRestMinutes} phút).`,
    });
  };

  const runLifecycle = (fn, okText) => {
    const result = fn();
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    if (!persistSettings(result.tournament, result.snapshot || matches)) {
      return;
    }
    setMessage({ type: "success", text: okText });
  };

  return (
    <TournamentConfigPageShell
      title="Công bố lịch (cá nhân)"
      description="Tạo lịch, khóa, công bố snapshot bất biến. Không dùng dữ liệu demo đồng đội."
    >
      <IndividualTournamentSelector
        tournaments={tournaments}
        tournamentId={tournamentId}
        onSelect={(id) => {
          const next = new URLSearchParams(searchParams);
          if (id) next.set("tournamentId", id);
          else next.delete("tournamentId");
          setSearchParams(next);
        }}
      />

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      {!tournamentId ? (
        <Alert severity="info">Chọn giải cá nhân để lập/công bố lịch.</Alert>
      ) : !tournament ? (
        <Alert severity="warning">Không tìm thấy giải.</Alert>
      ) : (
        <Stack spacing={2}>
          {!isDrawPublished(tournament) && (
            <Alert severity="warning">
              Bốc thăm chưa công bố — không thể tạo lịch chính thức / khóa lịch.
            </Alert>
          )}

          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              type="number"
              label="Nghỉ tối thiểu (phút)"
              value={minRestMinutes}
              onChange={(e) => setMinRestMinutes(Math.max(0, Number(e.target.value) || 0))}
              sx={{ width: 200 }}
              inputProps={{ min: 0 }}
            />
            <Button variant="outlined" onClick={() => handleGenerate(false)}>
              Tạo lịch
            </Button>
            <Button variant="text" onClick={() => handleGenerate(true)}>
              Tạo lại
            </Button>
          </Stack>

          <ScheduleBuilderPanel
            tournament={tournament}
            matches={matches}
            courts={courts}
            minRestMinutes={minRestMinutes}
            schedulePublish={schedulePublish}
            hasReopenPermission={hasReopenPermission}
            onLock={() =>
              runLifecycle(
                () =>
                  lockSchedule(tournament, matches, {
                    userId: user?.id,
                    actor: user,
                    clubId: activeClubId,
                  }),
                "Đã khóa lịch."
              )
            }
            onPublish={() =>
              runLifecycle(
                () =>
                  publishSchedule(tournament, matches, {
                    userId: user?.id,
                    actor: user,
                    clubId: activeClubId,
                  }),
                "Đã công bố lịch (snapshot bất biến)."
              )
            }
            onReopen={() =>
              runLifecycle(
                () =>
                  reopenSchedule(tournament, {
                    userId: user?.id,
                    actor: user,
                    clubId: activeClubId,
                    hasReopenPermission,
                  }),
                "Đã mở lại lịch."
              )
            }
            onForceRepublish={() =>
              runLifecycle(
                () =>
                  forceRepublishSchedule(tournament, {
                    userId: user?.id,
                    actor: user,
                    clubId: activeClubId,
                    hasReopenPermission,
                  }),
                "Force republish — lịch về nháp."
              )
            }
            onMatchesChange={(nextMatches) => {
              persistSettings(tournament, nextMatches);
            }}
            entryLabels={entryLabels}
          />

          <Typography variant="caption" color="text.secondary">
            Audit: schedule_created · schedule_locked · schedule_published · schedule_reopened ·
            schedule_force_publish
          </Typography>
        </Stack>
      )}
    </TournamentConfigPageShell>
  );
}
