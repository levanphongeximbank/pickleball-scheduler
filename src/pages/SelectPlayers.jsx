import { useEffect, useMemo, useState } from "react";

import {
  lockCourt,
  unlockCourt,
  getDirectorState,
  lockPlayer,
  unlockPlayer,
} from "../ai/director";
import { runAI } from "../ai/engine";
import { commitScheduleResult } from "../ai/persist";
import { getPolicies, getRules } from "../ai/policy";
import SelectPlayersResult from "./SelectPlayersResult";
import SelectPlayersCourtSelector from "./SelectPlayersCourtSelector";
import SelectPlayersPlayerPicker from "./SelectPlayersPlayerPicker";
import { useClub } from "../context/ClubContext.jsx";
import { getSessionContextMeta, useSeasonLeague } from "../context/SeasonContext.jsx";
import {
  SESSION_TEMPLATES,
  getTemplateById,
} from "./selectPlayers.templates";
import {
  DEFAULT_COMPETITION_TYPE,
  getCompetitionTypeConfig,
  getCompetitionTypeOptions,
  getEligiblePlayersForCompetition,
  validateCompetitionSelection,
} from "../ai/competition.js";
import {
  buildSelectionMetrics,
  applyAlternativeCandidate,
  buildStartValidationErrors,
  movePlayerInResult,
  swapTeamsInResult,
} from "./selectPlayers.logic";
import { buildLockToggleState } from "./selectPlayers.director.logic";
import {
  loadCourtsFromStorage,
  loadInitialSelectedCourts,
} from "./selectPlayers.data";
import { loadSelectPlayersCandidatePool } from "../features/pairing-candidates/index.js";
import {
  getCapacityStatusMessage,
  getOverCapacityMessage,
  getRequiredCourtsMessage,
  getSelectedCourtsWarningMessage,
  getStartReadinessMessage,
} from "./selectPlayers.messages.logic";

import SelectPlayersDirectorCard from "./SelectPlayersDirectorCard";
import { useAuth } from "../context/AuthContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { loadClubData, saveClubData } from "../domain/clubStorage.js";
import {
  INTERVENTION_PHASE,
  INTERVENTION_TYPE,
  SuperAdminInterventionBanner,
  usePairingIntervention,
} from "../features/pairing-intervention/index.js";
import {
  FounderPairingConstraintsPanel,
  guardFounderConstraints,
  constraintsToCourtPolicies,
  getClubPairingConstraints,
  logConstraintChange,
} from "../features/pairing-constraints/index.js";
import {
  COMPETITION_CLASS,
  prepareLivePrivatePairingOptions,
} from "../features/private-pairing-rules/index.js";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EffectPreludeScreen from "../components/tournament/animation/shared/EffectPreludeScreen.jsx";
import { EFFECT_PRELUDE_SCOPE } from "../components/tournament/animation/shared/effectPreludeConfig.js";

