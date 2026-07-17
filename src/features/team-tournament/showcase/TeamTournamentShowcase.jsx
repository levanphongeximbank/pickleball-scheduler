import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";

import { TEAM_GROUP_SEEDING } from "../constants.js";
import { DEFAULT_ENGINE_VERSION } from "../canonical/teamTournamentMutationEnvelope.js";
import { annotateShowcaseSessionEngineHashes } from "../setup/buildShowcasePreviewHashes.js";
import {
  SHOWCASE_COPY,
  SHOWCASE_COUNTDOWN_SECONDS,
  SHOWCASE_DEFAULT_TEAM_COUNT,
  SHOWCASE_MODE,
  SHOWCASE_STAGE,
  PROCESSING_STAGES,
} from "./showcaseConstants.js";
import {
  createInitialShowcaseState,
  createShowcaseIdempotencyKey,
  reduceShowcaseState,
  showcaseAllowsCancel,
} from "./showcaseMachine.js";
import {
  generateShowcaseGroupDraw,
  generateShowcaseTeamDraw,
  buildReplayShowcaseSession,
} from "./showcaseDrawSession.js";
import { generateShowcaseMatchupPreview } from "./showcaseMatchupSession.js";
import {
  confirmShowcaseMatchupPersistence,
  confirmShowcasePersistence,
} from "./showcasePersistenceAdapter.js";
import { buildShowcasePreflight } from "./showcasePreflight.js";
import { reconcileSelectedAthletesForEngineInput } from "./reconcileSelectedAthletesForEngineInput.js";
import {
  assignShowcaseCaptain,
  buildShowcaseGroupPreviewDiagnostics,
  buildShowcaseTeamPreviewDiagnostics,
  mergeShowcaseAthletePool,
} from "./showcaseSetupModel.js";
import {
  playShowcaseTone,
  prefersReducedMotion,
  showcaseInnerSx,
  showcaseShellSx,
} from "./showcaseStyles.js";
import ShowcasePreflight from "./ShowcasePreflight.jsx";
import ShowcaseSetup from "./ShowcaseSetup.jsx";
import ShowcaseTeamPreview from "./ShowcaseTeamPreview.jsx";
import ShowcaseGroupPreview from "./ShowcaseGroupPreview.jsx";
import EffectPreludeScreen from "../../../components/tournament/animation/shared/EffectPreludeScreen.jsx";
import { ANIMATION_MODES } from "../../../components/tournament/animation/animationUtils.js";
import ShowcaseCountdown from "./ShowcaseCountdown.jsx";
import ShowcaseProcessing from "./ShowcaseProcessing.jsx";
import ShowcaseTeamReveal from "./ShowcaseTeamReveal.jsx";
import ShowcaseCaptainReveal from "./ShowcaseCaptainReveal.jsx";
import ShowcaseGroupReveal, {
  ShowcaseGroupFormatSelect,
} from "./ShowcaseGroupReveal.jsx";
import ShowcaseFinalReview from "./ShowcaseFinalReview.jsx";
import ShowcaseResults from "./ShowcaseResults.jsx";

/**
 * Isolated presentation shell for P1.5A showcase.
 */
