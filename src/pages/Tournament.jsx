import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { loadAIData, saveAIData } from "../ai/storage";
import { getActiveClubId, getScopedStorageKey } from "../data/club";
import { useClub } from "../context/ClubContext.jsx";
import { useSeasonLeague } from "../context/SeasonContext.jsx";
import {
  loadRoundsForClub,
  saveRoundsForClub,
  setActivePointers,
} from "../domain/clubStorage.js";
import { filterRoundsByLeague } from "./statistics.logic";
import {
  buildKnockoutProgress,
  buildTournamentBracket,
  isKnockoutRoundLocked,
  sanitizeKnockoutWinners,
} from "./tournament.bracket.logic";
import {
  buildSessionResultDraft,
  buildSessionResultPayload,
  summarizeSessionResult,
  updateCourtScore,
} from "./tournament.results.logic";
import { buildSeededGroupSessions } from "./tournament.fixtures.logic";
import { buildTournamentResultExport } from "./tournament.export.logic";
import { buildSeededGroups } from "./tournament.seeding.logic";
import { buildGroupStandingsForRounds } from "./tournament.standings.logic";
import { getCourtDisplayName, loadCourts } from "./courts.logic";
import { loadInitialSelectedCourts } from "./selectPlayers.data";

const TOURNAMENT_ROUNDS_KEY = "pickleball-tournament-rounds";
const ACTIVE_SLOT_KEY = "pickleball-active-slot";
const PLAYERS_KEY = "players";
const BRACKET_WINNERS_KEY = "pickleball-tournament-bracket-winners";

function loadRounds(clubId = getActiveClubId()) {
  return loadRoundsForClub(clubId);
}

function saveRounds(rounds, clubId = getActiveClubId()) {
  saveRoundsForClub(rounds, clubId);
  localStorage.setItem(
    getScopedStorageKey(TOURNAMENT_ROUNDS_KEY, clubId),
    JSON.stringify(rounds)
  );
}

