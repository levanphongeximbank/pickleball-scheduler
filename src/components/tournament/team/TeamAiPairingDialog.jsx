import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import { FORMAT_PRESET, TEAM_GROUP_SEEDING } from "../../../features/team-tournament/constants.js";
import { applyTeamPairing } from "../../../features/team-tournament/engines/teamAutoDrawEngine.js";
import { runTeamFormationWithCanonicalAdapter } from "../../../features/competition-core/formation/adapters/teamFormationAdapter.js";
import {
  COMPETITION_CLASS,
  prepareLivePrivatePairingOptions,
} from "../../../features/private-pairing-rules/index.js";
import TournamentPlayerQuickAddDialog from "../TournamentPlayerQuickAddDialog.jsx";
import { formatPlayerPickerMeta } from "../../../utils/tournamentPlayerPicker.js";
import ShowcaseTeamReveal from "../../../features/team-tournament/showcase/ShowcaseTeamReveal.jsx";
import ShowcaseGroupReveal from "../../../features/team-tournament/showcase/ShowcaseGroupReveal.jsx";
import { buildAiPairingRevealSession } from "../../../features/team-tournament/showcase/buildAiPairingRevealSession.js";
import { buildAiGroupRevealSession } from "../../../features/team-tournament/showcase/buildAiGroupRevealSession.js";
import { SHOWCASE_REVEAL_STEP_MS } from "../../../features/team-tournament/showcase/showcaseConstants.js";
import { prefersReducedMotion } from "../../../features/team-tournament/showcase/showcaseStyles.js";
import { getPlayerGenderKey } from "../../../models/player.js";
import { reconcileSelectedAthletesForEngineInput } from "../../../features/team-tournament/showcase/reconcileSelectedAthletesForEngineInput.js";
import TeamAiPairingConfigBoard, {
  DarkDialogHeader,
} from "./TeamAiPairingConfigBoard.jsx";

const DIALOG_PAPER_SX = {
  bgcolor: "#07111f",
  color: "#f4f7fb",
  backgroundImage:
    "radial-gradient(ellipse at top, rgba(46, 204, 113, 0.1), transparent 55%), linear-gradient(180deg, #0a1628 0%, #07111f 50%, #050b14 100%)",
  minHeight: "100vh",
  backgroundSize: "100% 100%",
};

function playerLabel(player) {
  if (!player) return "";
  return `${player.name || player.id} · ${formatPlayerPickerMeta(player)}`;
}

function teamGenderStats(team, playerById) {
  let male = 0;
  let female = 0;
  (team?.playerIds || []).forEach((id) => {
    const key = getPlayerGenderKey(playerById.get(String(id))?.gender);
    if (key === "male") male += 1;
    if (key === "female") female += 1;
  });
  return { male, female };
}