export default function TeamTournamentShowcase({
  open,
  mode = SHOWCASE_MODE.LIVE,
  onClose,
  preflight,
  players = [],
  clubAthletes = [],
  tenantAthletes = [],
  clubs = [],
  tournament = null,
  user = null,
  canSelectTenantScope = false,
  canManageClub,
  poolLoading = false,
  poolError = null,
  teamNamePrefix = "Đội",
  requestedTeamCount = SHOWCASE_DEFAULT_TEAM_COUNT,
  baseTeamData = null,
  persistedTeamData = null,
  rulesVersion = "",
  engineVersion = DEFAULT_ENGINE_VERSION,
  tournamentName = "",
  clubName = "",
  clubId,
  tournamentId,
  persistSetupTeamData,
  reload,
  expectedTournamentVersion,
  previousTeamData,
  teamsAlreadyPersisted = false,
  canSkipCountdown = true,
  onContinueSetup,
  onBackTournament,
  onContinueSchedule,
  draftStatus = "đã lưu",
}) {
  const shellRef = useRef(null);
  const fixedSessionRef = useRef(null);
  const membershipRef = useRef(null);
  const groupFingerprintRef = useRef(null);
  const showAllGroupsRef = useRef(false);
  const idempotencyRef = useRef(null);
  const beginProcessingRef = useRef(null);
  const pendingTeamGenerateRef = useRef(null);
  const pendingGroupGenerateRef = useRef(null);
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);
  const [pendingRegenerate, setPendingRegenerate] = useState(null);

  const [state, dispatch] = useReducer(
    reduceShowcaseState,
    null,
    () => createInitialShowcaseState()
  );
  const scopeAthletes = useMemo(() => {
    const merged = mergeShowcaseAthletePool({
      scopeMode: state.setupConfig?.scopeMode || "club",
      clubAthletes: clubAthletes.length ? clubAthletes : players,
      tenantAthletes,
      clubs,
      selectedClubId: state.setupConfig?.selectedClubId || clubId,
      hostClubId: tournament?.clubId || clubId,
    });
    return merged.length ? merged : players;
  }, [
    clubAthletes,
    tenantAthletes,
    clubs,
    players,
    state.setupConfig?.scopeMode,
    state.setupConfig?.selectedClubId,
    clubId,
    tournament?.clubId,
  ]);

  const selectedPlayers = useMemo(() => {
    const selected = new Set(
      (state.setupConfig?.selectedAthleteIds || []).map(String)
    );
    if (!selected.size) return scopeAthletes;
    return scopeAthletes.filter((player) => {
      const athleteId = String(player?.id || player?.athleteId || "");
      return athleteId && selected.has(athleteId);
    });
  }, [scopeAthletes, state.setupConfig?.selectedAthleteIds]);

  const teamPreviewDiagnostics = useMemo(() => {
    const session = fixedSessionRef.current || state.session;
    return session ? buildShowcaseTeamPreviewDiagnostics(session) : null;
  }, [state.session]);

  const groupPreviewDiagnostics = useMemo(() => {
    const session = fixedSessionRef.current || state.session;
    return session?.groupSession ? buildShowcaseGroupPreviewDiagnostics(session) : null;
  }, [state.session]);
  const setupPreflight = useMemo(() => {
    const baseBlockers = preflight?.blockers || [];
    const reconciliation = reconcileSelectedAthletesForEngineInput({
      athletes: scopeAthletes,
      selectedAthleteIds: state.setupConfig?.selectedAthleteIds || [],
      requestedTeamCount:
        Number(state.setupConfig?.teamCount) || requestedTeamCount || SHOWCASE_DEFAULT_TEAM_COUNT,
      athletesPerTeam: Number(state.setupConfig?.athletesPerTeam) || 4,
      requireMlpBalance: true,
    });
    const built = buildShowcasePreflight({
      athletes: selectedPlayers,
      tournamentName: preflight?.summary?.tournamentName || tournamentName,
      clubName: preflight?.summary?.clubName || clubName || clubId,
      requestedTeamCount:
        Number(state.setupConfig?.teamCount) || state.setupConfig?.teamCount || 0,
      rulesVersion: rulesVersion || preflight?.summary?.rulesVersion || "",
      engineVersion: engineVersion || preflight?.summary?.engineVersion,
      fatalConflicts: baseBlockers.some((item) =>
        String(item).includes("fatalConflicts")
      ),
      blockedByPolicy: baseBlockers.some(
        (item) =>
          String(item).includes("blockedByPolicy") ||
          String(item).includes("chính sách pairing")
      ),
      setupBlocked: baseBlockers.some((item) =>
        String(item).includes("Setup bị khóa")
      ),
      canManage: !baseBlockers.some((item) =>
        String(item).includes("BTC / Super Admin")
      ),
      tournamentEditable: !baseBlockers.some((item) =>
        String(item).includes("không còn chỉnh sửa")
      ),
      setupMutationGate: !baseBlockers.some((item) =>
        String(item).includes("Setup mutation v7 đang tắt")
      ),
      softRuleSummary: preflight?.summary?.softRuleSummary,
    });
    return {
      ...built,
      ok: built.ok && reconciliation.ok,
      blockers: [
        ...built.blockers,
        ...reconciliation.blockers,
      ],
      reconciliation,
    };
  }, [
    clubId,
    clubName,
    engineVersion,
    preflight,
    requestedTeamCount,
    rulesVersion,
    scopeAthletes,
    selectedPlayers,
    state.setupConfig?.athletesPerTeam,
    state.setupConfig?.selectedAthleteIds,
    state.setupConfig?.teamCount,
    tournamentName,
  ]);

  // Open / sync from parent
  useEffect(() => {
    if (!open) {
      dispatch({ type: "CLOSE" });
      fixedSessionRef.current = null;
      return;
    }
    const reduced = prefersReducedMotion();
    if (mode === SHOWCASE_MODE.REPLAY && persistedTeamData) {
      const session = buildReplayShowcaseSession({
        teamData: persistedTeamData,
        players,
        engineVersion,
        rulesVersion,
      });
      fixedSessionRef.current = session;
      membershipRef.current = session.membershipFingerprint;
      groupFingerprintRef.current = session.groupSession?.groupFingerprint || null;
      dispatch({
        type: "OPEN_REPLAY",
        payload: {
          session,
          preflight,
          reducedMotion: reduced,
          savedAt: persistedTeamData?.updatedAt || null,
          stage: SHOWCASE_STAGE.TEAM_REVEAL,
        },
      });
      return;
    }
    const hostRestricted =
      tournament?.settings?.hostClubAthletesOnly === true ||
      tournament?.settings?.allowTenantAthleteScope === false ||
      ["host", "host_club_only"].includes(
        String(tournament?.settings?.athleteScopeMode || "")
          .trim()
          .toLowerCase()
      );
    const tenantScopeDefault = Boolean(canSelectTenantScope) && !hostRestricted;
    const initialAthletes = tenantScopeDefault
      ? tenantAthletes.length
        ? tenantAthletes
        : clubAthletes.length
          ? clubAthletes
          : players
      : clubAthletes.length
        ? clubAthletes
        : players;

    dispatch({
      type: "OPEN_LIVE",
      payload: {
        preflight,
        reducedMotion: reduced,
        setupConfig: {
          teamCount: requestedTeamCount || SHOWCASE_DEFAULT_TEAM_COUNT,
          groupCount: 2,
          selectedAthleteIds: initialAthletes
            .map((player) => String(player?.id || player?.athleteId || ""))
            .filter(Boolean),
          scopeMode: tenantScopeDefault
            ? "tenant"
            : hostRestricted
              ? "host"
              : "club",
          selectedClubId: clubId || tournament?.clubId || "",
          clubFilter: "all",
          genderFilter: "all",
          search: "",
          athletesPerTeam: 4,
        },
      },
    });
  }, [open, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown ticker
  useEffect(() => {
    if (!state.open || state.stage !== SHOWCASE_STAGE.COUNTDOWN || state.paused) {
      return undefined;
    }
    if (state.countdownValue <= 0) {
      beginProcessingRef.current?.();
      return undefined;
    }
    const ms = state.reducedMotion ? 120 : 1000;
    const timer = window.setTimeout(() => {
      playShowcaseTone(state.soundEnabled);
      dispatch({ type: "SET_COUNTDOWN", payload: state.countdownValue - 1 });
    }, ms);
    return () => window.clearTimeout(timer);
  }, [state.open, state.stage, state.countdownValue, state.paused, state.reducedMotion, state.soundEnabled]);

  // Processing ticker (reveal only — engine already fixed)
  useEffect(() => {
    if (!state.open || state.stage !== SHOWCASE_STAGE.PROCESSING || state.paused) {
      return undefined;
    }
    const last = PROCESSING_STAGES.length - 1;
    if (state.processingIndex >= last) {
      const timer = window.setTimeout(() => {
        dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.TEAM_REVEAL } });
      }, state.reducedMotion ? 80 : 600);
      return () => window.clearTimeout(timer);
    }
    const ms = state.reducedMotion ? 100 : 900;
    const timer = window.setTimeout(() => {
      playShowcaseTone(state.soundEnabled);
      dispatch({ type: "SET_PROCESSING_INDEX", payload: state.processingIndex + 1 });
    }, ms);
    return () => window.clearTimeout(timer);
  }, [state.open, state.stage, state.processingIndex, state.paused, state.reducedMotion, state.soundEnabled]);

  // Escape exits projector / closes safely
  useEffect(() => {
    if (!state.open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
          dispatch({ type: "SET_PROJECTOR", payload: false });
          return;
        }
        if (showcaseAllowsCancel(state) || state.mode === SHOWCASE_MODE.REPLAY) {
          onClose?.();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  function beginProcessing() {
    if (!fixedSessionRef.current) {
      dispatch({
        type: "SET_PREFLIGHT",
        payload: {
          ...(preflight || {}),
          ok: false,
          blockers: ["Chưa AI ghép đội — không thể bắt đầu công bố."],
        },
      });
      dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.SETUP } });
      return;
    }
    dispatch({
      type: "GO_STAGE",
      payload: { stage: SHOWCASE_STAGE.PROCESSING, clearError: true },
    });
  }
  beginProcessingRef.current = beginProcessing;

  const runTeamGeneration = useCallback(
    (discardPrevious = false) => {
      if (state.mode === SHOWCASE_MODE.REPLAY) return;
      pendingTeamGenerateRef.current = { discardPrevious: Boolean(discardPrevious) };
      dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.TEAM_GENERATING } });
    },
    [state.mode]
  );

  const completeTeamGenerationEffect = useCallback(async () => {
    if (state.mode === SHOWCASE_MODE.REPLAY) return;
    const pending = pendingTeamGenerateRef.current || { discardPrevious: false };
    pendingTeamGenerateRef.current = null;

    const teamCount =
      Number(state.setupConfig?.teamCount) ||
      requestedTeamCount ||
      SHOWCASE_DEFAULT_TEAM_COUNT;
    const selectedIds = (state.setupConfig?.selectedAthleteIds || []).map(String);

    const reconciliation = reconcileSelectedAthletesForEngineInput({
      athletes: scopeAthletes,
      selectedAthleteIds: selectedIds,
      requestedTeamCount: teamCount,
      athletesPerTeam: Number(state.setupConfig?.athletesPerTeam) || 4,
      requireMlpBalance: true,
    });

    if (!reconciliation.ok) {
      const removalLines = reconciliation.removals.map(
        (row) =>
          `${row.athleteName} (${row.athleteId}) · ${row.removalReason} · raw=${String(row.rawGender)} → ${row.normalizedGender}`
      );
      dispatch({
        type: "SET_PREFLIGHT",
        payload: {
          ...(preflight || {}),
          ok: false,
          blockers: [
            reconciliation.message ||
              `Bạn đã chọn ${reconciliation.selectedCount} VĐV nhưng hệ thống chỉ xác nhận ${reconciliation.finalEngineInputCount} VĐV hợp lệ.`,
            ...removalLines.slice(0, 20),
            ...reconciliation.blockers.filter((item) => item !== reconciliation.message),
          ],
          reconciliation,
        },
      });
      dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.SETUP } });
      return;
    }

    const generated = generateShowcaseTeamDraw({
      players: reconciliation.finalAthletes,
      selectedPlayerIds: reconciliation.finalAthletes.map((athlete) => String(athlete.id)),
      teamCount,
      teamNamePrefix,
      baseTeamData,
      engineVersion,
      rulesVersion: rulesVersion || preflight?.summary?.rulesVersion || "",
      randomFn: Math.random,
    });

    if (!generated.ok) {
      dispatch({
        type: "SET_PREFLIGHT",
        payload: {
          ...(preflight || {}),
          ok: false,
          blockers: [generated.error || "Không tạo được kết quả đội."],
        },
      });
      dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.SETUP } });
      return;
    }

    const usedIds = new Set(
      (generated.session?.teamData?.teams || []).flatMap((team) =>
        (team.playerIds || []).map(String)
      )
    );
    if (usedIds.size !== reconciliation.finalEngineInputCount) {
      dispatch({
        type: "SET_PREFLIGHT",
        payload: {
          ...(preflight || {}),
          ok: false,
          blockers: [
            `Bạn đã chọn ${reconciliation.selectedCount} VĐV nhưng hệ thống chỉ xác nhận ${usedIds.size} VĐV hợp lệ trong lễ.`,
            `finalEngineInputCount=${reconciliation.finalEngineInputCount}; ceremonyAthletes=${usedIds.size}.`,
          ],
        },
      });
      dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.SETUP } });
      return;
    }

    if (pending.discardPrevious) {
      fixedSessionRef.current = null;
    }

    fixedSessionRef.current = await annotateShowcaseSessionEngineHashes(generated.session, {
      players: reconciliation.finalAthletes,
      selectedPlayerIds: reconciliation.finalAthletes.map((athlete) => String(athlete.id)),
      teamCount,
      rulesVersion: rulesVersion || preflight?.summary?.rulesVersion || "",
    });
    membershipRef.current = fixedSessionRef.current.membershipFingerprint;
    dispatch({ type: "SET_SESSION", payload: fixedSessionRef.current });
    dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.TEAM_REVEAL } });
  }, [
    baseTeamData,
    engineVersion,
    preflight,
    requestedTeamCount,
    rulesVersion,
    scopeAthletes,
    state.mode,
    state.setupConfig?.athletesPerTeam,
    state.setupConfig?.selectedAthleteIds,
    state.setupConfig?.teamCount,
    teamNamePrefix,
  ]);

  function handleGenerateTeams() {
    requestShowcaseFullscreen();
    runTeamGeneration(false);
  }

  function handleRegenerateTeams() {
    setPendingRegenerate("teams");
    setRegenerateConfirmOpen(true);
  }

  function handleRegenerateGroups() {
    setPendingRegenerate("groups");
    setRegenerateConfirmOpen(true);
  }

  function confirmRegenerate() {
    setRegenerateConfirmOpen(false);
    if (pendingRegenerate === "teams") {
      runTeamGeneration(true);
    } else if (pendingRegenerate === "groups") {
      handleGenerateGroups({
        groupCount: Number(state.setupConfig?.groupCount) || 2,
        auto: true,
        discardPrevious: true,
      });
    }
    setPendingRegenerate(null);
  }

  function handleGenerateGroups({ groupCount, discardPrevious = false } = {}) {
    const base = fixedSessionRef.current || state.session;
    if (!base) return;
    requestShowcaseFullscreen();
    pendingGroupGenerateRef.current = {
      groupCount: Number(groupCount) || Number(state.setupConfig?.groupCount) || 2,
      discardPrevious: Boolean(discardPrevious),
    };
    dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.GROUP_GENERATING } });
  }

  const completeGroupGenerationEffect = useCallback(() => {
    const base = fixedSessionRef.current || state.session;
    const pending = pendingGroupGenerateRef.current || {
      groupCount: Number(state.setupConfig?.groupCount) || 2,
      discardPrevious: false,
    };
    pendingGroupGenerateRef.current = null;
    if (!base) {
      dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.SETUP } });
      return;
    }

    const generated = generateShowcaseGroupDraw(base, {
      groupCount: Number(pending.groupCount) || 2,
      seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
      rulesVersion: rulesVersion || base.rulesVersion || "",
      randomFn: Math.random,
    });

    if (!generated.ok) {
      dispatch({
        type: "SAVE_FAILED",
        payload: { error: generated.error || "Không chia được bảng." },
      });
      dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.SETUP } });
      return;
    }

    if (
      membershipRef.current &&
      generated.session.membershipFingerprint !== membershipRef.current
    ) {
      dispatch({
        type: "SAVE_FAILED",
        payload: { error: "Kết quả đội bị thay đổi — đã hủy chia bảng." },
      });
      dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.SETUP } });
      return;
    }

    if (pending.discardPrevious) {
      showAllGroupsRef.current = false;
    }

    fixedSessionRef.current = generated.session;
    groupFingerprintRef.current = generated.session.groupSession?.groupFingerprint;
    dispatch({ type: "SET_SESSION", payload: generated.session });
    dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.GROUP_REVEAL } });
  }, [rulesVersion, state.session, state.setupConfig?.groupCount]);

  function handleGenerateMatchups() {
    const session = fixedSessionRef.current || state.session;
    const result = generateShowcaseMatchupPreview(session, {
      rulesVersion: rulesVersion || session?.rulesVersion || "",
    });
    if (!result.ok) {
      dispatch({
        type: "SAVE_FAILED",
        payload: { error: result.error || "Không tạo được cặp đấu." },
      });
      return;
    }
    dispatch({ type: "SET_MATCHUP_PREVIEW", payload: result.matchupPreview });
  }

  async function handleConfirmMatchups() {
    if (state.mode === SHOWCASE_MODE.REPLAY) return;
    const session = fixedSessionRef.current || state.session;
    dispatch({ type: "BEGIN_SAVE", payload: {} });
    const result = await confirmShowcaseMatchupPersistence({
      session,
      matchupPreview: state.matchupPreview,
      persistSetupTeamData,
      rulesVersion: rulesVersion || session?.rulesVersion || "",
      expectedTournamentVersion,
      previousTeamData,
    });
    if (!result.ok) {
      dispatch({
        type: "SAVE_FAILED",
        payload: { error: result.error || "Không lưu được cặp đấu." },
      });
      return;
    }
    dispatch({ type: "MATCHUP_SAVE_SUCCEEDED", payload: result });
    if (typeof reload === "function") {
      await reload({ schemaVersion: 7, diagnostic: true });
    }
  }

  function handleAssignCaptain(teamId, captainPlayerId) {
    const session = fixedSessionRef.current || state.session;
    const result = assignShowcaseCaptain(session, { teamId, captainPlayerId });
    if (!result.ok) {
      dispatch({
        type: "SAVE_FAILED",
        payload: { error: result.error || "Không đổi được đội trưởng." },
      });
      return;
    }
    fixedSessionRef.current = result.session;
    dispatch({ type: "SET_SESSION", payload: result.session });
  }

  function handleStartTeamReveal() {
    if (!fixedSessionRef.current && !state.session) return;
    requestShowcaseFullscreen();
    dispatch({
      type: "GO_STAGE",
      payload: {
        stage: SHOWCASE_STAGE.COUNTDOWN,
        countdownValue: SHOWCASE_COUNTDOWN_SECONDS,
      },
    });
  }

  function handleStartGroupReveal() {
    if (!fixedSessionRef.current?.groupSession && !state.session?.groupSession) return;
    showAllGroupsRef.current = false;
    requestShowcaseFullscreen();
    dispatch({
      type: "GO_STAGE",
      payload: { stage: SHOWCASE_STAGE.GROUP_REVEAL, groupRevealIndex: 0 },
    });
  }

  function handleStartFromPreflight() {
    if (!preflight?.ok && !state.preflight?.ok) return;
    requestShowcaseFullscreen();
    dispatch({
      type: "GO_STAGE",
      payload: {
        stage: SHOWCASE_STAGE.COUNTDOWN,
        countdownValue: SHOWCASE_COUNTDOWN_SECONDS,
      },
    });
  }

  function handleSelectGroupFormat(option) {
    const base = fixedSessionRef.current || state.session;
    if (!base) return;
    requestShowcaseFullscreen();
    const generated = generateShowcaseGroupDraw(base, {
      groupCount: option.groupCount,
      seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
      rulesVersion: rulesVersion || base.rulesVersion || "",
      randomFn: Math.random,
    });
    if (!generated.ok) {
      dispatch({
        type: "SAVE_FAILED",
        payload: { error: generated.error || "Không chia được bảng." },
      });
      return;
    }
    // Team membership must remain identical
    if (
      membershipRef.current &&
      generated.session.membershipFingerprint !== membershipRef.current
    ) {
      dispatch({
        type: "SAVE_FAILED",
        payload: { error: "Kết quả đội bị thay đổi — đã hủy chia bảng." },
      });
      return;
    }
    fixedSessionRef.current = generated.session;
    groupFingerprintRef.current = generated.session.groupSession?.groupFingerprint;
    showAllGroupsRef.current = false;
    dispatch({ type: "SET_SESSION", payload: generated.session });
    dispatch({
      type: "GO_STAGE",
      payload: { stage: SHOWCASE_STAGE.GROUP_REVEAL, groupRevealIndex: 0 },
    });
  }

  async function handleConfirmSave() {
    if (state.mode === SHOWCASE_MODE.REPLAY) return;
    if (state.saving) return;
    const session = fixedSessionRef.current || state.session;
    if (!idempotencyRef.current) {
      idempotencyRef.current = createShowcaseIdempotencyKey(tournamentId);
    }
    dispatch({
      type: "BEGIN_SAVE",
      payload: { idempotencyKey: idempotencyRef.current },
    });
    const result = await confirmShowcasePersistence({
      session,
      clubId,
      tournamentId,
      persistSetupTeamData,
      reload,
      rulesVersion: rulesVersion || session?.rulesVersion || "",
      teamsAlreadyPersisted,
      previousTeamData,
      expectedTournamentVersion,
      idempotencyKey: idempotencyRef.current,
    });
    if (!result.ok) {
      dispatch({
        type: "SAVE_FAILED",
        payload: { error: result.error || "Lưu thất bại." },
      });
      return;
    }
    dispatch({
      type: "SAVE_SUCCEEDED",
      payload: {
        savedAt: result.savedAt,
        session,
      },
    });
  }

  async function toggleProjector() {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.();
        dispatch({ type: "SET_PROJECTOR", payload: true });
      } else {
        await document.exitFullscreen?.();
        dispatch({ type: "SET_PROJECTOR", payload: false });
      }
    } catch {
      dispatch({ type: "SET_PROJECTOR", payload: !state.projector });
    }
  }

  // Request browser fullscreen directly from a user gesture (click) so the
  // browser allows it. Best-effort; the showcase shell already fills the screen.
  function requestShowcaseFullscreen() {
    const el = shellRef.current;
    if (!el || document.fullscreenElement) return;
    try {
      const result = el.requestFullscreen?.();
      if (result && typeof result.then === "function") {
        result
          .then(() => dispatch({ type: "SET_PROJECTOR", payload: true }))
          .catch(() => {});
      } else {
        dispatch({ type: "SET_PROJECTOR", payload: true });
      }
    } catch {
      // Fullscreen may be blocked; presentation still runs in the shell.
    }
  }

  // Manual "Đóng" on a reveal projector: stop the animation but keep the frozen
  // session. Exits browser fullscreen and returns to a safe non-animating stage.
  function handleExitTeamReveal() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      dispatch({ type: "SET_PROJECTOR", payload: false });
    }
    if (state.mode === SHOWCASE_MODE.REPLAY) {
      onClose?.();
      return;
    }
    dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.TEAM_PREVIEW } });
  }

  function handleExitGroupReveal() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      dispatch({ type: "SET_PROJECTOR", payload: false });
    }
    if (state.mode === SHOWCASE_MODE.REPLAY) {
      onClose?.();
      return;
    }
    dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.GROUP_PREVIEW } });
  }

  if (!open && !state.open) {
    return null;
  }

  const session = state.session || fixedSessionRef.current;
  const activePreflight = state.preflight || preflight;
  const isReplay = state.mode === SHOWCASE_MODE.REPLAY;

  return (
    <Box
      ref={shellRef}
      sx={showcaseShellSx}
      role="dialog"
      aria-modal="true"
      aria-label="Lễ bốc thăm đội"
    >
      <Box sx={showcaseInnerSx}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            {isReplay ? (
              <Chip label={SHOWCASE_COPY.replayBadge} color="info" size="small" />
            ) : null}
            {state.projector ? (
              <Chip label="Trình chiếu" color="success" size="small" />
            ) : null}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              color="inherit"
              aria-label={state.soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
              onClick={() => dispatch({ type: "TOGGLE_SOUND" })}
            >
              {state.soundEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
            </IconButton>
            <Button size="small" color="inherit" onClick={toggleProjector}>
              {state.projector ? SHOWCASE_COPY.projectorOff : SHOWCASE_COPY.projectorOn}
            </Button>
            {isReplay ? (
              <Stack direction="row" spacing={0.5}>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() =>
                    dispatch({
                      type: "GO_STAGE",
                      payload: { stage: SHOWCASE_STAGE.COUNTDOWN, countdownValue: 10 },
                    })
                  }
                >
                  Countdown
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => {
                    requestShowcaseFullscreen();
                    dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.TEAM_REVEAL } })
                  }}
                >
                  Đội
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() =>
                    dispatch({
                      type: "GO_STAGE",
                      payload: { stage: SHOWCASE_STAGE.CAPTAIN_REVEAL },
                    })
                  }
                >
                  Đội trưởng
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => {
                    requestShowcaseFullscreen();
                    dispatch({
                      type: "GO_STAGE",
                      payload: { stage: SHOWCASE_STAGE.GROUP_REVEAL },
                    })
                  }}
                >
                  Bảng
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() =>
                    dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.RESULTS } })
                  }
                >
                  Kết quả
                </Button>
              </Stack>
            ) : null}
            <IconButton color="inherit" aria-label="Đóng" onClick={() => onClose?.()}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>

        {state.stage === SHOWCASE_STAGE.TEAM_GENERATING ? (
          <Box
            sx={{
              borderRadius: 2,
              border: "1px solid rgba(124,255,178,0.35)",
              bgcolor: "rgba(7, 17, 31, 0.92)",
              px: 1,
              py: 1,
            }}
          >
            <EffectPreludeScreen
              presetKey={ANIMATION_MODES.PAIRING_REVEAL}
              context={{
                playerCount: (state.setupConfig?.selectedAthleteIds || []).length,
                teamCount:
                  Number(state.setupConfig?.teamCount) ||
                  requestedTeamCount ||
                  SHOWCASE_DEFAULT_TEAM_COUNT,
                players: selectedPlayers.slice(0, 16),
              }}
              active
              compact
              participants={selectedPlayers.slice(0, 16)}
              onComplete={completeTeamGenerationEffect}
              onSkip={completeTeamGenerationEffect}
            />
          </Box>
        ) : null}

        {state.stage === SHOWCASE_STAGE.GROUP_GENERATING ? (
          <Box
            sx={{
              borderRadius: 2,
              border: "1px solid rgba(124,255,178,0.35)",
              bgcolor: "rgba(7, 17, 31, 0.92)",
              px: 1,
              py: 1,
            }}
          >
            <EffectPreludeScreen
              presetKey={ANIMATION_MODES.SNAKE_GROUP}
              context={{
                playerCount: (fixedSessionRef.current || state.session)?.teamCards?.length || 0,
                groupCount:
                  Number(pendingGroupGenerateRef.current?.groupCount) ||
                  Number(state.setupConfig?.groupCount) ||
                  2,
              }}
              active
              compact
              onComplete={completeGroupGenerationEffect}
              onSkip={completeGroupGenerationEffect}
            />
          </Box>
        ) : null}

        {state.stage === SHOWCASE_STAGE.SETUP ? (
          <ShowcaseSetup
            tournament={tournament}
            clubs={clubs}
            user={user}
            canSelectTenantScope={canSelectTenantScope}
            canManageClub={canManageClub}
            clubAthletes={clubAthletes.length ? clubAthletes : players}
            tenantAthletes={tenantAthletes}
            poolLoading={poolLoading}
            poolError={poolError?.message || poolError || null}
            hostClubId={tournament?.clubId || clubId || ""}
            setupConfig={state.setupConfig}
            preflight={setupPreflight}
            teamPreviewDiagnostics={teamPreviewDiagnostics}
            groupPreviewDiagnostics={groupPreviewDiagnostics}
            hasTeamPreview={Boolean(fixedSessionRef.current?.teamCards?.length || state.session?.teamCards?.length)}
            hasGroupPreview={Boolean(
              fixedSessionRef.current?.groupSession?.groupCards?.length ||
                state.session?.groupSession?.groupCards?.length
            )}
            matchupPreview={state.matchupPreview}
            mode={state.mode}
            saving={state.saving}
            onChange={(config) => dispatch({ type: "SET_SETUP_CONFIG", payload: config })}
            onGenerateTeams={handleGenerateTeams}
            onRegenerateTeams={handleRegenerateTeams}
            onPreviewTeams={() =>
              dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.TEAM_PREVIEW } })
            }
            onStartTeamReveal={handleStartTeamReveal}
            onGenerateGroups={handleGenerateGroups}
            onRegenerateGroups={handleRegenerateGroups}
            onPreviewGroups={() =>
              dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.GROUP_PREVIEW } })
            }
            onStartGroupReveal={handleStartGroupReveal}
            onGenerateMatchups={handleGenerateMatchups}
            onConfirmMatchups={handleConfirmMatchups}
            onConfirmSave={() =>
              dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.FINAL_REVIEW } })
            }
            onSaveDraftContinue={() => {
              onContinueSetup?.();
              onClose?.();
            }}
            onCancelPreview={() => dispatch({ type: "CLEAR_UNSAVED_PREVIEW" })}
            onBack={() => onClose?.()}
            onContinueSchedule={() => {
              onContinueSchedule?.();
              onClose?.();
            }}
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.TEAM_PREVIEW ? (
          <ShowcaseTeamPreview
            diagnostics={teamPreviewDiagnostics}
            teamCards={(fixedSessionRef.current || state.session)?.teamCards || []}
            onRegenerate={handleRegenerateTeams}
            onStartReveal={handleStartTeamReveal}
            onCancelPreview={() => dispatch({ type: "CLEAR_UNSAVED_PREVIEW" })}
            regenerateDisabled={state.mode === SHOWCASE_MODE.REPLAY}
            startDisabled={!teamPreviewDiagnostics?.allTeamsValid}
            startReason={
              !teamPreviewDiagnostics?.allTeamsValid
                ? "Preview đội chưa hợp lệ."
                : ""
            }
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.GROUP_PREVIEW ? (
          <ShowcaseGroupPreview
            diagnostics={groupPreviewDiagnostics}
            onRegenerate={handleRegenerateGroups}
            onStartReveal={handleStartGroupReveal}
            onBack={() => dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.SETUP } })}
            regenerateDisabled={state.mode === SHOWCASE_MODE.REPLAY}
            startDisabled={Boolean(groupPreviewDiagnostics?.missingTeamIds?.length)}
            startReason={
              groupPreviewDiagnostics?.missingTeamIds?.length
                ? "Preview bảng thiếu đội."
                : ""
            }
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.PREFLIGHT ? (
          <ShowcasePreflight
            preflight={activePreflight}
            onBack={() =>
              dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.SETUP } })
            }
            onStart={handleStartFromPreflight}
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.COUNTDOWN ? (
          <ShowcaseCountdown
            value={state.countdownValue}
            paused={state.paused}
            onPause={() => dispatch({ type: "PAUSE" })}
            onResume={() => dispatch({ type: "RESUME" })}
            onSkip={() => beginProcessing()}
            canSkip={canSkipCountdown}
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.PROCESSING ? (
          <ShowcaseProcessing
            index={state.processingIndex}
            paused={state.paused}
            onPause={() => dispatch({ type: "PAUSE" })}
            onResume={() => dispatch({ type: "RESUME" })}
            onCancel={() => onClose?.()}
            canCancel={showcaseAllowsCancel(state)}
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.TEAM_REVEAL ? (
          <ShowcaseTeamReveal
            session={session}
            reducedMotion={state.reducedMotion}
            continueLabel="Tiếp tục — công bố đội trưởng"
            onContinue={() =>
              dispatch({
                type: "GO_STAGE",
                payload: { stage: SHOWCASE_STAGE.CAPTAIN_REVEAL },
              })
            }
            onClose={handleExitTeamReveal}
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.CAPTAIN_REVEAL ? (
          <ShowcaseCaptainReveal
            teamCards={session?.teamCards || []}
            readOnly={isReplay}
            onAssignCaptain={handleAssignCaptain}
            onBack={() =>
              dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.TEAM_REVEAL } })
            }
            onContinue={() => {
              if (isReplay) {
                dispatch({
                  type: "GO_STAGE",
                  payload: { stage: SHOWCASE_STAGE.GROUP_REVEAL },
                });
                return;
              }
              const presetGroupCount = Number(state.setupConfig?.groupCount) || 0;
              if (session?.groupSession?.groupCards?.length) {
                dispatch({
                  type: "GO_STAGE",
                  payload: { stage: SHOWCASE_STAGE.GROUP_REVEAL, groupRevealIndex: 0 },
                });
                return;
              }
              if (presetGroupCount >= 2) {
                handleGenerateGroups({ groupCount: presetGroupCount, auto: true });
                return;
              }
              dispatch({
                type: "GO_STAGE",
                payload: { stage: SHOWCASE_STAGE.GROUP_FORMAT },
              });
            }}
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.GROUP_FORMAT ? (
          <ShowcaseGroupFormatSelect
            options={session?.groupOptions || []}
            engineVersion={session?.engineVersion || engineVersion}
            rulesVersion={session?.rulesVersion || rulesVersion}
            onSelect={handleSelectGroupFormat}
            onBack={() =>
              dispatch({
                type: "GO_STAGE",
                payload: { stage: SHOWCASE_STAGE.CAPTAIN_REVEAL },
              })
            }
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.GROUP_REVEAL ? (
          <ShowcaseGroupReveal
            session={session}
            seedingMode={session?.groupSession?.seedingMode}
            engineVersion={session?.engineVersion || engineVersion}
            rulesVersion={session?.rulesVersion || rulesVersion}
            reducedMotion={state.reducedMotion}
            continueLabel={isReplay ? "Xem kết quả" : "Xem lại trước khi lưu"}
            onReselectFormat={
              isReplay
                ? undefined
                : () =>
                    dispatch({
                      type: "GO_STAGE",
                      payload: { stage: SHOWCASE_STAGE.GROUP_FORMAT },
                    })
            }
            onContinue={() =>
              dispatch({
                type: "GO_STAGE",
                payload: {
                  stage: isReplay ? SHOWCASE_STAGE.RESULTS : SHOWCASE_STAGE.FINAL_REVIEW,
                },
              })
            }
            onClose={handleExitGroupReveal}
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.FINAL_REVIEW ||
        state.stage === SHOWCASE_STAGE.SAVING ? (
          <ShowcaseFinalReview
            session={session}
            saving={state.saving}
            saveError={state.saveError}
            readOnly={isReplay}
            onConfirm={handleConfirmSave}
            onBackTeams={() =>
              dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.TEAM_REVEAL } })
            }
            onBackGroups={() =>
              dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.GROUP_REVEAL } })
            }
            onCancel={() => onClose?.()}
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.RESULTS ? (
          <ShowcaseResults
            tournamentName={tournamentName}
            session={session}
            savedAt={state.savedAt}
            draftStatus={draftStatus}
            onFullscreen={toggleProjector}
            onReplay={() => {
              requestShowcaseFullscreen();
              dispatch({
                type: "GO_STAGE",
                payload: { stage: SHOWCASE_STAGE.TEAM_REVEAL, teamRevealIndex: 0 },
              })
            }}
            onBackTournament={() => {
              onBackTournament?.();
              onClose?.();
            }}
            onContinueSetup={() => {
              onContinueSetup?.();
              onClose?.();
            }}
            canExport={false}
          />
        ) : null}
      </Box>

      <Dialog open={regenerateConfirmOpen} onClose={() => setRegenerateConfirmOpen(false)}>
        <DialogTitle>Xác nhận ghép lại</DialogTitle>
        <DialogContent>
          Thao tác này sẽ hủy preview chưa lưu và tạo kết quả mới. Tiếp tục?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegenerateConfirmOpen(false)}>Hủy</Button>
          <Button color="warning" variant="contained" onClick={confirmRegenerate}>
            Ghép lại
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
