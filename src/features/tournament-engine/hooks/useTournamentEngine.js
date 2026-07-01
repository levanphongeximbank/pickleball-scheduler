import { useCallback, useEffect, useMemo, useState } from "react";

import { useClub } from "../../../context/ClubContext.jsx";
import { usePlatformRuntime } from "../../../core/platform/app/usePlatformRuntime.js";
import { loadCourtsForClub } from "../../../domain/clubStorage.js";
import { getTournament, updateTournament } from "../../../domain/tournamentService.js";
import {
  buildEngineContext,
  mergeEngineStateIntoSettings,
  applyEnginePlanToEvent,
} from "../services/tournamentEngineAdapter.js";
import { runTimePredictionEngine } from "../orchestrator/tournamentEngine.js";
import { runPlatformEngineWorkflow } from "../../../core/platform/engines/orchestrator.js";
import {
  createPlatformEvent,
  createEventStore,
  createPlatformEventDispatcher,
  EVENT_TYPES,
} from "../../../core/platform/events/index.js";
import { appendWorkflowHistoryEntry, resetWorkflowHistory } from "./workflowHistory.js";

function toPlatformParticipants(names = []) {
  return names.map((name, index) => ({
    id: `platform-${index + 1}`,
    name,
    status: "active",
  }));
}

function toPlatformGroups(names = []) {
  return names.map((name, index) => ({
    id: `platform-group-${index + 1}`,
    name,
    entries: [{ id: `platform-${index + 1}`, name }],
  }));
}

