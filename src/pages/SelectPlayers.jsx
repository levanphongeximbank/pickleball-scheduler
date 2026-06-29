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
  loadPlayersFromStorage,
} from "./selectPlayers.data";
import {
  getCapacityStatusMessage,
  getOverCapacityMessage,
  getRequiredCourtsMessage,
  getSelectedCourtsWarningMessage,
  getStartReadinessMessage,
} from "./selectPlayers.messages.logic";

import SelectPlayersDirectorCard from "./SelectPlayersDirectorCard";
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export default function SelectPlayers() {
  const { activeClub, activeClubId, revision } = useClub();
  const { activeSeasonId, activeLeagueId } = useSeasonLeague();

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

  const [lockedCourts, setLockedCourts] = useState(() => {
    return getDirectorState().lockedCourts || [];
  });

  const [lockedPlayers, setLockedPlayers] = useState(() => {
    return getDirectorState().lockedPlayers || [];
  });

  const [clubPolicies, setClubPolicies] = useState(() => getPolicies());
  const [clubRules, setClubRules] = useState(() => getRules());

  const refreshDirectorConfig = () => {
    setClubPolicies(getPolicies());
    setClubRules(getRules());
  };

  const [courts, setCourts] = useState(() => loadCourtsFromStorage());

  const [selectedCourts, setSelectedCourts] = useState(() =>
    loadInitialSelectedCourts(loadCourtsFromStorage())
  );

  const [players, setPlayers] = useState(() => loadPlayersFromStorage());

  const competitionConfig = useMemo(
    () => getCompetitionTypeConfig(competitionType),
    [competitionType]
  );
  const competitionOptions = useMemo(() => getCompetitionTypeOptions(), []);

  useEffect(() => {
    const nextCourts = loadCourtsFromStorage(activeClubId);
    const nextPlayers = loadPlayersFromStorage(activeClubId);

    setCourts(nextCourts);
    setPlayers(nextPlayers);
    setSelectedCourts(loadInitialSelectedCourts(nextCourts));
    setSelectedPlayers([]);
    setScheduleResult(null);
    setPreviewMode(false);
    setLockedCourts(getDirectorState(activeClubId).lockedCourts || []);
    setLockedPlayers(getDirectorState(activeClubId).lockedPlayers || []);
    refreshDirectorConfig();
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

  const handleStart = () => {
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
      sessionContext: getSessionContextMeta(activeClubId, activeSeasonId, activeLeagueId),
    });

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
    setScheduleResult((prev) => swapTeamsInResult(prev, courtId));
  };

  const handleMovePlayer = (courtId, fromTeam, playerId) => {
    setScheduleResult((prev) =>
      movePlayerInResult(prev, courtId, fromTeam, playerId)
    );
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
          disabled={!canStart}
        >
          🤖 BẮT ĐẦU XẾP
        </Button>
      </Box>
    </Box>
  );
}