export default function SelectPlayers() {
  const { activeClub, activeClubId, revision, refreshClubs } = useClub();
  const { activeSeasonId, activeLeagueId } = useSeasonLeague();
  const { isSuperAdmin } = useTenant();
  const { user } = useAuth();

  const [sessionTemplateId, setSessionTemplateId] = useState(
    SESSION_TEMPLATES[0].id
  );
  const defaultTemplate = useMemo(
    () => getTemplateById(sessionTemplateId),
    [sessionTemplateId]
  );
  const [scheduleMode, setScheduleMode] = useState(defaultTemplate.mode);
  const [topCandidates, setTopCandidates] = useState(defaultTemplate.topCandidates);
  const [competitionType, setCompetitionType] = useState(DEFAULT_COMPETITION_TYPE);

  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [scheduleResult, setScheduleResult] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [search, setSearch] = useState("");
  const [formMessage, setFormMessage] = useState(null);
  const [preludeOpen, setPreludeOpen] = useState(false);
  const [pendingScheduleResult, setPendingScheduleResult] = useState(null);
  const [preludeContext, setPreludeContext] = useState({ players: [], courts: [] });

  const pairingIntervention = usePairingIntervention({
    phase: INTERVENTION_PHASE.COURT,
    previewMode,
    clubId: activeClubId,
    resourceId: activeClubId,
  });

  const canInterveneCourt = isSuperAdmin && previewMode && pairingIntervention.canIntervene;

  const [lockedCourts, setLockedCourts] = useState(() => {
    return getDirectorState().lockedCourts || [];
  });

  const [lockedPlayers, setLockedPlayers] = useState(() => {
    return getDirectorState().lockedPlayers || [];
  });

  const [clubPolicies, setClubPolicies] = useState(() => getPolicies());
  const [clubRules, setClubRules] = useState(() => getRules());
  const [founderConstraints, setFounderConstraints] = useState([]);

  const refreshDirectorConfig = () => {
    setClubPolicies(getPolicies());
    setClubRules(getRules());
  };

  const handleSaveFounderConstraints = async () => {
    if (!activeClubId) {
      return;
    }

    const guard = guardFounderConstraints({ user });
    if (!guard.ok) {
      setFormMessage({ type: "error", text: guard.error });
      return;
    }

    const before = getClubPairingConstraints(loadClubData(activeClubId));
    const clubData = loadClubData(activeClubId);
    saveClubData(activeClubId, {
      ...clubData,
      founderPairingConstraints: founderConstraints,
    });
    refreshClubs();
    setFormMessage({ type: "success", text: "Đã lưu quy tắc ghép cặp Founder cho CLB." });
    await logConstraintChange({
      user,
      tournamentId: "",
      clubId: activeClubId,
      before,
      after: founderConstraints,
    });
  };

  const founderCourtPolicies = useMemo(
    () => constraintsToCourtPolicies(founderConstraints),
    [founderConstraints]
  );

  const [courts, setCourts] = useState(() => loadCourtsFromStorage());

  const [selectedCourts, setSelectedCourts] = useState(() =>
    loadInitialSelectedCourts(loadCourtsFromStorage())
  );

  const [players, setPlayers] = useState([]);
  const [playersLoadState, setPlayersLoadState] = useState({
    status: "loading",
    message: null,
  });

  const competitionConfig = useMemo(
    () => getCompetitionTypeConfig(competitionType),
    [competitionType]
  );
  const competitionOptions = useMemo(() => getCompetitionTypeOptions(), []);

  useEffect(() => {
    let cancelled = false;
    const nextCourts = loadCourtsFromStorage(activeClubId);

    setCourts(nextCourts);
    setSelectedCourts(loadInitialSelectedCourts(nextCourts));
    setSelectedPlayers([]);
    setScheduleResult(null);
    setPreviewMode(false);
    setLockedCourts(getDirectorState(activeClubId).lockedCourts || []);
    setLockedPlayers(getDirectorState(activeClubId).lockedPlayers || []);
    setFounderConstraints(getClubPairingConstraints(loadClubData(activeClubId)));
    refreshDirectorConfig();
    setPlayers([]);
    setPlayersLoadState({ status: "loading", message: null });
    setFormMessage(null);

    (async () => {
      const result = await loadSelectPlayersCandidatePool(activeClubId);
      if (cancelled) return;

      if (!result.ok) {
        setPlayers([]);
        setPlayersLoadState({
          status: "error",
          message: result.message || "Không tải được danh sách VĐV.",
          code: result.code || "ERROR",
        });
        setFormMessage({
          type: "error",
          text:
            result.message ||
            "Không tải được danh sách VĐV canonical. Không dùng roster blob.",
        });
        return;
      }

      setPlayers(Array.isArray(result.players) ? result.players : []);
      setPlayersLoadState({
        status: "ready",
        message: result.empty ? result.message : null,
        code: result.code || null,
        excludedCount: result.gatewayResult?.summary?.excludedCount || 0,
      });
      if (result.empty) {
        setFormMessage({
          type: "error",
          text: result.message || "Không có VĐV đủ điều kiện để xếp sân.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeClubId, revision]);

  useEffect(() => {
    const eligibleIds = new Set(
      getEligiblePlayersForCompetition(players, competitionType).map((item) => item.id)
    );

    setSelectedPlayers((prev) => prev.filter((playerId) => eligibleIds.has(playerId)));
  }, [competitionType, players]);

  const activeCourts = courts.filter((court) => court.active !== false);
  const activeCourtIds = useMemo(
    () => new Set(activeCourts.map((court) => court.id)),
    [activeCourts]
  );

  const selectedActiveCourts = useMemo(
    () => selectedCourts.filter((id) => activeCourtIds.has(id)),
    [selectedCourts, activeCourtIds]
  );

  const eligiblePlayers = useMemo(
    () => getEligiblePlayersForCompetition(players, competitionType),
    [players, competitionType]
  );

  const filteredPlayers = eligiblePlayers.filter((player) =>
    player.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCourtCount = selectedActiveCourts.length;
  const selectAllActiveCourtsCount = activeCourts.length;
  const {
    maxPlayers,
    requiredCourts,
    waitingPotential,
    hasEnoughSelectedCourts,
    canStart,
    selectEnoughCourtsLabel,
  } = buildSelectionMetrics({
    selectedPlayersCount: selectedPlayers.length,
    selectedCourtCount,
    activeCourtsCount: selectAllActiveCourtsCount,
    playersPerCourt: competitionConfig.playersPerCourt,
    minPlayers: competitionConfig.minPlayers,
  });
  const requiredCourtsMessage = getRequiredCourtsMessage({
    selectedPlayersCount: selectedPlayers.length,
    maxPlayers,
    requiredCourts,
  });
  const overCapacityMessage = getOverCapacityMessage({
    selectedPlayersCount: selectedPlayers.length,
    maxPlayers,
    waitingPotential,
  });
  const capacityStatusMessage = getCapacityStatusMessage({
    activeCourtsCount: activeCourts.length,
    maxPlayers,
    selectedPlayersCount: selectedPlayers.length,
    waitingPotential,
    playersPerCourt: competitionConfig.playersPerCourt,
  });
  const selectedCourtsWarningMessage = getSelectedCourtsWarningMessage({
    hasEnoughSelectedCourts,
    selectedPlayersCount: selectedPlayers.length,
    maxPlayers,
    selectedCourtCount,
    requiredCourts,
  });
  const startReadinessMessage = getStartReadinessMessage({
    selectedPlayersCount: selectedPlayers.length,
    selectedCourtCount,
    maxPlayers,
    requiredCourts,
    minPlayers: competitionConfig.minPlayers,
  });

  const finalizeScheduleStart = (result) => {
    setScheduleResult(result);

    if (scheduleMode === "auto") {
      setPreviewMode(false);
      setFormMessage({ type: "success", text: "Đã auto-apply và lưu phiên xếp sân." });
      return;
    }

    setPreviewMode(true);
    setFormMessage({
      type: "info",
      text: "Đang xem preview. Bấm Áp dụng để lưu phiên, waiting và lịch sử ghép.",
    });
  };

  const handlePreludeComplete = () => {
    setPreludeOpen(false);
    if (pendingScheduleResult) {
      finalizeScheduleStart(pendingScheduleResult);
    }
    setPendingScheduleResult(null);
  };

  const handleStart = async () => {
    setFormMessage(null);

    const errors = buildStartValidationErrors({
      selectedPlayersCount: selectedPlayers.length,
      selectedActiveCourtsCount: selectedActiveCourts.length,
      selectedCourtCount,
      requiredCourts,
      maxPlayers,
      minPlayers: competitionConfig.minPlayers,
    });

    const playersSelected = players.filter((player) =>
      selectedPlayers.includes(player.id)
    );

    const competitionValidation = validateCompetitionSelection(playersSelected, competitionType, {
      selectedCourtCount,
    });

    if (!competitionValidation.isValid) {
      errors.push(...competitionValidation.errors);
    }

    if (errors.length > 0) {
      setFormMessage({ type: "error", text: errors.join(" ") });
      setScheduleResult(null);
      return;
    }

    const enabledCourts = courts.filter((court) =>
      selectedActiveCourts.includes(court.id) && court.active !== false
    );

    const sessionContext = getSessionContextMeta(
      activeClubId,
      activeSeasonId,
      activeLeagueId
    );

    const prepared = await prepareLivePrivatePairingOptions({
      clubId: activeClubId,
      tournamentId: sessionContext?.tournamentId || null,
      competitionClass: COMPETITION_CLASS.DAILY_PLAY,
      pairingConstraints: founderConstraints,
    });

    if (!prepared.ok) {
      setFormMessage({
        type: "error",
        text: prepared.error?.message || "Không tải được quy tắc ghép cặp.",
      });
      return;
    }

    const result = runAI(playersSelected, {
      enabledCourts,
      courtCount: enabledCourts.length,
      lockedCourts,
      lockedPlayers,
      currentResult: scheduleResult,
      topCandidates,
      templateId: sessionTemplateId,
      schedulingMode: scheduleMode,
      activeClub,
      competitionType,
      persist: scheduleMode === "auto",
      sessionContext,
      founderCourtPolicies,
      clubId: activeClubId,
      tournamentId: sessionContext?.tournamentId || null,
      competitionClass: COMPETITION_CLASS.DAILY_PLAY,
      privatePairingRules: prepared.pairingOptions?.privatePairingRules || [],
      pairingConstraints: founderConstraints,
    });

    if (result.privatePairingError || result.errors?.length) {
      setFormMessage({
        type: "error",
        text:
          result.privatePairingError?.message ||
          result.errors?.join(" ") ||
          "Không xếp được sân theo quy tắc riêng.",
      });
      return;
    }

    setPendingScheduleResult(result);
    setPreludeContext({
      players: playersSelected,
      courts: enabledCourts,
      playerCount: playersSelected.length,
      courtCount: enabledCourts.length,
    });
    setPreludeOpen(true);
  };

  const handleApplyPreview = () => {
    if (!scheduleResult) {
      setFormMessage({ type: "error", text: "Không có kết quả preview để áp dụng." });
      return;
    }

    if (scheduleResult.persisted) {
      setPreviewMode(false);
      setFormMessage({ type: "success", text: "Phiên này đã được lưu trước đó." });
      return;
    }

    const commitResult = commitScheduleResult(scheduleResult, {
      competitionType,
      templateId: sessionTemplateId,
      schedulingMode: scheduleMode,
      ...getSessionContextMeta(activeClubId, activeSeasonId, activeLeagueId),
    });

    if (!commitResult.ok) {
      setFormMessage({ type: "error", text: commitResult.error });
      return;
    }

    setScheduleResult((prev) => (prev ? { ...prev, persisted: true } : prev));
    setPreviewMode(false);
    setFormMessage({ type: "success", text: "Đã áp dụng và lưu phiên xếp sân!" });
  };

  const handleCancelPreview = () => {
    setPreviewMode(false);
    setScheduleResult(null);
    setFormMessage(null);
  };

  const handleSwapTeams = (courtId) => {
    if (!canInterveneCourt) {
      return;
    }
    const before = scheduleResult;
    const next = swapTeamsInResult(scheduleResult, courtId);
    setScheduleResult(next);
    pairingIntervention.auditCourtChange({
      interventionType: INTERVENTION_TYPE.COURT_SWAP_TEAMS,
      before,
      after: next,
    });
  };

  const handleMovePlayer = (courtId, fromTeam, playerId) => {
    if (!canInterveneCourt) {
      return;
    }
    const before = scheduleResult;
    const next = movePlayerInResult(scheduleResult, courtId, fromTeam, playerId);
    setScheduleResult(next);
    pairingIntervention.auditCourtChange({
      interventionType: INTERVENTION_TYPE.COURT_MOVE_PLAYER,
      before,
      after: next,
    });
  };

  const handleSelectAlternative = (alternativeIndex) => {
    setScheduleResult((prev) => applyAlternativeCandidate(prev, alternativeIndex));
  };

  const handleTemplateChange = (templateId) => {
    const template = getTemplateById(templateId);
    setSessionTemplateId(templateId);
    setScheduleMode(template.mode);
    setTopCandidates(template.topCandidates);

    if (template.autoSelectAllCourts) {
      setSelectedCourts(activeCourts.map((court) => court.id));
    }
  };

  const handleToggleCourtLock = (courtId) => {
    const nextState = buildLockToggleState(lockedCourts, courtId);

    if (nextState.isLocked) {
      lockCourt(courtId);
    } else {
      unlockCourt(courtId);
    }

    setLockedCourts(nextState.nextLockedIds);
  };

  const handleTogglePlayerLock = (playerId) => {
    const nextState = buildLockToggleState(lockedPlayers, playerId);

    if (nextState.isLocked) {
      lockPlayer(playerId);
    } else {
      unlockPlayer(playerId);
    }

    setLockedPlayers(nextState.nextLockedIds);
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>
        Xếp sân
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Thiết lập buổi chơi
          </Typography>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="competition-select-label">Loại giải</InputLabel>
              <Select
                labelId="competition-select-label"
                value={competitionType}
                label="Loại giải"
                onChange={(e) => setCompetitionType(e.target.value)}
              >
                {competitionOptions.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="template-select-label">Template buổi chơi</InputLabel>
              <Select
                labelId="template-select-label"
                value={sessionTemplateId}
                label="Template buổi chơi"
                onChange={(e) => handleTemplateChange(e.target.value)}
              >
                {SESSION_TEMPLATES.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="mode-select-label">Chế độ xếp</InputLabel>
              <Select
                labelId="mode-select-label"
                value={scheduleMode}
                label="Chế độ xếp"
                onChange={(e) => setScheduleMode(e.target.value)}
              >
                <MenuItem value="review">Review mode</MenuItem>
                <MenuItem value="auto">Auto-apply</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label="Số phương án AI"
              value={topCandidates}
              onChange={(e) => setTopCandidates(Number(e.target.value) || 1)}
              inputProps={{ min: 1, max: 10 }}
            />
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {defaultTemplate.description} • Định dạng: {competitionConfig.label} ({competitionConfig.playersPerCourt} người/sân)
          </Typography>
        </CardContent>
      </Card>

      <TextField
        label="🔍 Tìm kiếm người chơi"
        fullWidth
        sx={{ mb: 3 }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Đang lọc theo {competitionConfig.label}: hiển thị {eligiblePlayers.length}/{players.length} người phù hợp.
      </Typography>

      <Box sx={{ mb: 3 }}>
        <FounderPairingConstraintsPanel
          constraints={founderConstraints}
          players={players}
          onChange={setFounderConstraints}
          onSave={handleSaveFounderConstraints}
        />
        <SelectPlayersDirectorCard
          lockedCourts={lockedCourts}
          lockedPlayers={lockedPlayers}
          clubPolicies={clubPolicies}
          clubRules={clubRules}
          players={players}
          onDirectorConfigChange={refreshDirectorConfig}
        />

        <SelectPlayersCourtSelector
          courts={courts}
          activeCourts={activeCourts}
          selectedCourts={selectedCourts}
          onSelectedCourtsChange={setSelectedCourts}
          selectedPlayersCount={selectedPlayers.length}
          selectedCourtCount={selectedCourtCount}
          selectAllActiveCourtsCount={selectAllActiveCourtsCount}
          maxPlayers={maxPlayers}
          requiredCourts={requiredCourts}
          selectEnoughCourtsLabel={selectEnoughCourtsLabel}
          requiredCourtsMessage={requiredCourtsMessage}
          overCapacityMessage={overCapacityMessage}
          capacityStatusMessage={capacityStatusMessage}
          selectedCourtsWarningMessage={selectedCourtsWarningMessage}
          playersPerCourt={competitionConfig.playersPerCourt}
        />
      </Box>

      {playersLoadState.status === "loading" && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography color="text.secondary">
              Đang tải danh sách VĐV canonical…
            </Typography>
          </CardContent>
        </Card>
      )}

      {formMessage && (
        <Card sx={{ mb: 3, bgcolor: formMessage.type === "error" ? "error.50" : "success.50" }}>
          <CardContent>
            <Typography
              color={formMessage.type === "error" ? "error.main" : "success.main"}
              fontWeight="bold"
            >
              {formMessage.text}
            </Typography>
          </CardContent>
        </Card>
      )}

      <SelectPlayersPlayerPicker
        filteredPlayers={filteredPlayers}
        players={eligiblePlayers}
        selectedPlayers={selectedPlayers}
        onSelectedPlayersChange={setSelectedPlayers}
        lockedPlayers={lockedPlayers}
        onTogglePlayerLock={handleTogglePlayerLock}
      />

      <SelectPlayersResult
        scheduleResult={scheduleResult}
        previewMode={previewMode}
        canIntervene={canInterveneCourt}
        interventionBanner={
          canInterveneCourt ? (
            <SuperAdminInterventionBanner message="Can thiệp xếp sân — đảo đội hoặc chuyển VĐV giữa đội A/B." />
          ) : null
        }
        onApplyPreview={handleApplyPreview}
        onCancelPreview={handleCancelPreview}
        lockedCourts={lockedCourts}
        onToggleCourtLock={handleToggleCourtLock}
        onSwapTeams={handleSwapTeams}
        onMovePlayer={handleMovePlayer}
        lockedPlayers={lockedPlayers}
        onSelectAlternative={handleSelectAlternative}
      />

      <Box sx={{ mt: 2, mb: 2 }}>
        <Typography color={canStart ? "text.secondary" : "error.main"}>
          {startReadinessMessage}
        </Typography>
      </Box>

      <Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
        <Button
          variant="contained"
          size="large"
          color="success"
          onClick={handleStart}
          disabled={!canStart || preludeOpen}
        >
          🤖 BẮT ĐẦU XẾP
        </Button>
      </Box>

      <Dialog
        open={preludeOpen}
        onClose={() => {
          setPreludeOpen(false);
          setPendingScheduleResult(null);
        }}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { bgcolor: "#f8fafc" } }}
      >
        <DialogContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <EffectPreludeScreen
            presetKey={EFFECT_PRELUDE_SCOPE.COURT_SCHEDULING}
            context={preludeContext}
            active={preludeOpen}
            compact
            onComplete={handlePreludeComplete}
            onSkip={handlePreludeComplete}
            onExit={() => {
              setPreludeOpen(false);
              setPendingScheduleResult(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