export default function TeamAiPairingDialog({
  open,
  onClose,
  teamData,
  players = [],
  clubs = [],
  clubId = "",
  tournamentId = "",
  tournament = null,
  tenantId = null,
  clubFromQuery = null,
  activeClubId = null,
  competitionClass = COMPETITION_CLASS.INTERNAL,
  defaultClubName = "",
  onPlayersRefresh,
  onMessage,
  onApply,
  onError,
}) {
  void clubs;
  const isMlp = teamData?.settings?.formatPreset === FORMAT_PRESET.MLP_4;
  const hasExistingTeams = (teamData?.teams?.length || 0) > 0;

  const [activeStep, setActiveStep] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [teamCount, setTeamCount] = useState(8);
  const [teamNames, setTeamNames] = useState(
    Array.from({ length: 8 }, (_, i) => `Đội ${i + 1}`)
  );
  const [groupCount, setGroupCount] = useState(2);
  const [genderFilter, setGenderFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pairingResult, setPairingResult] = useState(null);
  const [groupTeamData, setGroupTeamData] = useState(null);
  const [captains, setCaptains] = useState({});
  const [applying, setApplying] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [localAddedPlayers, setLocalAddedPlayers] = useState([]);
  const [pairingEffectActive, setPairingEffectActive] = useState(false);
  const [groupEffectActive, setGroupEffectActive] = useState(false);
  const [revealSession, setRevealSession] = useState(null);
  const [groupRevealSession, setGroupRevealSession] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [focusTeamIndex, setFocusTeamIndex] = useState(0);

  const pendingPairingRef = useRef(null);

  const pickerPlayers = useMemo(() => {
    const pool = new Map();
    [...players, ...localAddedPlayers].forEach((player) => {
      if (player?.id) pool.set(String(player.id), player);
    });
    return [...pool.values()];
  }, [players, localAddedPlayers]);

  const assignedPlayerIds = useMemo(
    () => (teamData?.teams || []).flatMap((team) => team.playerIds || []),
    [teamData]
  );

  const playerById = useMemo(
    () => new Map(pickerPlayers.map((player) => [String(player.id), player])),
    [pickerPlayers]
  );

  const commitPendingPairing = useCallback(() => {
    const pending = pendingPairingRef.current;
    if (!pending) return null;
    pendingPairingRef.current = null;
    setPairingResult({
      teams: pending.teams,
      waitingPlayerIds: pending.waitingPlayerIds,
      warnings: pending.warnings,
      privatePairingMeta: pending.privatePairingMeta,
    });
    setCaptains(pending.captains || {});
    return pending;
  }, []);

  const closePairingReveal = useCallback(() => {
    commitPendingPairing();
    setPairingEffectActive(false);
    setRevealSession(null);
  }, [commitPendingPairing]);

  const startGroupReveal = useCallback(
    (teamsOverride = null) => {
      const pending = commitPendingPairing();
      const teams =
        teamsOverride ||
        pending?.teams ||
        pairingResult?.teams ||
        [];
      if (!teams.length) {
        onError?.("Ghép đội trước khi chia bảng.");
        return;
      }

      const built = buildAiGroupRevealSession({
        teams,
        players: pickerPlayers,
        groupCount,
        seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
        rulesVersion: "",
        randomFn: Math.random,
      });
      if (!built.ok) {
        onError?.(built.error || "Không chia được bảng.");
        return;
      }

      setPairingEffectActive(false);
      setRevealSession(null);
      setGroupTeamData(built.teamData);
      setGroupRevealSession(built.session);
      setReducedMotion(prefersReducedMotion());
      setGroupEffectActive(true);
    },
    [commitPendingPairing, pairingResult?.teams, pickerPlayers, groupCount, onError]
  );

  const closeGroupReveal = useCallback(
    ({ goToCaptainStep = false } = {}) => {
      setGroupEffectActive(false);
      setGroupRevealSession(null);
      if (goToCaptainStep) {
        setActiveStep(1);
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    setActiveStep(0);
    setSelectedIds([]);
    setTeamCount(8);
    setTeamNames(Array.from({ length: 8 }, (_, i) => `Đội ${i + 1}`));
    setGroupCount(2);
    setGenderFilter("all");
    setSearch("");
    setPairingResult(null);
    setGroupTeamData(null);
    setCaptains({});
    setLocalAddedPlayers([]);
    setPairingEffectActive(false);
    setGroupEffectActive(false);
    setRevealSession(null);
    setGroupRevealSession(null);
    pendingPairingRef.current = null;
    setFocusTeamIndex(0);
    setReducedMotion(prefersReducedMotion());
  }, [open]);

  useEffect(() => {
    setTeamNames((previous) => {
      const count = Math.max(2, Number(teamCount) || 2);
      const next = [...previous];
      while (next.length < count) next.push(`Đội ${next.length + 1}`);
      return next.slice(0, count);
    });
  }, [teamCount]);

  function handleTogglePlayer(playerId) {
    const normalized = String(playerId);
    setSelectedIds((previous) =>
      previous.includes(normalized)
        ? previous.filter((id) => id !== normalized)
        : [...previous, normalized]
    );
  }

  function handleSelectAll(ids) {
    const incoming = (ids || []).map(String);
    setSelectedIds((previous) => {
      const next = new Set(previous.map(String));
      for (const id of incoming) next.add(id);
      return [...next];
    });
  }

  function handleClearFiltered(ids) {
    const visible = new Set((ids || []).map(String));
    setSelectedIds((previous) => previous.filter((id) => !visible.has(String(id))));
  }

  function handleClearAll() {
    setSelectedIds([]);
  }

  function handleQuickAddSaved(player) {
    if (!player?.id) return;
    const playerId = String(player.id);
    setLocalAddedPlayers((previous) => {
      const pool = new Map(previous.map((item) => [String(item.id), item]));
      pool.set(playerId, player);
      return [...pool.values()];
    });
    setSelectedIds((previous) =>
      previous.includes(playerId) ? previous : [...previous, playerId]
    );
    onPlayersRefresh?.();
    onMessage?.(`Đã thêm và chọn ${player.name}.`);
  }

  async function handlePairTeams() {
    if (pairingEffectActive || groupEffectActive) return;

    const resolvedCompetitionClass =
      competitionClass ||
      teamData?.settings?.competitionClass ||
      COMPETITION_CLASS.INTERNAL;

    pendingPairingRef.current = null;
    setPairingResult(null);
    setGroupTeamData(null);
    setRevealSession(null);

    const prepared = await prepareLivePrivatePairingOptions({
      tournament: tournament || { id: tournamentId, clubId, tenantId },
      tournamentId: tournamentId || tournament?.id || null,
      clubId: clubId || tournament?.clubId || null,
      clubFromQuery,
      activeClubId,
      tenantId: tenantId || tournament?.tenantId || null,
      competitionClass: resolvedCompetitionClass,
      pairingConstraints: [],
    });

    if (!prepared.ok) {
      onError?.(prepared.error?.message || "Không thể ghép đội theo quy tắc riêng.");
      return;
    }

    const reconciliation = reconcileSelectedAthletesForEngineInput({
      athletes: pickerPlayers,
      selectedAthleteIds: selectedIds,
      requestedTeamCount: teamCount,
      athletesPerTeam: 4,
      requireMlpBalance: true,
    });
    if (!reconciliation.ok) {
      const removalLines = reconciliation.removals
        .slice(0, 12)
        .map(
          (row) =>
            `${row.athleteName} (${row.athleteId}) · ${row.removalReason} · raw=${String(row.rawGender)} → ${row.normalizedGender}`
        )
        .join("\n");
      onError?.(
        [
          reconciliation.message ||
            `Bạn đã chọn ${reconciliation.selectedCount} VĐV nhưng hệ thống chỉ xác nhận ${reconciliation.finalEngineInputCount} VĐV hợp lệ.`,
          ...reconciliation.blockers.filter((item) => item !== reconciliation.message),
          removalLines,
        ]
          .filter(Boolean)
          .join("\n")
      );
      return;
    }

    const pairing = runTeamFormationWithCanonicalAdapter({
      players: reconciliation.finalAthletes,
      selectedPlayerIds: reconciliation.finalAthletes.map((athlete) => String(athlete.id)),
      teamCount,
      teamNames,
      formatPreset: teamData?.settings?.formatPreset || FORMAT_PRESET.MLP_4,
      privatePairingRules: prepared.pairingOptions?.privatePairingRules || [],
      competitionClass: resolvedCompetitionClass,
      clubId: prepared.pairingOptions?.clubId || clubId || null,
      tournamentId: prepared.pairingOptions?.tournamentId || tournamentId || null,
      seed: 1,
      requireFullFill: true,
    });

    if (pairing.privatePairingError || pairing.ok === false) {
      const code = pairing.privatePairingError?.code;
      onError?.(
        pairing.privatePairingError?.message ||
          (code ? `${pairing.warnings?.[0] || "Không thể ghép đội"} (${code})` : null) ||
          pairing.warnings?.[0] ||
          "Không thể ghép đội thỏa quy tắc bắt buộc."
      );
      return;
    }

    const usedIds = (pairing.teams || []).flatMap((team) =>
      (team.playerIds || []).map(String)
    );
    if (
      usedIds.length !== reconciliation.finalEngineInputCount ||
      new Set(usedIds).size !== usedIds.length ||
      (pairing.teams || []).length !== Number(teamCount)
    ) {
      onError?.(
        `Bạn đã chọn ${reconciliation.selectedCount} VĐV nhưng hệ thống chỉ xếp được ${usedIds.length} VĐV vào ${(pairing.teams || []).length}/${teamCount} đội.`
      );
      return;
    }

    const reveal = buildAiPairingRevealSession({
      teams: pairing.teams,
      players: reconciliation.finalAthletes,
    });
    if (!reveal.ok) {
      onError?.(reveal.error || "Không thể trình chiếu kết quả ghép đội.");
      return;
    }

    const revealAthletes = (reveal.session?.teamCards || []).flatMap(
      (team) => team.athletes || []
    );
    if (revealAthletes.length !== reconciliation.finalEngineInputCount) {
      onError?.(
        `Lễ công bố chỉ có ${revealAthletes.length}/${reconciliation.finalEngineInputCount} VĐV — đã chặn để tránh mất VĐV im lặng.`
      );
      return;
    }

    const initialCaptains = {};
    (pairing.teams || []).forEach((team) => {
      initialCaptains[team.id] = "";
    });

    pendingPairingRef.current = {
      teams: pairing.teams,
      waitingPlayerIds: pairing.waitingPlayerIds,
      warnings: pairing.warnings,
      privatePairingMeta: pairing.privatePairingMeta,
      captains: initialCaptains,
    };
    setFocusTeamIndex(0);
    setRevealSession(reveal.session);
    setReducedMotion(prefersReducedMotion());
    setPairingEffectActive(true);
  }

  function handleCaptainChange(teamId, captainId) {
    setCaptains((previous) => ({ ...previous, [teamId]: captainId }));
  }

  async function handleApply() {
    if (applying) return;
    if (!pairingResult?.teams?.length) {
      onError?.("Không có đội để áp dụng.");
      return;
    }

    const missingCaptain = pairingResult.teams.find(
      (team) => !captains[team.id] || !team.playerIds.includes(captains[team.id])
    );
    if (missingCaptain) {
      onError?.(`Chọn đội trưởng cho ${missingCaptain.name}.`);
      return;
    }

    const teamsWithCaptains = pairingResult.teams.map((team) => ({
      ...team,
      captainPlayerId: captains[team.id],
    }));

    const result = applyTeamPairing(teamData, { teams: teamsWithCaptains });
    if (!result.ok) {
      onError?.(result.error);
      return;
    }

    const nextTeamData = {
      ...result.teamData,
      groups: groupTeamData?.groups || [],
      matchups: groupTeamData?.groups?.length ? [] : result.teamData.matchups || [],
    };

    setApplying(true);
    try {
      const applyResult = await onApply?.(nextTeamData, {
        ...result,
        teamData: nextTeamData,
      });
      if (applyResult?.ok === false) return;
      if (applyResult == null || applyResult.ok !== false) onClose?.();
    } finally {
      setApplying(false);
    }
  }

  const waitingPlayers = useMemo(() => {
    if (!pairingResult?.waitingPlayerIds?.length) return [];
    return pairingResult.waitingPlayerIds
      .map((id) => playerById.get(String(id)))
      .filter(Boolean);
  }, [pairingResult, playerById]);

  const allCaptainsSelected = useMemo(() => {
    if (!pairingResult?.teams?.length) return false;
    return pairingResult.teams.every(
      (team) => captains[team.id] && team.playerIds.includes(captains[team.id])
    );
  }, [pairingResult, captains]);

  const focusTeam =
    pairingResult?.teams?.[Math.min(focusTeamIndex, Math.max((pairingResult?.teams?.length || 1) - 1, 0))] ||
    null;
  const focusStats = focusTeam ? teamGenderStats(focusTeam, playerById) : { male: 0, female: 0 };
  const focusRoster = (focusTeam?.playerIds || [])
    .map((id) => playerById.get(String(id)))
    .filter(Boolean);

  const effectBusy = pairingEffectActive || groupEffectActive;

  return (
    <Dialog
      open={open}
      onClose={effectBusy ? undefined : onClose}
      fullScreen
      fullWidth
      maxWidth="xl"
      PaperProps={{ sx: DIALOG_PAPER_SX }}
    >
      <DarkDialogHeader
        title={activeStep === 0 ? "Chia đội AI" : "Chọn đội trưởng"}
        subtitle={
          activeStep === 0
            ? "Pickleball thông minh"
            : "Gắn đội trưởng sau khi đã chia đội và bảng"
        }
        onClose={effectBusy || applying ? undefined : onClose}
      />

      <DialogContent
        sx={{
          width: "100%",
          maxWidth: 1440,
          mx: "auto",
          px: { xs: 2, md: 3 },
          pb: 2,
          pt: 1,
        }}
      >
        <Stack spacing={1.75}>
          {!isMlp ? (
            <Alert severity="warning" sx={{ bgcolor: "rgba(255,167,38,0.12)" }}>
              AI ghép đội chỉ áp dụng khi giải dùng preset MLP 4 người.
            </Alert>
          ) : null}

          {hasExistingTeams ? (
            <Alert severity="warning" sx={{ bgcolor: "rgba(255,167,38,0.12)" }}>
              Thao tác này sẽ thay thế toàn bộ đội hiện tại (bảng và lịch sẽ được làm mới).
            </Alert>
          ) : null}

          {activeStep === 0 ? (
            <>
              <TeamAiPairingConfigBoard
                players={pickerPlayers}
                selectedIds={selectedIds}
                onToggle={handleTogglePlayer}
                onSelectAll={handleSelectAll}
                onClearFiltered={handleClearFiltered}
                onClearAll={handleClearAll}
                genderFilter={genderFilter}
                onGenderFilterChange={setGenderFilter}
                search={search}
                onSearchChange={setSearch}
                excludePlayerIds={assignedPlayerIds}
                focusTeam={focusTeam}
                focusRoster={focusRoster}
                focusStats={focusStats}
                teams={pairingResult?.teams || []}
                focusTeamIndex={focusTeamIndex}
                onFocusTeam={setFocusTeamIndex}
                teamCount={teamCount}
                onTeamCountChange={setTeamCount}
                groupCount={groupCount}
                onGroupCountChange={setGroupCount}
                onPair={handlePairTeams}
                pairDisabled={!isMlp || selectedIds.length < 4}
                pairingBusy={effectBusy}
                onStartGroups={() => startGroupReveal()}
                canStartGroups={Boolean(pairingResult?.teams?.length) && !effectBusy}
                onAddNew={clubId ? () => setQuickAddOpen(true) : undefined}
              />

              {groupTeamData?.groups?.length ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                  <Alert severity="success" sx={{ flex: 1, bgcolor: "rgba(124,255,178,0.1)" }}>
                    Đã chia {groupTeamData.groups.length} bảng — tiếp tục chọn đội trưởng.
                  </Alert>
                  <Button
                    variant="contained"
                    onClick={() => setActiveStep(1)}
                    sx={{
                      bgcolor: "#7CFFB2",
                      color: "#061018",
                      fontWeight: 800,
                      textTransform: "none",
                      "&:hover": { bgcolor: "#9affc6" },
                    }}
                  >
                    Tiếp tục — đội trưởng
                  </Button>
                </Stack>
              ) : null}

              {pairingResult?.warnings?.map((warning) => (
                <Alert key={warning} severity="warning">
                  {warning}
                </Alert>
              ))}
            </>
          ) : (
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
              <Box sx={{ flex: 2 }}>
                <Typography fontWeight={800} gutterBottom>
                  Đội đã ghép — chọn đội trưởng
                </Typography>
                <Stack spacing={1.5}>
                  {pairingResult?.teams?.map((team) => {
                    const roster = team.playerIds
                      .map((id) => playerById.get(String(id)))
                      .filter(Boolean);
                    return (
                      <Paper
                        key={team.id}
                        elevation={0}
                        sx={{
                          p: 2,
                          bgcolor: "rgba(10, 20, 36, 0.92)",
                          border: "1px solid rgba(124,255,178,0.18)",
                          borderRadius: 2,
                        }}
                      >
                        <Stack spacing={1.5}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            flexWrap="wrap"
                            gap={1}
                          >
                            <Typography fontWeight={700}>{team.name}</Typography>
                            <Chip
                              size="small"
                              label={`Seed #${team.seed} · TB ${team.avgLevel?.toFixed(2) || "—"}`}
                              sx={{ color: "#7CFFB2", borderColor: "rgba(124,255,178,0.35)" }}
                              variant="outlined"
                            />
                          </Stack>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {roster.map((player) => (
                              <Chip
                                key={player.id}
                                size="small"
                                label={playerLabel(player)}
                                sx={{
                                  bgcolor: "rgba(255,255,255,0.06)",
                                  color: "#f4f7fb",
                                }}
                              />
                            ))}
                          </Stack>
                          <FormControl fullWidth size="small">
                            <InputLabel
                              id={`captain-${team.id}`}
                              sx={{ color: "rgba(244,247,251,0.65)" }}
                            >
                              Đội trưởng
                            </InputLabel>
                            <Select
                              labelId={`captain-${team.id}`}
                              label="Đội trưởng"
                              value={captains[team.id] || ""}
                              onChange={(event) =>
                                handleCaptainChange(team.id, event.target.value)
                              }
                              sx={{
                                color: "#f4f7fb",
                                ".MuiOutlinedInput-notchedOutline": {
                                  borderColor: "rgba(255,255,255,0.18)",
                                },
                              }}
                            >
                              {roster.map((player) => (
                                <MenuItem key={player.id} value={String(player.id)}>
                                  {player.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>

              <Box sx={{ flex: 1, minWidth: 220 }}>
                <Typography fontWeight={800} gutterBottom>
                  VĐV chờ ({waitingPlayers.length})
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    minHeight: 120,
                    bgcolor: "rgba(10, 20, 36, 0.92)",
                    border: "1px solid rgba(124,255,178,0.18)",
                    borderRadius: 2,
                  }}
                >
                  {waitingPlayers.length === 0 ? (
                    <Typography variant="body2" sx={{ opacity: 0.55 }}>
                      Không có VĐV chờ.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {waitingPlayers.map((player) => (
                        <Stack
                          key={player.id}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          spacing={1}
                        >
                          <Typography variant="body2">{player.name}</Typography>
                          <Chip size="small" color="warning" label="Chờ" />
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Paper>

                <Stack direction="row" spacing={1} mt={2}>
                  <Button
                    variant="outlined"
                    onClick={() => setActiveStep(0)}
                    disabled={applying}
                    sx={{ color: "#f4f7fb", borderColor: "rgba(255,255,255,0.25)" }}
                  >
                    Quay lại
                  </Button>
                  <Button
                    variant="contained"
                    disabled={!allCaptainsSelected || applying}
                    onClick={handleApply}
                    sx={{
                      bgcolor: "#7CFFB2",
                      color: "#061018",
                      fontWeight: 800,
                      textTransform: "none",
                      "&:hover": { bgcolor: "#9affc6" },
                    }}
                  >
                    {applying ? "Đang lưu…" : "Xác nhận"}
                  </Button>
                </Stack>

                {groupTeamData?.groups?.length ? (
                  <Alert severity="info" sx={{ mt: 1.5, bgcolor: "rgba(124,255,178,0.08)" }}>
                    Đã gắn {groupTeamData.groups.length} bảng vào kết quả lưu.
                  </Alert>
                ) : (
                  <Alert severity="warning" sx={{ mt: 1.5 }}>
                    Chưa chạy chia bảng — lưu sẽ chỉ có đội.
                  </Alert>
                )}
              </Box>
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <TournamentPlayerQuickAddDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        hostClubId={clubId}
        defaultClubName={defaultClubName}
        onSaved={handleQuickAddSaved}
      />

      <Dialog
        open={pairingEffectActive && Boolean(revealSession)}
        fullScreen
        disableEscapeKeyDown
        onClose={() => {}}
        PaperProps={{
          sx: {
            bgcolor: "#07111f",
            color: "#f4f7fb",
            backgroundImage:
              "radial-gradient(ellipse at top, rgba(46, 204, 113, 0.12), transparent 55%), linear-gradient(180deg, #0a1628 0%, #07111f 45%, #050b14 100%)",
          },
        }}
      >
        <DialogContent
          sx={{
            maxWidth: 1200,
            mx: "auto",
            width: "100%",
            py: { xs: 3, md: 5 },
            px: { xs: 2, md: 4 },
          }}
        >
          <ShowcaseTeamReveal
            session={revealSession}
            reducedMotion={reducedMotion}
            stepMs={SHOWCASE_REVEAL_STEP_MS}
            continueLabel="Chia bảng ngay"
            closeLabel="Đóng kết quả đội"
            onContinue={() => startGroupReveal()}
            onClose={closePairingReveal}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={groupEffectActive && Boolean(groupRevealSession)}
        fullScreen
        disableEscapeKeyDown
        onClose={() => {}}
        PaperProps={{
          sx: {
            bgcolor: "#07111f",
            color: "#f4f7fb",
            backgroundImage:
              "radial-gradient(ellipse at top, rgba(46, 204, 113, 0.12), transparent 55%), linear-gradient(180deg, #0a1628 0%, #07111f 45%, #050b14 100%)",
          },
        }}
      >
        <DialogContent
          sx={{
            maxWidth: 1200,
            mx: "auto",
            width: "100%",
            py: { xs: 3, md: 5 },
            px: { xs: 2, md: 4 },
          }}
        >
          <ShowcaseGroupReveal
            session={groupRevealSession}
            seedingMode={groupRevealSession?.groupSession?.seedingMode}
            engineVersion={groupRevealSession?.engineVersion}
            rulesVersion={groupRevealSession?.rulesVersion}
            reducedMotion={reducedMotion}
            continueLabel="Tiếp tục — chọn đội trưởng"
            onContinue={() => closeGroupReveal({ goToCaptainStep: true })}
            onClose={() => closeGroupReveal({ goToCaptainStep: false })}
          />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