export function useTournamentEngineState(tournamentId) {
  const { activeClubId, players } = useClub();
  const runtime = usePlatformRuntime();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [engineState, setEngineState] = useState(null);
  const [workflowHistory, setWorkflowHistory] = useState([]);
  const [platformEvents, setPlatformEvents] = useState([]);
  const [platformNotifications, setPlatformNotifications] = useState([]);
  const [eventStore] = useState(() => createEventStore());
  const eventDispatcher = useMemo(
    () =>
      createPlatformEventDispatcher({
        auditService: runtime?.auditService,
        notificationService: runtime?.notificationService,
      }),
    [runtime?.auditService, runtime?.notificationService]
  );

  const tournament = useMemo(
    () => (tournamentId ? getTournament(activeClubId, tournamentId) : null),
    [activeClubId, tournamentId, engineState]
  );

  const courts = useMemo(
    () => loadCourtsForClub(activeClubId).filter((c) => c.active !== false),
    [activeClubId]
  );

  useEffect(() => {
    if (tournament?.settings?.engineV4?.workflowHistory) {
      setWorkflowHistory(tournament.settings.engineV4.workflowHistory);
    }
  }, [tournament]);

  const context = useMemo(() => {
    if (!tournament) {
      return null;
    }
    const saved = tournament.settings?.engineV4 || {};
    return buildEngineContext({
      tournament,
      players,
      courts,
      engineState: engineState || saved,
    });
  }, [tournament, players, courts, engineState]);

  const persistEngineState = useCallback(
    (patch) => {
      if (!tournament) {
        return { ok: false, error: "Không tìm thấy giải." };
      }
      const merged = mergeEngineStateIntoSettings(tournament, {
        ...(tournament.settings?.engineV4 || {}),
        ...patch,
      });
      const result = updateTournament(activeClubId, tournamentId, {
        settings: merged.settings,
      });
      if (result.ok) {
        const nextEngineState = result.tournament.settings?.engineV4 || patch;
        setEngineState(nextEngineState);
        if (Array.isArray(nextEngineState.workflowHistory)) {
          setWorkflowHistory(nextEngineState.workflowHistory);
        }
      }
      return result;
    },
    [activeClubId, tournament, tournamentId]
  );

  const syncPlatformNotifications = useCallback(() => {
    const notifications = runtime?.notificationService?.list?.() || [];
    setPlatformNotifications(notifications);
    return notifications;
  }, [runtime?.notificationService]);

  const markNotificationAsRead = useCallback(
    (notificationId) => {
      const updated = runtime?.notificationService?.markAsRead?.(notificationId);
      if (updated) {
        syncPlatformNotifications();
      }
      return updated;
    },
    [runtime?.notificationService, syncPlatformNotifications]
  );

  const markAllNotificationsAsRead = useCallback(() => {
    const updated = runtime?.notificationService?.markAllAsRead?.();
    if (updated) {
      syncPlatformNotifications();
    }
    return updated;
  }, [runtime?.notificationService, syncPlatformNotifications]);

  const emitPlatformEvent = useCallback(
    (entry) => {
      const event = createPlatformEvent({
        type: EVENT_TYPES.WORKFLOW_STARTED,
        action: entry.action,
        entityType: "workflow",
        entityId: tournamentId || "tournament-workflow",
        metadata: {
          status: entry.status,
          detail: entry.detail,
        },
        tenantId: activeClubId || null,
      });
      eventStore.add(event);
      eventDispatcher(event, { tenantId: activeClubId || null, notify: true });
      setPlatformEvents(eventStore.list());
      syncPlatformNotifications();
      return event;
    },
    [activeClubId, eventDispatcher, eventStore, syncPlatformNotifications, tournamentId]
  );

  const recordWorkflowHistory = useCallback(
    (entry) => {
      const nextHistory = appendWorkflowHistoryEntry(workflowHistory, entry);
      setWorkflowHistory(nextHistory);
      persistEngineState({ workflowHistory: nextHistory });
      emitPlatformEvent(entry);
    },
    [emitPlatformEvent, persistEngineState, workflowHistory]
  );

  const clearWorkflowHistory = useCallback(() => {
    const nextHistory = resetWorkflowHistory();
    setWorkflowHistory(nextHistory);
    persistEngineState({ workflowHistory: nextHistory });
  }, [persistEngineState]);

  const runWithLoading = useCallback(async (fn) => {
    setLoading(true);
    setError("");
    try {
      const result = fn();
      if (!result.ok) {
        setError((result.errors || []).join(" ") || "Engine thất bại.");
      }
      return result;
    } catch (err) {
      setError(err?.message || "Lỗi không xác định.");
      return { ok: false, errors: [err?.message] };
    } finally {
      setLoading(false);
    }
  }, []);

  const generateSeed = useCallback(async () => {
    if (!context) {
      return { ok: false };
    }
    return runWithLoading(() => {
      const result = runPlatformEngineWorkflow({
        tournament,
        players,
        courts,
        matches: context.matches || [],
      });
      if (result.ok) {
        const participants = toPlatformParticipants(result.data.plan.summary.participantNames);
        persistEngineState({
          participants,
          seedResult: { participants },
        });
        recordWorkflowHistory({
          action: "seed",
          status: "success",
          detail: `Generated ${participants.length} seed entries`,
        });
      }
      return result;
    });
  }, [context, tournament, players, courts, persistEngineState, runWithLoading]);

  const generateDraw = useCallback(async () => {
    if (!context) {
      return { ok: false };
    }
    return runWithLoading(() => {
      const result = runPlatformEngineWorkflow({
        tournament,
        players,
        courts,
        matches: context.matches || [],
      });
      if (result.ok) {
        const groups = toPlatformGroups(result.data.plan.summary.participantNames);
        persistEngineState({
          groups,
          drawResult: { groups },
        });
        recordWorkflowHistory({
          action: "draw",
          status: "success",
          detail: `Generated ${groups.length} groups`,
        });
      }
      return result;
    });
  }, [context, tournament, players, courts, persistEngineState, runWithLoading]);

  const generateSchedule = useCallback(
    async () => {
      if (!context) {
        return { ok: false };
      }
      return runWithLoading(() => {
        const result = runPlatformEngineWorkflow({
          tournament,
          players,
          courts,
          matches: context.matches || [],
        });
        if (result.ok) {
          persistEngineState({
            matches: context.matches || [],
            scheduleResult: { matches: context.matches || [] },
          });
          recordWorkflowHistory({
            action: "schedule",
            status: "success",
            detail: `Prepared ${context.matches?.length || 0} matches`,
          });
        }
        return result;
      });
    },
    [context, tournament, players, courts, persistEngineState, runWithLoading]
  );

  const assignCourtsAuto = useCallback(
    async () => {
      if (!context) {
        return { ok: false };
      }
      return runWithLoading(() => {
        const result = runPlatformEngineWorkflow({
          tournament,
          players,
          courts,
          matches: context.matches || [],
        });
        if (result.ok) {
          persistEngineState({
            matches: context.matches || [],
            courtResult: { assignments: [], matches: context.matches || [] },
            rankingResult: result.data.ranking,
          });
          recordWorkflowHistory({
            action: "courts",
            status: "success",
            detail: `Assigned court workflow for ${context.matches?.length || 0} matches`,
          });
        }
        return result;
      });
    },
    [context, tournament, players, courts, persistEngineState, runWithLoading]
  );

  const predictTime = useCallback(async () => {
    if (!context) {
      return { ok: false };
    }
    return runWithLoading(() => {
      const result = runTimePredictionEngine(context, { clubId: activeClubId });
      if (result.ok) {
        persistEngineState({ timeResult: result.data });
      }
      return result;
    });
  }, [context, activeClubId, persistEngineState, runWithLoading]);

  const updateRanking = useCallback(async () => {
    if (!context) {
      return { ok: false };
    }
    return runWithLoading(() => {
      const result = runPlatformEngineWorkflow({
        tournament,
        players,
        courts,
        matches: context.matches || [],
      });
      if (result.ok) {
        persistEngineState({ rankingResult: result.data.ranking });
        recordWorkflowHistory({
          action: "ranking",
          status: "success",
          detail: `Updated ranking for ${players.length} players`,
        });
      }
      return result;
    });
  }, [context, tournament, players, courts, persistEngineState, runWithLoading]);

  const runFullPlan = useCallback(async () => {
    if (!context) {
      return { ok: false };
    }
    return runWithLoading(() => {
      const result = runPlatformEngineWorkflow({
        tournament,
        players,
        courts,
        matches: context.matches || [],
      });
      if (result.ok) {
        persistEngineState({
          participants: result.data.plan.summary.participantNames.map((name, index) => ({
            id: `platform-${index + 1}`,
            name,
            status: "active",
          })),
          groups: [],
          matches: context.matches || [],
          seedResult: { participants: [] },
          drawResult: { groups: [] },
          scheduleResult: { matches: context.matches || [] },
          courtResult: { matches: context.matches || [] },
          timeResult: { estimatedMinutes: 0 },
          rankingResult: result.data.ranking,
        });
        recordWorkflowHistory({
          action: "full-plan",
          status: "success",
          detail: `Ran full platform workflow for ${players.length} players`,
        });
      }
      return result;
    });
  }, [context, tournament, players, courts, persistEngineState, runWithLoading]);

  const applyToTournament = useCallback(async () => {
    if (!tournament) {
      return { ok: false, error: "Không tìm thấy giải." };
    }
    const state = tournament.settings?.engineV4 || engineState || {};
    const plan = {
      seed: state.seedResult,
      draw: state.drawResult,
      schedule: state.scheduleResult,
      courts: state.courtResult,
    };
    const applied = applyEnginePlanToEvent(tournament, plan);
    if (!applied.ok) {
      return applied;
    }
    return updateTournament(activeClubId, tournamentId, {
      events: applied.tournament.events,
      settings: applied.tournament.settings,
    });
  }, [activeClubId, tournament, tournamentId, engineState]);

  const saveConfig = useCallback(
    (configPatch) => {
      return persistEngineState(configPatch);
    },
    [persistEngineState]
  );

  return {
    tournament,
    context,
    courts,
    players,
    matches: context?.matches || [],
    loading,
    error,
    engineState: engineState || tournament?.settings?.engineV4 || {},
    workflowHistory,
    platformEvents,
    platformNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    generateSeed,
    generateDraw,
    generateSchedule,
    assignCourtsAuto,
    predictTime,
    updateRanking,
    runFullPlan,
    applyToTournament,
    saveConfig,
    clearWorkflowHistory,
  };
}
