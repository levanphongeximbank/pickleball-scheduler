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
import sampleCourts from "../data/sampleCourts";
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
  const [courts] = useState(() => loadCourts(sampleCourts));
  const [selectedTournamentCourtIds, setSelectedTournamentCourtIds] = useState(() =>
    loadInitialSelectedCourts(loadCourts(sampleCourts))
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
      setStatusMessage({ type: "error", text: "Cần ít nhất 8 người để seed đội vào bảng." });
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
        text: `Không đủ đội cho ${groupCount} bảng. Cần tối thiểu ${groupCount * 4} người chơi (mỗi đội 2 người).`,
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
      text: `Đã seed ${seeded.teams.length} đội vào ${groupCount} bảng theo mode ${seedMode === "open" ? "open" : "skill_controlled"}.`,
    });
  };

  const handleGenerateGroupFixtures = () => {
    if (seededRounds.length === 0) {
      setStatusMessage({ type: "error", text: "Chưa có bảng seed để tạo lịch vòng bảng." });
      return;
    }

    if (selectedTournamentCourts.length === 0) {
      setStatusMessage({
        type: "error",
        text: "Chưa chọn sân cho giải. Vui lòng tick ít nhất 1 sân đang hoạt động.",
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
        text: "Đã có lịch vòng bảng sinh tự động cho các bảng hiện tại. Hãy xóa sessions cũ nếu muốn tạo lại.",
      });
      return;
    }

    const generatedSessions = buildSeededGroupSessions(seededRounds, {
      startAt: Date.now(),
      baseDate: Date.now(),
      courts: selectedTournamentCourts,
    });

    if (generatedSessions.length === 0) {
      setStatusMessage({ type: "error", text: "Không tạo được lịch từ dữ liệu seed hiện tại." });
      return;
    }

    data.sessions = [...existingSessions, ...generatedSessions];
    saveAIData(data);
    setDataVersion((value) => value + 1);
    setStatusMessage({
      type: "success",
      text: `Đã tạo ${generatedSessions.length} session vòng bảng từ dữ liệu seed.`,
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
        ? `Đã mở khóa chỉnh sửa winner cho vòng ${key}.`
        : `Đã khóa lại chỉnh sửa winner cho vòng ${key}.`,
    });
  };

  const handleResetBracket = () => {
    const hasWinners = Object.keys(bracketWinners || {}).length > 0;
    const hasUnlocks = Object.keys(bracketUnlockedRounds || {}).length > 0;

    if (!hasWinners && !hasUnlocks) {
      setStatusMessage({ type: "info", text: "Bracket đang trống, không có dữ liệu để reset." });
      return;
    }

    const confirmed = window.confirm("Reset toàn bộ bracket? Hành động này sẽ xóa winner và trạng thái mở khóa hiện tại.");
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
    setStatusMessage({ type: "success", text: "Đã reset toàn bộ bracket (winner + lock state)." });
  };

  const handleCreateRound = () => {
    if (!roundName.trim()) {
      setStatusMessage({ type: "error", text: "Vui lòng nhập tên vòng hoặc ca chơi." });
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
    setStatusMessage({ type: "success", text: "Đã tạo vòng thi/ca chơi mới." });
  };

  const handleDeleteRound = (roundId) => {
    const nextRounds = rounds.filter((round) => round.id !== roundId);
    setRounds(nextRounds);
    saveRounds(nextRounds, activeClubId);

    if (activeSlot?.roundId === roundId) {
      setActiveSlot(null);
      saveActiveSlot(null);
    }

    setStatusMessage({ type: "success", text: "Đã xóa vòng thi." });
  };

  const handleActivateRound = (round) => {
    const slot = {
      roundId: round.id,
      roundName: round.name,
      shiftLabel: round.defaultShift || "Ca mặc định",
      activatedAt: new Date().toISOString(),
    };

    setActiveSlot(slot);
    saveActiveSlot(slot);
    setStatusMessage({ type: "success", text: `Đã kích hoạt ${round.name}. Lần xếp sân tiếp theo sẽ gắn vào vòng này.` });
  };

  const handleDeactivateRound = () => {
    setActiveSlot(null);
    saveActiveSlot(null);
    setStatusMessage({ type: "success", text: "Đã tắt chế độ gán vòng/ca tự động." });
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
    setStatusMessage({ type: "success", text: "Đã xuất cấu hình rounds/ca chơi." });
  };

  const handleDownloadRounds = () => {
    if (!exportText.trim()) {
      setStatusMessage({ type: "error", text: "Vui lòng bấm Xuất cấu hình trước khi tải file." });
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
    setStatusMessage({ type: "success", text: "Đã tải file rounds." });
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
      setStatusMessage({ type: "success", text: "Đã nhập cấu hình rounds thành công." });
    } catch {
      setStatusMessage({ type: "error", text: "JSON import rounds không hợp lệ." });
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
    setStatusMessage({ type: "success", text: "Đã xuất báo cáo kết quả giải." });
  };

  const handleDownloadTournamentResults = () => {
    if (!tournamentExportText.trim()) {
      setStatusMessage({ type: "error", text: "Vui lòng xuất báo cáo kết quả trước khi tải file." });
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

    setStatusMessage({ type: "success", text: "Đã tải file kết quả giải." });
  };

  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result || ""));
      setStatusMessage({ type: "success", text: "Đã nạp file rounds. Bấm Nhập cấu hình để áp dụng." });
    };
    reader.onerror = () => {
      setStatusMessage({ type: "error", text: "Không đọc được file rounds." });
    };

    reader.readAsText(file, "utf-8");
    event.target.value = "";
  };

  const handleAssignSessionToRound = (sessionId) => {
    const selectedRoundId = sessionRoundDraft[sessionId];
    const targetRound = rounds.find((round) => String(round.id) === String(selectedRoundId));

    if (!targetRound) {
      setStatusMessage({ type: "error", text: "Vui lòng chọn round hợp lệ để gán session." });
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
    setStatusMessage({ type: "success", text: "Đã gán session vào round thành công." });
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
    setStatusMessage({ type: "success", text: "Đã bỏ gán round của session." });
  };

  const handleBulkAssignUnassigned = () => {
    const targetRound = rounds.find((round) => String(round.id) === String(bulkRoundId));
    if (!targetRound) {
      setStatusMessage({ type: "error", text: "Vui lòng chọn round để gán hàng loạt." });
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
      setStatusMessage({ type: "success", text: "Không có session nào cần gán hàng loạt." });
      return;
    }

    setStatusMessage({ type: "success", text: `Đã gán ${changedCount} session chưa gán vào ${targetRound.name}.` });
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
    setStatusMessage({ type: "success", text: "Đã cập nhật kết quả vòng đấu cho session." });
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
        ? "Đã khóa kết quả session. Chỉ có thể xem đến khi mở khóa."
        : "Đã mở khóa kết quả session.",
    });
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>
        🏆 Giải đấu & Ca chơi
      </Typography>

      <Stack spacing={2}>
        {statusMessage && <Alert severity={statusMessage.type}>{statusMessage.text}</Alert>}

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              Tạo vòng thi/ca chơi
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Tên vòng"
                  placeholder="Ví dụ: Vòng 1"
                  value={roundName}
                  onChange={(event) => setRoundName(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Nhãn ca chơi"
                  placeholder="Ví dụ: Ca 18:00-19:30"
                  value={shiftLabel}
                  onChange={(event) => setShiftLabel(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  label="Bảng"
                  placeholder="A/B/C..."
                  value={groupLabel}
                  onChange={(event) => setGroupLabel(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <Button fullWidth variant="contained" sx={{ height: "100%" }} onClick={handleCreateRound}>
                  Thêm
                </Button>
              </Grid>
            </Grid>

            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>
              Sân dùng cho giải đấu
            </Typography>

            {activeCourts.length === 0 ? (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                Chưa có sân hoạt động. Hãy thêm sân ở trang Quản lý sân trước khi tạo lịch giải.
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
              Seed đội vào bảng (Open / Skill-Controlled)
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
                    <MenuItem value="open">Open (ngẫu nhiên)</MenuItem>
                    <MenuItem value="skill_controlled">Skill controlled (cân bằng trình)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Số bảng"
                  value={seedGroupCount}
                  onChange={(event) => setSeedGroupCount(event.target.value)}
                  inputProps={{ min: 2, step: 2 }}
                  helperText="Khuyến nghị số chẵn: 4/8/16..."
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Button fullWidth variant="outlined" sx={{ height: "100%" }} onClick={handleSeedGroups}>
                  Tạo bảng từ danh sách người chơi
                </Button>
              </Grid>
            </Grid>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
              <Button variant="contained" color="secondary" onClick={handleGenerateGroupFixtures}>
                Tạo lịch vòng bảng từ seed
              </Button>
            </Stack>

            {seedPreview.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Preview seed gần nhất: {seedPreview.map((group) => `${group.group}(${group.teams.length})`).join(" • ")}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              Vòng bảng & nhánh loại trực tiếp
            </Typography>

            {groupStandings.length === 0 ? (
              <Stack spacing={1}>
                <Typography color="text.secondary">
                  Chưa có dữ liệu vòng bảng hoàn tất. Hãy chốt kết quả ở tab Sessions để hệ thống tính top 2 mỗi bảng.
                </Typography>
                {seededRounds.length > 0 && (
                  <Alert severity="info">
                    Đã có bảng seed sẵn ({seededRounds.length} bảng), chờ cập nhật kết quả completed để hệ thống tự tính standings và knockout.
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
                            Bảng {group.group}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                            {group.roundName || "Round"} • Trận đã tính: {group.matchCount}
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
                                  Điểm: {team.matchPoints} • Trận: {team.played} • W-D-L: {team.won}-{team.draw}-{team.lost} • HS: {team.pointsFor}/{team.pointsAgainst}
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
                    Số bảng hiện tại là {groupStandings.length}, cần số chẵn (4/8/16...) để ghép cặp A1-B2, A2-B1 và sinh bracket đầy đủ.
                  </Alert>
                )}

                {groupStandings.length >= 2 && groupStandings.length % 2 === 0 && (
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" } }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        Bracket loại trực tiếp
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
                        label={`Rounds hoàn tất: ${knockoutProgress.completedRounds}/${knockoutProgress.totalRounds}`}
                        color={knockoutProgress.completedRounds === knockoutProgress.totalRounds ? "success" : "warning"}
                      />
                      <Chip
                        label={knockoutProgress.champion ? `Champion: ${knockoutProgress.champion.name}` : "Chưa có champion"}
                        color={knockoutProgress.champion ? "success" : "default"}
                      />
                    </Stack>

                    {knockoutProgress.champion && (
                      <Alert severity="success">
                        Nhà vô địch hiện tại: {knockoutProgress.champion.name}
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
                                {roundLocked ? "Mở khóa chỉnh winner" : "Khóa lại round"}
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
                                      <MenuItem value="">Chưa chọn</MenuItem>
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
              Trạng thái vận hành
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              <Chip label={`Tổng rounds: ${rounds.length}`} color="primary" />
              <Chip label={`Tổng sessions: ${sessions.length}`} color="success" />
              <Chip label={`Sessions chưa gán vòng: ${unassignedSessions}`} color="warning" />
              <Chip label={activeSlot ? `Đang chạy: ${activeSlot.roundName}` : "Chưa kích hoạt round"} color={activeSlot ? "info" : "default"} />
            </Stack>

            {activeSlot && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Ca hiện tại: {activeSlot.shiftLabel || "Ca mặc định"}
                </Typography>
                <Button size="small" variant="outlined" color="error" sx={{ mt: 1 }} onClick={handleDeactivateRound}>
                  Tắt gán round tự động
                </Button>
              </Box>
            )}

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                Gán hàng loạt session chưa gán
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Round đích</InputLabel>
                  <Select
                    label="Round đích"
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
                  Gán tất cả session chưa gán
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
                Xuất cấu hình
              </Button>
              <Button variant="outlined" onClick={handleDownloadRounds} disabled={!exportText.trim()}>
                Tải file JSON
              </Button>
              <Button variant="outlined" component="label">
                Chọn file rounds
                <input type="file" hidden accept="application/json" onChange={handleImportFile} />
              </Button>
              <Button variant="contained" color="success" onClick={handleImportRounds} disabled={!importText.trim()}>
                Nhập cấu hình
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
              Export kết quả giải
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
              <Button variant="contained" onClick={handleExportTournamentResults}>
                Xuất kết quả giải
              </Button>
              <Button variant="outlined" onClick={handleDownloadTournamentResults} disabled={!tournamentExportText.trim()}>
                Tải JSON kết quả
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
                  Danh sách vòng thi
                </Typography>

                {roundStats.length === 0 ? (
                  <Typography color="text.secondary">Chưa có vòng nào. Tạo vòng mới để quản lý nhiều ca chơi.</Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {roundStats.map((round) => (
                      <Card key={round.id} variant="outlined">
                        <CardContent>
                          <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                            <Box>
                              <Typography fontWeight="bold">{round.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {round.defaultShift || "Không có nhãn ca"} {round.groupLabel ? `• Bảng ${round.groupLabel}` : ""}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Sessions: {round.sessionCount} • Hoàn tất: {round.completedCount} • AI TB: {round.avgAIScore}
                              </Typography>
                              {Array.isArray(round.seededTeams) && round.seededTeams.length > 0 && (
                                <Typography variant="caption" color="text.secondary">
                                  Seeded teams: {round.seededTeams.length} • Mode: {round.seedMode || "manual"}
                                </Typography>
                              )}
                            </Box>

                            <Stack direction="row" spacing={1}>
                              <Button size="small" variant="contained" onClick={() => handleActivateRound(round)}>
                                Kích hoạt
                              </Button>
                              <Button size="small" variant="outlined" color="error" onClick={() => handleDeleteRound(round.id)}>
                                Xóa
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
                  Sessions gần nhất
                </Typography>

                {sessions.length === 0 ? (
                  <Typography color="text.secondary">Chưa có session nào.</Typography>
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
                          {session.meta?.roundName || "Round tự do"} {session.meta?.shiftLabel ? `• ${session.meta.shiftLabel}` : ""}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Sân: {session.courts?.length || 0} • Chờ: {session.waiting?.length || 0} • AI: {session.aiScore?.total || 0}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Kết quả: {session.result?.status === "completed" ? "Đã chốt" : "Chưa chốt"} • Tổng điểm A/B: {session.result?.summary?.teamATotal ?? summary.teamATotal}/{session.result?.summary?.teamBTotal ?? summary.teamBTotal} • {isLocked ? "Đã khóa" : "Đang mở"}
                        </Typography>

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                          <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Gán round</InputLabel>
                            <Select
                              label="Gán round"
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
                            Gán session
                          </Button>
                          <Button size="small" variant="text" color="warning" onClick={() => handleUnassignSessionRound(session.id)}>
                            Bỏ gán
                          </Button>
                        </Stack>

                        <Card variant="outlined" sx={{ mt: 1, p: 1.5 }}>
                          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                            Cập nhật kết quả vòng
                          </Typography>

                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                              <InputLabel>Trạng thái</InputLabel>
                              <Select
                                label="Trạng thái"
                                value={resultDraft.status}
                                onChange={(event) => handleResultStatusChange(session, event.target.value)}
                                disabled={isLocked}
                              >
                                <MenuItem value="pending">Đang thi đấu</MenuItem>
                                <MenuItem value="completed">Hoàn tất</MenuItem>
                              </Select>
                            </FormControl>
                            <TextField
                              size="small"
                              fullWidth
                              label="Ghi chú kết quả"
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
                                      label="Điểm A"
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
                                      label="Điểm B"
                                      value={courtResult.teamBScore}
                                      onChange={(event) =>
                                        handleResultScoreChange(session, courtResult.courtId, "B", event.target.value)
                                      }
                                      inputProps={{ min: 0 }}
                                      disabled={isLocked}
                                    />
                                  </Stack>

                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                                    Thắng sân: {courtResult.winner === "draw" ? "Hòa" : courtResult.winner === "A" ? "Đội A" : "Đội B"}
                                  </Typography>
                                </Card>
                              </Grid>
                            ))}
                          </Grid>

                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Tổng điểm phiên: A {summary.teamATotal} - B {summary.teamBTotal} • Kết quả: {summary.winner === "draw" ? "Hòa" : summary.winner === "A" ? "Đội A thắng" : "Đội B thắng"}
                          </Typography>

                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            sx={{ mt: 1 }}
                            onClick={() => handleSaveSessionResult(session)}
                            disabled={isLocked}
                          >
                            Lưu kết quả vòng
                          </Button>
                          <Button
                            size="small"
                            variant={isLocked ? "contained" : "outlined"}
                            color={isLocked ? "warning" : "primary"}
                            sx={{ mt: 1, ml: 1 }}
                            onClick={() => handleToggleResultLock(session)}
                          >
                            {isLocked ? "Mở khóa kết quả" : "Khóa kết quả"}
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