function loadActiveSlot() {
  try {
    const raw =
      localStorage.getItem(getScopedStorageKey(ACTIVE_SLOT_KEY)) ||
      localStorage.getItem(ACTIVE_SLOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveActiveSlot(slot, clubId = getActiveClubId()) {
  const scopedKey = getScopedStorageKey(ACTIVE_SLOT_KEY, clubId);

  if (!slot) {
    localStorage.removeItem(scopedKey);
    setActivePointers({ roundSlot: null }, clubId);
    return;
  }

  localStorage.setItem(scopedKey, JSON.stringify(slot));
  setActivePointers({ roundSlot: slot }, clubId);
}

function loadBracketWinners() {
  const aiData = loadAIData();
  if (aiData?.tournament?.bracketWinners && typeof aiData.tournament.bracketWinners === "object") {
    return aiData.tournament.bracketWinners;
  }

  try {
    const raw =
      localStorage.getItem(getScopedStorageKey(BRACKET_WINNERS_KEY)) ||
      localStorage.getItem(BRACKET_WINNERS_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveBracketWinners(winners) {
  const data = loadAIData();
  data.tournament = {
    ...(data.tournament || {}),
    bracketWinners: winners || {},
    updatedAt: new Date().toISOString(),
  };
  saveAIData(data);

  localStorage.setItem(getScopedStorageKey(BRACKET_WINNERS_KEY), JSON.stringify(winners || {}));
}

function loadPlayersForTournamentSeed() {
  try {
    const raw =
      localStorage.getItem(getScopedStorageKey(PLAYERS_KEY)) ||
      localStorage.getItem(PLAYERS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatBracketTeamName(team, seed) {
  if (team?.name) {
    return team.name;
  }

  if (seed) {
    return seed;
  }

  return "TBD";
}

function areWinnerMapsEqual(left = {}, right = {}) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

export default function Tournament() {
  const { activeClubId, revision } = useClub();
  const { activeLeague, activeSeason } = useSeasonLeague();
  const [roundName, setRoundName] = useState("");
  const [shiftLabel, setShiftLabel] = useState("");
  const [groupLabel, setGroupLabel] = useState("");
  const [statusMessage, setStatusMessage] = useState(null);
  const [rounds, setRounds] = useState(() => loadRounds(activeClubId));
  const [activeSlot, setActiveSlot] = useState(() => loadActiveSlot());
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [sessionRoundDraft, setSessionRoundDraft] = useState({});
  const [sessionResultDraft, setSessionResultDraft] = useState({});
  const [bulkRoundId, setBulkRoundId] = useState("");
  const [dataVersion, setDataVersion] = useState(0);
  const [seedMode, setSeedMode] = useState("open");
  const [seedGroupCount, setSeedGroupCount] = useState(4);
  const [seedPreview, setSeedPreview] = useState(() => loadAIData().tournament?.seedPreview || []);
  const [bracketWinners, setBracketWinners] = useState(() => loadBracketWinners());
  const [bracketUnlockedRounds, setBracketUnlockedRounds] = useState(() => loadBracketUnlockedRounds());
  const [tournamentExportText, setTournamentExportText] = useState("");
  const [courts] = useState(() => loadCourts([]));
  const [selectedTournamentCourtIds, setSelectedTournamentCourtIds] = useState(() =>
    loadInitialSelectedCourts(loadCourts([]))
  );

  const sessions = useMemo(
    () => {
      const allSessions = loadAIData(activeClubId).sessions || [];
      return allSessions.filter((session) => {
        if (activeLeague?.id && session.meta?.leagueId && session.meta.leagueId !== activeLeague.id) {
          return false;
        }

        return true;
      });
    },
    [dataVersion, activeClubId, activeLeague?.id]
  );

  const visibleRounds = useMemo(
    () => filterRoundsByLeague(rounds, activeLeague?.id),
    [rounds, activeLeague?.id]
  );

  useEffect(() => {
    setRounds(loadRounds(activeClubId));
    setActiveSlot(loadActiveSlot());
    setDataVersion((value) => value + 1);
  }, [activeClubId, revision]);

  const activeCourts = useMemo(
    () => courts.filter((court) => court.active !== false),
    [courts]
  );

  const selectedTournamentCourts = useMemo(
    () => activeCourts.filter((court) => selectedTournamentCourtIds.includes(court.id)),
    [activeCourts, selectedTournamentCourtIds]
  );

  const roundStats = useMemo(() => {
    return visibleRounds.map((round) => {
      const relatedSessions = sessions.filter((session) => session.meta?.roundId === round.id);
      const avgAIScore = relatedSessions.length > 0
        ? Math.round(
          relatedSessions.reduce((sum, session) => sum + Number(session.aiScore?.total || 0), 0) /
            relatedSessions.length
        )
        : 0;

      return {
        ...round,
        sessionCount: relatedSessions.length,
        avgAIScore,
        completedCount: relatedSessions.filter((session) => session.result?.status === "completed").length,
      };
    });
  }, [visibleRounds, sessions]);

  const unassignedSessions = useMemo(
    () => sessions.filter((session) => !session.meta?.roundId).length,
    [sessions]
  );

  const groupStandings = useMemo(() => {
    return buildGroupStandingsForRounds(sessions, rounds, { qualifiersPerGroup: 2 });
  }, [sessions, rounds]);

  const seededRounds = useMemo(() => {
    return rounds
      .filter((round) => Array.isArray(round.seededTeams) && round.seededTeams.length > 0)
      .sort((a, b) => String(a.groupLabel || "").localeCompare(String(b.groupLabel || ""), "vi", { numeric: true }));
  }, [rounds]);

  const knockoutProgress = useMemo(() => {
    if (groupStandings.length < 2 || groupStandings.length % 2 !== 0) {
      return {
        rounds: [],
        champion: null,
        completedRounds: 0,
        totalRounds: 0,
      };
    }

    const baseRounds = buildTournamentBracket(groupStandings, { qualifiersPerGroup: 2 });
    return buildKnockoutProgress(baseRounds, bracketWinners);
  }, [groupStandings, bracketWinners]);

  useEffect(() => {
    if (groupStandings.length < 2 || groupStandings.length % 2 !== 0) {
      return;
    }

    const baseRounds = buildTournamentBracket(groupStandings, { qualifiersPerGroup: 2 });
    const sanitized = sanitizeKnockoutWinners(baseRounds, bracketWinners);

    if (!areWinnerMapsEqual(sanitized, bracketWinners)) {
      setBracketWinners(sanitized);
      saveBracketWinners(sanitized);
    }
  }, [groupStandings, bracketWinners]);

  const handleSeedGroups = () => {
    const players = loadPlayersForTournamentSeed();
    const groupCount = Math.max(2, Number(seedGroupCount) || 2);

    if (players.length < 8) {
      setStatusMessage({ type: "error", text: "Cß║ºn ├¡t nhß║Ñt 8 ng╞░ß╗¥i ─æß╗â seed ─æß╗Öi v├áo bß║úng." });
      return;
    }

    const seeded = buildSeededGroups(players, {
      mode: seedMode,
      groupCount,
      teamSize: 2,
    });

    if (seeded.teams.length < groupCount * 2) {
      setStatusMessage({
        type: "error",
        text: `Kh├┤ng ─æß╗º ─æß╗Öi cho ${groupCount} bß║úng. Cß║ºn tß╗æi thiß╗âu ${groupCount * 4} ng╞░ß╗¥i ch╞íi (mß╗ùi ─æß╗Öi 2 ng╞░ß╗¥i).`,
      });
      return;
    }

    const now = Date.now();
    const generatedRounds = seeded.groups.map((group, index) => ({
      id: now + index,
      name: `Vong bang ${group.group}`,
      defaultShift: null,
      groupLabel: group.group,
      seededTeams: group.teams,
      seedMode,
      createdAt: new Date().toISOString(),
    }));

    const nextRounds = [...generatedRounds, ...rounds];
    setRounds(nextRounds);
    saveRounds(nextRounds, activeClubId);
    setSeedPreview(seeded.groups);

    const data = loadAIData();
    data.tournament = {
      ...(data.tournament || {}),
      seedPreview: seeded.groups,
      updatedAt: new Date().toISOString(),
    };
    saveAIData(data);

    setStatusMessage({
      type: "success",
      text: `─É├ú seed ${seeded.teams.length} ─æß╗Öi v├áo ${groupCount} bß║úng theo mode ${seedMode === "open" ? "open" : "skill_controlled"}.`,
    });
  };

  const handleGenerateGroupFixtures = () => {
    if (seededRounds.length === 0) {
      setStatusMessage({ type: "error", text: "Ch╞░a c├│ bß║úng seed ─æß╗â tß║ío lß╗ïch v├▓ng bß║úng." });
      return;
    }

    if (selectedTournamentCourts.length === 0) {
      setStatusMessage({
        type: "error",
        text: "Ch╞░a chß╗ìn s├ón cho giß║úi. Vui l├▓ng tick ├¡t nhß║Ñt 1 s├ón ─æang hoß║ít ─æß╗Öng.",
      });
      return;
    }

    const data = loadAIData();
    const existingSessions = Array.isArray(data.sessions) ? data.sessions : [];

    const seededRoundIds = new Set(seededRounds.map((round) => String(round.id)));
    const alreadyGenerated = existingSessions.filter(
      (session) =>
        session?.meta?.generatedFromSeed === true &&
        seededRoundIds.has(String(session?.meta?.roundId || ""))
    );

    if (alreadyGenerated.length > 0) {
      setStatusMessage({
        type: "warning",
        text: "─É├ú c├│ lß╗ïch v├▓ng bß║úng sinh tß╗▒ ─æß╗Öng cho c├íc bß║úng hiß╗çn tß║íi. H├úy x├│a sessions c┼⌐ nß║┐u muß╗æn tß║ío lß║íi.",
      });
      return;
    }

    const generatedSessions = buildSeededGroupSessions(seededRounds, {
      startAt: Date.now(),
      baseDate: Date.now(),
      courts: selectedTournamentCourts,
    });

    if (generatedSessions.length === 0) {
      setStatusMessage({ type: "error", text: "Kh├┤ng tß║ío ─æ╞░ß╗úc lß╗ïch tß╗½ dß╗» liß╗çu seed hiß╗çn tß║íi." });
      return;
    }

    data.sessions = [...existingSessions, ...generatedSessions];
    saveAIData(data);
    setDataVersion((value) => value + 1);
    setStatusMessage({
      type: "success",
      text: `─É├ú tß║ío ${generatedSessions.length} session v├▓ng bß║úng tß╗½ dß╗» liß╗çu seed.`,
    });
  };

  const handleSelectBracketWinner = (matchId, winnerSide) => {
    const nextWinners = {
      ...bracketWinners,
    };

    if (!winnerSide) {
      delete nextWinners[matchId];
    } else {
      nextWinners[matchId] = winnerSide;
    }

    setBracketWinners(nextWinners);
    saveBracketWinners(nextWinners);
  };

  const handleToggleRoundLock = (roundName, unlock) => {
    const key = String(roundName || "").trim();
    if (!key) {
      return;
    }

    const nextUnlockedRounds = {
      ...bracketUnlockedRounds,
    };

    if (unlock) {
      nextUnlockedRounds[key] = true;
    } else {
      delete nextUnlockedRounds[key];
    }

    setBracketUnlockedRounds(nextUnlockedRounds);

    const data = loadAIData();
    data.tournament = {
      ...(data.tournament || {}),
      bracketUnlockedRounds: nextUnlockedRounds,
      updatedAt: new Date().toISOString(),
    };
    saveAIData(data);

    setStatusMessage({
      type: "success",
      text: unlock
        ? `─É├ú mß╗ƒ kh├│a chß╗ënh sß╗¡a winner cho v├▓ng ${key}.`
        : `─É├ú kh├│a lß║íi chß╗ënh sß╗¡a winner cho v├▓ng ${key}.`,
    });
  };

  const handleResetBracket = () => {
    const hasWinners = Object.keys(bracketWinners || {}).length > 0;
    const hasUnlocks = Object.keys(bracketUnlockedRounds || {}).length > 0;

    if (!hasWinners && !hasUnlocks) {
      setStatusMessage({ type: "info", text: "Bracket ─æang trß╗æng, kh├┤ng c├│ dß╗» liß╗çu ─æß╗â reset." });
      return;
    }

    const confirmed = window.confirm("Reset to├án bß╗Ö bracket? H├ánh ─æß╗Öng n├áy sß║╜ x├│a winner v├á trß║íng th├íi mß╗ƒ kh├│a hiß╗çn tß║íi.");
    if (!confirmed) {
      return;
    }

    setBracketWinners({});
    setBracketUnlockedRounds({});

    const data = loadAIData();
    data.tournament = {
      ...(data.tournament || {}),
      bracketWinners: {},
      bracketUnlockedRounds: {},
      updatedAt: new Date().toISOString(),
    };
    saveAIData(data);

    saveBracketWinners({});
    setStatusMessage({ type: "success", text: "─É├ú reset to├án bß╗Ö bracket (winner + lock state)." });
  };

  const handleCreateRound = () => {
    if (!roundName.trim()) {
      setStatusMessage({ type: "error", text: "Vui l├▓ng nhß║¡p t├¬n v├▓ng hoß║╖c ca ch╞íi." });
      return;
    }

    const newRound = {
      id: Date.now(),
      name: roundName.trim(),
      defaultShift: shiftLabel.trim() || null,
      groupLabel: groupLabel.trim().toUpperCase() || null,
      leagueId: activeLeague?.id || null,
      seasonId: activeSeason?.id || null,
      createdAt: new Date().toISOString(),
    };

    const nextRounds = [newRound, ...rounds];
    setRounds(nextRounds);
    saveRounds(nextRounds, activeClubId);
    setRoundName("");
    setShiftLabel("");
    setGroupLabel("");
    setStatusMessage({ type: "success", text: "─É├ú tß║ío v├▓ng thi/ca ch╞íi mß╗¢i." });
  };

  const handleDeleteRound = (roundId) => {
    const nextRounds = rounds.filter((round) => round.id !== roundId);
    setRounds(nextRounds);
    saveRounds(nextRounds, activeClubId);

    if (activeSlot?.roundId === roundId) {
      setActiveSlot(null);
      saveActiveSlot(null);
    }

    setStatusMessage({ type: "success", text: "─É├ú x├│a v├▓ng thi." });
  };

  const handleActivateRound = (round) => {
    const slot = {
      roundId: round.id,
      roundName: round.name,
      shiftLabel: round.defaultShift || "Ca mß║╖c ─æß╗ïnh",
      activatedAt: new Date().toISOString(),
    };

    setActiveSlot(slot);
    saveActiveSlot(slot);
    setStatusMessage({ type: "success", text: `─É├ú k├¡ch hoß║ít ${round.name}. Lß║ºn xß║┐p s├ón tiß║┐p theo sß║╜ gß║»n v├áo v├▓ng n├áy.` });
  };

  const handleDeactivateRound = () => {
    setActiveSlot(null);
    saveActiveSlot(null);
    setStatusMessage({ type: "success", text: "─É├ú tß║»t chß║┐ ─æß╗Ö g├ín v├▓ng/ca tß╗▒ ─æß╗Öng." });
  };

  const handleExportRounds = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      rounds,
      activeSlot,
    };

    const text = JSON.stringify(payload, null, 2);
    setExportText(text);
    setStatusMessage({ type: "success", text: "─É├ú xuß║Ñt cß║Ñu h├¼nh rounds/ca ch╞íi." });
  };

  const handleDownloadRounds = () => {
    if (!exportText.trim()) {
      setStatusMessage({ type: "error", text: "Vui l├▓ng bß║Ñm Xuß║Ñt cß║Ñu h├¼nh tr╞░ß╗¢c khi tß║úi file." });
      return;
    }

    const blob = new Blob([exportText], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pickleball-rounds-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setStatusMessage({ type: "success", text: "─É├ú tß║úi file rounds." });
  };

  const handleImportRounds = () => {
    try {
      const parsed = JSON.parse(importText);
      const importedRounds = Array.isArray(parsed.rounds) ? parsed.rounds : Array.isArray(parsed) ? parsed : [];
      const importedActiveSlot = parsed.activeSlot || null;

      setRounds(importedRounds);
      saveRounds(importedRounds, activeClubId);
      setActiveSlot(importedActiveSlot);
      saveActiveSlot(importedActiveSlot);
      setImportText("");
      setStatusMessage({ type: "success", text: "─É├ú nhß║¡p cß║Ñu h├¼nh rounds th├ánh c├┤ng." });
    } catch {
      setStatusMessage({ type: "error", text: "JSON import rounds kh├┤ng hß╗úp lß╗ç." });
    }
  };

  const handleExportTournamentResults = () => {
    const payload = buildTournamentResultExport({
      rounds,
      sessions,
      groupStandings,
      knockoutProgress,
      bracketWinners,
      bracketUnlockedRounds,
    });

    const text = JSON.stringify(payload, null, 2);
    setTournamentExportText(text);
    setStatusMessage({ type: "success", text: "─É├ú xuß║Ñt b├ío c├ío kß║┐t quß║ú giß║úi." });
  };

  const handleDownloadTournamentResults = () => {
    if (!tournamentExportText.trim()) {
      setStatusMessage({ type: "error", text: "Vui l├▓ng xuß║Ñt b├ío c├ío kß║┐t quß║ú tr╞░ß╗¢c khi tß║úi file." });
      return;
    }

    const blob = new Blob([tournamentExportText], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pickleball-tournament-results-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setStatusMessage({ type: "success", text: "─É├ú tß║úi file kß║┐t quß║ú giß║úi." });
  };

  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result || ""));
      setStatusMessage({ type: "success", text: "─É├ú nß║íp file rounds. Bß║Ñm Nhß║¡p cß║Ñu h├¼nh ─æß╗â ├íp dß╗Ñng." });
    };
    reader.onerror = () => {
      setStatusMessage({ type: "error", text: "Kh├┤ng ─æß╗ìc ─æ╞░ß╗úc file rounds." });
    };

    reader.readAsText(file, "utf-8");
    event.target.value = "";
  };

  const handleAssignSessionToRound = (sessionId) => {
    const selectedRoundId = sessionRoundDraft[sessionId];
    const targetRound = rounds.find((round) => String(round.id) === String(selectedRoundId));

    if (!targetRound) {
      setStatusMessage({ type: "error", text: "Vui l├▓ng chß╗ìn round hß╗úp lß╗ç ─æß╗â g├ín session." });
      return;
    }

    const data = loadAIData();
    data.sessions = (data.sessions || []).map((session) => {
      if (session.id !== sessionId) {
        return session;
      }

      return {
        ...session,
        meta: {
          ...(session.meta || {}),
          roundId: targetRound.id,
          roundName: targetRound.name,
          shiftLabel: targetRound.defaultShift || session.meta?.shiftLabel || null,
        },
      };
    });

    saveAIData(data);
    setDataVersion((value) => value + 1);
    setStatusMessage({ type: "success", text: "─É├ú g├ín session v├áo round th├ánh c├┤ng." });
  };

  const handleUnassignSessionRound = (sessionId) => {
    const data = loadAIData();
    data.sessions = (data.sessions || []).map((session) => {
      if (session.id !== sessionId) {
        return session;
      }

      return {
        ...session,
        meta: {
          ...(session.meta || {}),
          roundId: null,
          roundName: null,
        },
      };
    });

    saveAIData(data);
    setDataVersion((value) => value + 1);
    setStatusMessage({ type: "success", text: "─É├ú bß╗Å g├ín round cß╗ºa session." });
  };

  const handleBulkAssignUnassigned = () => {
    const targetRound = rounds.find((round) => String(round.id) === String(bulkRoundId));
    if (!targetRound) {
      setStatusMessage({ type: "error", text: "Vui l├▓ng chß╗ìn round ─æß╗â g├ín h├áng loß║ít." });
      return;
    }

    const data = loadAIData();
    let changedCount = 0;

    data.sessions = (data.sessions || []).map((session) => {
      if (session.meta?.roundId) {
        return session;
      }

      changedCount += 1;
      return {
        ...session,
        meta: {
          ...(session.meta || {}),
          roundId: targetRound.id,
          roundName: targetRound.name,
          shiftLabel: targetRound.defaultShift || session.meta?.shiftLabel || null,
        },
      };
    });

    saveAIData(data);
    setDataVersion((value) => value + 1);

    if (changedCount === 0) {
      setStatusMessage({ type: "success", text: "Kh├┤ng c├│ session n├áo cß║ºn g├ín h├áng loß║ít." });
      return;
    }

    setStatusMessage({ type: "success", text: `─É├ú g├ín ${changedCount} session ch╞░a g├ín v├áo ${targetRound.name}.` });
  };

  const ensureSessionResultDraft = (session) => {
    const existing = sessionResultDraft[session.id];
    if (existing) {
      return existing;
    }

    const created = buildSessionResultDraft(session);
    setSessionResultDraft((prev) => ({
      ...prev,
      [session.id]: created,
    }));

    return created;
  };

  const handleResultScoreChange = (session, courtId, team, value) => {
    const baseDraft = ensureSessionResultDraft(session);
    const nextDraft = updateCourtScore(baseDraft, courtId, team, value);

    setSessionResultDraft((prev) => ({
      ...prev,
      [session.id]: nextDraft,
    }));
  };

  const handleResultStatusChange = (session, status) => {
    const baseDraft = ensureSessionResultDraft(session);
    setSessionResultDraft((prev) => ({
      ...prev,
      [session.id]: {
        ...baseDraft,
        status,
      },
    }));
  };

  const handleResultNoteChange = (session, note) => {
    const baseDraft = ensureSessionResultDraft(session);
    setSessionResultDraft((prev) => ({
      ...prev,
      [session.id]: {
        ...baseDraft,
        note,
      },
    }));
  };

  const handleSaveSessionResult = (session) => {
    const draft = ensureSessionResultDraft(session);
    const payload = buildSessionResultPayload(draft);
    const data = loadAIData();

    data.sessions = (data.sessions || []).map((item) => {
      if (item.id !== session.id) {
        return item;
      }

      return {
        ...item,
        result: payload,
      };
    });

    saveAIData(data);
    setDataVersion((value) => value + 1);
    setStatusMessage({ type: "success", text: "─É├ú cß║¡p nhß║¡t kß║┐t quß║ú v├▓ng ─æß║Ñu cho session." });
  };

  const handleToggleResultLock = (session) => {
    const baseDraft = ensureSessionResultDraft(session);
    const nextDraft = {
      ...baseDraft,
      locked: !baseDraft.locked,
    };

    setSessionResultDraft((prev) => ({
      ...prev,
      [session.id]: nextDraft,
    }));

    const payload = buildSessionResultPayload(nextDraft);
    const data = loadAIData();

    data.sessions = (data.sessions || []).map((item) => {
      if (item.id !== session.id) {
        return item;
      }

      return {
        ...item,
        result: payload,
      };
    });

    saveAIData(data);
    setDataVersion((value) => value + 1);
    setStatusMessage({
      type: "success",
      text: nextDraft.locked
        ? "─É├ú kh├│a kß║┐t quß║ú session. Chß╗ë c├│ thß╗â xem ─æß║┐n khi mß╗ƒ kh├│a."
        : "─É├ú mß╗ƒ kh├│a kß║┐t quß║ú session.",
    });
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>
        ≡ƒÅå Giß║úi ─æß║Ñu & Ca ch╞íi
      </Typography>

      <Stack spacing={2}>
        {statusMessage && <Alert severity={statusMessage.type}>{statusMessage.text}</Alert>}

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              Tß║ío v├▓ng thi/ca ch╞íi
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="T├¬n v├▓ng"
                  placeholder="V├¡ dß╗Ñ: V├▓ng 1"
                  value={roundName}
                  onChange={(event) => setRoundName(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Nh├ún ca ch╞íi"
                  placeholder="V├¡ dß╗Ñ: Ca 18:00-19:30"
                  value={shiftLabel}
                  onChange={(event) => setShiftLabel(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  label="Bß║úng"
                  placeholder="A/B/C..."
                  value={groupLabel}
                  onChange={(event) => setGroupLabel(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <Button fullWidth variant="contained" sx={{ height: "100%" }} onClick={handleCreateRound}>
                  Th├¬m
                </Button>
              </Grid>
            </Grid>

            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>
              S├ón d├╣ng cho giß║úi ─æß║Ñu
            </Typography>

            {activeCourts.length === 0 ? (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                Ch╞░a c├│ s├ón hoß║ít ─æß╗Öng. H├úy th├¬m s├ón ß╗ƒ trang Quß║ún l├╜ s├ón tr╞░ß╗¢c khi tß║ío lß╗ïch giß║úi.
              </Alert>
            ) : (
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 1.5 }}>
                {activeCourts.map((court, index) => (
                  <Chip
                    key={court.id}
                    label={getCourtDisplayName(court, index)}
                    color={selectedTournamentCourtIds.includes(court.id) ? "primary" : "default"}
                    variant={selectedTournamentCourtIds.includes(court.id) ? "filled" : "outlined"}
                    onClick={() => {
                      setSelectedTournamentCourtIds((current) =>
                        current.includes(court.id)
                          ? current.filter((id) => id !== court.id)
                          : [...current, court.id]
                      );
                    }}
                  />
                ))}
              </Stack>
            )}

            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>
              Seed ─æß╗Öi v├áo bß║úng (Open / Skill-Controlled)
            </Typography>

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Mode</InputLabel>
                  <Select
                    label="Mode"
                    value={seedMode}
                    onChange={(event) => setSeedMode(event.target.value)}
                  >
                    <MenuItem value="open">Open (ngß║½u nhi├¬n)</MenuItem>
                    <MenuItem value="skill_controlled">Skill controlled (c├ón bß║▒ng tr├¼nh)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Sß╗æ bß║úng"
                  value={seedGroupCount}
                  onChange={(event) => setSeedGroupCount(event.target.value)}
                  inputProps={{ min: 2, step: 2 }}
                  helperText="Khuyß║┐n nghß╗ï sß╗æ chß║╡n: 4/8/16..."
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Button fullWidth variant="outlined" sx={{ height: "100%" }} onClick={handleSeedGroups}>
                  Tß║ío bß║úng tß╗½ danh s├ích ng╞░ß╗¥i ch╞íi
                </Button>
              </Grid>
            </Grid>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
              <Button variant="contained" color="secondary" onClick={handleGenerateGroupFixtures}>
                Tß║ío lß╗ïch v├▓ng bß║úng tß╗½ seed
              </Button>
            </Stack>

            {seedPreview.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Preview seed gß║ºn nhß║Ñt: {seedPreview.map((group) => `${group.group}(${group.teams.length})`).join(" ΓÇó ")}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              V├▓ng bß║úng & nh├ính loß║íi trß╗▒c tiß║┐p
            </Typography>

            {groupStandings.length === 0 ? (
              <Stack spacing={1}>
                <Typography color="text.secondary">
                  Ch╞░a c├│ dß╗» liß╗çu v├▓ng bß║úng ho├án tß║Ñt. H├úy chß╗æt kß║┐t quß║ú ß╗ƒ tab Sessions ─æß╗â hß╗ç thß╗æng t├¡nh top 2 mß╗ùi bß║úng.
                </Typography>
                {seededRounds.length > 0 && (
                  <Alert severity="info">
                    ─É├ú c├│ bß║úng seed sß║╡n ({seededRounds.length} bß║úng), chß╗¥ cß║¡p nhß║¡t kß║┐t quß║ú completed ─æß╗â hß╗ç thß╗æng tß╗▒ t├¡nh standings v├á knockout.
                  </Alert>
                )}
              </Stack>
            ) : (
              <Stack spacing={2}>
                <Grid container spacing={2}>
                  {groupStandings.map((group) => (
                    <Grid key={group.group} size={{ xs: 12, md: 6, lg: 4 }}>
                      <Card variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                          <Typography fontWeight="bold" sx={{ mb: 0.5 }}>
                            Bß║úng {group.group}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                            {group.roundName || "Round"} ΓÇó Trß║¡n ─æ├ú t├¡nh: {group.matchCount}
                          </Typography>

                          <Stack spacing={0.75}>
                            {group.standing.map((team, index) => (
                              <Box
                                key={team.id}
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: index < 2 ? "success.50" : "transparent",
                                }}
                              >
                                <Typography variant="body2" fontWeight={index < 2 ? "bold" : "medium"}>
                                  {index + 1}. {team.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ─Éiß╗âm: {team.matchPoints} ΓÇó Trß║¡n: {team.played} ΓÇó W-D-L: {team.won}-{team.draw}-{team.lost} ΓÇó HS: {team.pointsFor}/{team.pointsAgainst}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                {groupStandings.length % 2 !== 0 && (
                  <Alert severity="warning">
                    Sß╗æ bß║úng hiß╗çn tß║íi l├á {groupStandings.length}, cß║ºn sß╗æ chß║╡n (4/8/16...) ─æß╗â gh├⌐p cß║╖p A1-B2, A2-B1 v├á sinh bracket ─æß║ºy ─æß╗º.
                  </Alert>
                )}

                {groupStandings.length >= 2 && groupStandings.length % 2 === 0 && (
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" } }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        Bracket loß║íi trß╗▒c tiß║┐p
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={handleResetBracket}
                        disabled={Object.keys(bracketWinners || {}).length === 0 && Object.keys(bracketUnlockedRounds || {}).length === 0}
                      >
                        Reset bracket
                      </Button>
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                      <Chip
                        label={`Rounds ho├án tß║Ñt: ${knockoutProgress.completedRounds}/${knockoutProgress.totalRounds}`}
                        color={knockoutProgress.completedRounds === knockoutProgress.totalRounds ? "success" : "warning"}
                      />
                      <Chip
                        label={knockoutProgress.champion ? `Champion: ${knockoutProgress.champion.name}` : "Ch╞░a c├│ champion"}
                        color={knockoutProgress.champion ? "success" : "default"}
                      />
                    </Stack>

                    {knockoutProgress.champion && (
                      <Alert severity="success">
                        Nh├á v├┤ ─æß╗ïch hiß╗çn tß║íi: {knockoutProgress.champion.name}
                      </Alert>
                    )}

                    {knockoutProgress.rounds.map((round) => {
                      const roundLocked = isKnockoutRoundLocked(round, bracketUnlockedRounds);

                      return (
                        <Card key={round.name} variant="outlined">
                          <CardContent>
                            <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: "center", flexWrap: "wrap" }}>
                              <Typography fontWeight="bold">
                                {round.name}
                              </Typography>
                              <Chip
                                size="small"
                                label={round.completed ? "Completed" : "In progress"}
                                color={round.completed ? "success" : "warning"}
                              />
                              {round.completed && (
                                <Chip
                                  size="small"
                                  label={roundLocked ? "Locked" : "Unlocked"}
                                  color={roundLocked ? "default" : "info"}
                                />
                              )}
                            </Stack>

                            {round.completed && (
                              <Button
                                size="small"
                                variant={roundLocked ? "outlined" : "contained"}
                                color={roundLocked ? "primary" : "warning"}
                                sx={{ mb: 1 }}
                                onClick={() => handleToggleRoundLock(round.name, roundLocked)}
                              >
                                {roundLocked ? "Mß╗ƒ kh├│a chß╗ënh winner" : "Kh├│a lß║íi round"}
                              </Button>
                            )}

                            <Stack spacing={0.75}>
                              {round.matches.map((match) => (
                                <Stack
                                  key={match.id}
                                  direction={{ xs: "column", sm: "row" }}
                                  spacing={1}
                                  sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" } }}
                                >
                                  <Typography variant="body2" color="text.secondary">
                                    {match.id}: {formatBracketTeamName(match.home, match.homeSeed)} vs {formatBracketTeamName(match.away, match.awaySeed)}
                                  </Typography>

                                  <FormControl size="small" sx={{ minWidth: 180 }}>
                                    <InputLabel>Winner</InputLabel>
                                    <Select
                                      label="Winner"
                                      value={match.winnerSide || ""}
                                      onChange={(event) => handleSelectBracketWinner(match.id, event.target.value)}
                                      disabled={!match.canPickWinner || roundLocked}
                                    >
                                      <MenuItem value="">Ch╞░a chß╗ìn</MenuItem>
                                      <MenuItem value="home">{formatBracketTeamName(match.home, match.homeSeed)}</MenuItem>
                                      <MenuItem value="away">{formatBracketTeamName(match.away, match.awaySeed)}</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Stack>
                              ))}
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                )}

              </Stack>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              Trß║íng th├íi vß║¡n h├ánh
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              <Chip label={`Tß╗òng rounds: ${rounds.length}`} color="primary" />
              <Chip label={`Tß╗òng sessions: ${sessions.length}`} color="success" />
              <Chip label={`Sessions ch╞░a g├ín v├▓ng: ${unassignedSessions}`} color="warning" />
              <Chip label={activeSlot ? `─Éang chß║íy: ${activeSlot.roundName}` : "Ch╞░a k├¡ch hoß║ít round"} color={activeSlot ? "info" : "default"} />
            </Stack>

            {activeSlot && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Ca hiß╗çn tß║íi: {activeSlot.shiftLabel || "Ca mß║╖c ─æß╗ïnh"}
                </Typography>
                <Button size="small" variant="outlined" color="error" sx={{ mt: 1 }} onClick={handleDeactivateRound}>
                  Tß║»t g├ín round tß╗▒ ─æß╗Öng
                </Button>
              </Box>
            )}

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                G├ín h├áng loß║ít session ch╞░a g├ín
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Round ─æ├¡ch</InputLabel>
                  <Select
                    label="Round ─æ├¡ch"
                    value={bulkRoundId}
                    onChange={(event) => setBulkRoundId(event.target.value)}
                  >
                    {rounds.map((round) => (
                      <MenuItem key={round.id} value={String(round.id)}>
                        {round.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button variant="contained" color="success" onClick={handleBulkAssignUnassigned}>
                  G├ín tß║Ñt cß║ú session ch╞░a g├ín
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              Export/Import rounds
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
              <Button variant="contained" onClick={handleExportRounds}>
                Xuß║Ñt cß║Ñu h├¼nh
              </Button>
              <Button variant="outlined" onClick={handleDownloadRounds} disabled={!exportText.trim()}>
                Tß║úi file JSON
              </Button>
              <Button variant="outlined" component="label">
                Chß╗ìn file rounds
                <input type="file" hidden accept="application/json" onChange={handleImportFile} />
              </Button>
              <Button variant="contained" color="success" onClick={handleImportRounds} disabled={!importText.trim()}>
                Nhß║¡p cß║Ñu h├¼nh
              </Button>
            </Stack>

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={5}
                  label="Export JSON"
                  value={exportText}
                  onChange={(event) => setExportText(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={5}
                  label="Import JSON"
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              Export kß║┐t quß║ú giß║úi
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
              <Button variant="contained" onClick={handleExportTournamentResults}>
                Xuß║Ñt kß║┐t quß║ú giß║úi
              </Button>
              <Button variant="outlined" onClick={handleDownloadTournamentResults} disabled={!tournamentExportText.trim()}>
                Tß║úi JSON kß║┐t quß║ú
              </Button>
            </Stack>

            <TextField
              fullWidth
              multiline
              minRows={6}
              label="Tournament Result JSON"
              value={tournamentExportText}
              onChange={(event) => setTournamentExportText(event.target.value)}
            />
          </CardContent>
        </Card>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                  Danh s├ích v├▓ng thi
                </Typography>

                {roundStats.length === 0 ? (
                  <Typography color="text.secondary">Ch╞░a c├│ v├▓ng n├áo. Tß║ío v├▓ng mß╗¢i ─æß╗â quß║ún l├╜ nhiß╗üu ca ch╞íi.</Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {roundStats.map((round) => (
                      <Card key={round.id} variant="outlined">
                        <CardContent>
                          <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                            <Box>
                              <Typography fontWeight="bold">{round.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {round.defaultShift || "Kh├┤ng c├│ nh├ún ca"} {round.groupLabel ? `ΓÇó Bß║úng ${round.groupLabel}` : ""}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Sessions: {round.sessionCount} ΓÇó Ho├án tß║Ñt: {round.completedCount} ΓÇó AI TB: {round.avgAIScore}
                              </Typography>
                              {Array.isArray(round.seededTeams) && round.seededTeams.length > 0 && (
                                <Typography variant="caption" color="text.secondary">
                                  Seeded teams: {round.seededTeams.length} ΓÇó Mode: {round.seedMode || "manual"}
                                </Typography>
                              )}
                            </Box>

                            <Stack direction="row" spacing={1}>
                              <Button size="small" variant="contained" onClick={() => handleActivateRound(round)}>
                                K├¡ch hoß║ít
                              </Button>
                              <Button size="small" variant="outlined" color="error" onClick={() => handleDeleteRound(round.id)}>
                                X├│a
                              </Button>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                  Sessions gß║ºn nhß║Ñt
                </Typography>

                {sessions.length === 0 ? (
                  <Typography color="text.secondary">Ch╞░a c├│ session n├áo.</Typography>
                ) : (
                  [...sessions]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 10)
                    .map((session) => (
                      <Box key={session.id} sx={{ mb: 1.5 }}>
                        {(() => {
                          const resultDraft = sessionResultDraft[session.id] || buildSessionResultDraft(session);
                          const summary = summarizeSessionResult(resultDraft);
                          const isLocked = resultDraft.locked;

                          return (
                            <>
                        <Typography fontWeight="bold">
                          {new Date(session.date).toLocaleString("vi-VN")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {session.meta?.roundName || "Round tß╗▒ do"} {session.meta?.shiftLabel ? `ΓÇó ${session.meta.shiftLabel}` : ""}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          S├ón: {session.courts?.length || 0} ΓÇó Chß╗¥: {session.waiting?.length || 0} ΓÇó AI: {session.aiScore?.total || 0}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Kß║┐t quß║ú: {session.result?.status === "completed" ? "─É├ú chß╗æt" : "Ch╞░a chß╗æt"} ΓÇó Tß╗òng ─æiß╗âm A/B: {session.result?.summary?.teamATotal ?? summary.teamATotal}/{session.result?.summary?.teamBTotal ?? summary.teamBTotal} ΓÇó {isLocked ? "─É├ú kh├│a" : "─Éang mß╗ƒ"}
                        </Typography>

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                          <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>G├ín round</InputLabel>
                            <Select
                              label="G├ín round"
                              value={sessionRoundDraft[session.id] || ""}
                              onChange={(event) => {
                                setSessionRoundDraft({
                                  ...sessionRoundDraft,
                                  [session.id]: event.target.value,
                                });
                              }}
                            >
                              {rounds.map((round) => (
                                <MenuItem key={round.id} value={String(round.id)}>
                                  {round.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          <Button size="small" variant="outlined" onClick={() => handleAssignSessionToRound(session.id)}>
                            G├ín session
                          </Button>
                          <Button size="small" variant="text" color="warning" onClick={() => handleUnassignSessionRound(session.id)}>
                            Bß╗Å g├ín
                          </Button>
                        </Stack>

                        <Card variant="outlined" sx={{ mt: 1, p: 1.5 }}>
                          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                            Cß║¡p nhß║¡t kß║┐t quß║ú v├▓ng
                          </Typography>

                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                              <InputLabel>Trß║íng th├íi</InputLabel>
                              <Select
                                label="Trß║íng th├íi"
                                value={resultDraft.status}
                                onChange={(event) => handleResultStatusChange(session, event.target.value)}
                                disabled={isLocked}
                              >
                                <MenuItem value="pending">─Éang thi ─æß║Ñu</MenuItem>
                                <MenuItem value="completed">Ho├án tß║Ñt</MenuItem>
                              </Select>
                            </FormControl>
                            <TextField
                              size="small"
                              fullWidth
                              label="Ghi ch├║ kß║┐t quß║ú"
                              value={resultDraft.note}
                              onChange={(event) => handleResultNoteChange(session, event.target.value)}
                              disabled={isLocked}
                            />
                          </Stack>

                          <Grid container spacing={1}>
                            {resultDraft.courts.map((courtResult) => (
                              <Grid key={courtResult.courtId} size={{ xs: 12, md: 6 }}>
                                <Card variant="outlined" sx={{ p: 1 }}>
                                  <Typography variant="body2" fontWeight="bold">
                                    {courtResult.courtName}
                                  </Typography>

                                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                    <TextField
                                      size="small"
                                      type="number"
                                      label="─Éiß╗âm A"
                                      value={courtResult.teamAScore}
                                      onChange={(event) =>
                                        handleResultScoreChange(session, courtResult.courtId, "A", event.target.value)
                                      }
                                      inputProps={{ min: 0 }}
                                      disabled={isLocked}
                                    />
                                    <TextField
                                      size="small"
                                      type="number"
                                      label="─Éiß╗âm B"
                                      value={courtResult.teamBScore}
                                      onChange={(event) =>
                                        handleResultScoreChange(session, courtResult.courtId, "B", event.target.value)
                                      }
                                      inputProps={{ min: 0 }}
                                      disabled={isLocked}
                                    />
                                  </Stack>

                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                                    Thß║»ng s├ón: {courtResult.winner === "draw" ? "H├▓a" : courtResult.winner === "A" ? "─Éß╗Öi A" : "─Éß╗Öi B"}
                                  </Typography>
                                </Card>
                              </Grid>
                            ))}
                          </Grid>

                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Tß╗òng ─æiß╗âm phi├¬n: A {summary.teamATotal} - B {summary.teamBTotal} ΓÇó Kß║┐t quß║ú: {summary.winner === "draw" ? "H├▓a" : summary.winner === "A" ? "─Éß╗Öi A thß║»ng" : "─Éß╗Öi B thß║»ng"}
                          </Typography>

                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            sx={{ mt: 1 }}
                            onClick={() => handleSaveSessionResult(session)}
                            disabled={isLocked}
                          >
                            L╞░u kß║┐t quß║ú v├▓ng
                          </Button>
                          <Button
                            size="small"
                            variant={isLocked ? "contained" : "outlined"}
                            color={isLocked ? "warning" : "primary"}
                            sx={{ mt: 1, ml: 1 }}
                            onClick={() => handleToggleResultLock(session)}
                          >
                            {isLocked ? "Mß╗ƒ kh├│a kß║┐t quß║ú" : "Kh├│a kß║┐t quß║ú"}
                          </Button>
                        </Card>
                            </>
                          );
                        })()}
                      </Box>
                    ))
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}

function loadBracketUnlockedRounds() {
  const aiData = loadAIData();
  if (aiData?.tournament?.bracketUnlockedRounds && typeof aiData.tournament.bracketUnlockedRounds === "object") {
    return aiData.tournament.bracketUnlockedRounds;
  }

  return {};
}
