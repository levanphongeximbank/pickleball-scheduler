import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";

import { FORMAT_PRESET } from "../../../features/team-tournament/constants.js";
import { applyTeamPairing } from "../../../features/team-tournament/engines/teamAutoDrawEngine.js";
import { runTeamFormationWithCanonicalAdapter } from "../../../features/competition-core/formation/adapters/teamFormationAdapter.js";
import {
  COMPETITION_CLASS,
  prepareLivePrivatePairingOptions,
} from "../../../features/private-pairing-rules/index.js";
import TournamentPlayerPickerPanel from "../TournamentPlayerPickerPanel.jsx";
import TournamentPlayerQuickAddDialog from "../TournamentPlayerQuickAddDialog.jsx";
import { ALL_CLUBS_FILTER, formatPlayerPickerMeta } from "../../../utils/tournamentPlayerPicker.js";

const STEPS = ["Cấu hình ghép đội", "Duyệt & chọn đội trưởng"];

function playerLabel(player) {
  if (!player) {
    return "";
  }
  return `${player.name || player.id} · ${formatPlayerPickerMeta(player)}`;
}

export default function TeamAiPairingDialog({
  open,
  onClose,
  teamData,
  players = [],
  clubs = [],
  clubId = "",
  tournamentId = "",
  competitionClass = COMPETITION_CLASS.INTERNAL,
  defaultClubName = "",
  onPlayersRefresh,
  onMessage,
  onApply,
  onError,
}) {
  const isMlp = teamData?.settings?.formatPreset === FORMAT_PRESET.MLP_4;
  const hasExistingTeams = (teamData?.teams?.length || 0) > 0;

  const [activeStep, setActiveStep] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [teamCount, setTeamCount] = useState(2);
  const [teamNames, setTeamNames] = useState(["Đội 1", "Đội 2"]);
  const [clubFilter, setClubFilter] = useState(ALL_CLUBS_FILTER);
  const [genderFilter, setGenderFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pairingResult, setPairingResult] = useState(null);
  const [captains, setCaptains] = useState({});
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [localAddedPlayers, setLocalAddedPlayers] = useState([]);

  const pickerPlayers = useMemo(() => {
    const pool = new Map();
    [...players, ...localAddedPlayers].forEach((player) => {
      if (player?.id) {
        pool.set(String(player.id), player);
      }
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

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveStep(0);
    setSelectedIds([]);
    setTeamCount(2);
    setTeamNames(["Đội 1", "Đội 2"]);
    setClubFilter(ALL_CLUBS_FILTER);
    setGenderFilter("all");
    setSearch("");
    setPairingResult(null);
    setCaptains({});
    setLocalAddedPlayers([]);
  }, [open]);

  useEffect(() => {
    setTeamNames((previous) => {
      const count = Math.max(2, Number(teamCount) || 2);
      const next = [...previous];
      while (next.length < count) {
        next.push(`Đội ${next.length + 1}`);
      }
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
    setSelectedIds(ids.map(String));
  }

  function handleClearAll() {
    setSelectedIds([]);
  }

  function handleQuickAddSaved(player) {
    if (!player?.id) {
      return;
    }

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
    const resolvedCompetitionClass =
      competitionClass ||
      teamData?.settings?.competitionClass ||
      COMPETITION_CLASS.INTERNAL;

    const prepared = await prepareLivePrivatePairingOptions({
      clubId,
      tournamentId: tournamentId || null,
      competitionClass: resolvedCompetitionClass,
      pairingConstraints: [],
    });

    if (!prepared.ok) {
      setPairingResult(null);
      onError?.(prepared.error?.message || "Không thể ghép đội theo quy tắc riêng.");
      return;
    }

    const pairing = runTeamFormationWithCanonicalAdapter({
      players: pickerPlayers,
      selectedPlayerIds: selectedIds,
      teamCount,
      teamNames,
      formatPreset: teamData?.settings?.formatPreset,
      privatePairingRules: prepared.pairingOptions?.privatePairingRules || [],
      competitionClass: resolvedCompetitionClass,
      clubId,
      tournamentId: tournamentId || null,
      seed: 1,
    });

    if (pairing.privatePairingError || pairing.ok === false) {
      setPairingResult(null);
      onError?.(
        pairing.privatePairingError?.message ||
          pairing.warnings?.[0] ||
          "Không thể ghép đội thỏa quy tắc bắt buộc."
      );
      return;
    }

    setPairingResult({
      teams: pairing.teams,
      waitingPlayerIds: pairing.waitingPlayerIds,
      warnings: pairing.warnings,
      privatePairingMeta: pairing.privatePairingMeta,
    });

    const initialCaptains = {};
    (pairing.teams || []).forEach((team) => {
      initialCaptains[team.id] = "";
    });
    setCaptains(initialCaptains);
  }

  function handleContinue() {
    if (!pairingResult?.teams?.length) {
      onError?.("Ghép đội trước khi tiếp tục.");
      return;
    }
    setActiveStep(1);
  }

  function handleCaptainChange(teamId, captainId) {
    setCaptains((previous) => ({
      ...previous,
      [teamId]: captainId,
    }));
  }

  function handleApply() {
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

    onApply?.(result.teamData, result);
    onClose?.();
  }

  const waitingPlayers = useMemo(() => {
    if (!pairingResult?.waitingPlayerIds?.length) {
      return [];
    }
    return pairingResult.waitingPlayerIds
      .map((id) => playerById.get(String(id)))
      .filter(Boolean);
  }, [pairingResult, playerById]);

  const allCaptainsSelected = useMemo(() => {
    if (!pairingResult?.teams?.length) {
      return false;
    }
    return pairingResult.teams.every(
      (team) => captains[team.id] && team.playerIds.includes(captains[team.id])
    );
  }, [pairingResult, captains]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>AI ghép đội</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Ghép 4 bước: xáo nam mạnh nhất → cân bằng nam thứ 2 → cân bằng từng nữ.
            Hạt giống = thứ hạng TB đội. Chia bảng làm riêng sau khi có đội.
          </Typography>

          <Stepper activeStep={activeStep} alternativeLabel>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {!isMlp ? (
            <Alert severity="warning">
              AI ghép đội chỉ áp dụng khi giải dùng preset MLP 4 người.
            </Alert>
          ) : null}

          {hasExistingTeams ? (
            <Alert severity="warning">
              Thao tác này sẽ thay thế toàn bộ đội hiện tại (bảng và lịch sẽ được làm mới).
            </Alert>
          ) : null}

          {activeStep === 0 ? (
            <Stack spacing={2}>
              <TournamentPlayerPickerPanel
                title="Chọn VĐV tham gia"
                players={pickerPlayers}
                selectedIds={selectedIds}
                onToggle={handleTogglePlayer}
                onSelectAll={handleSelectAll}
                onClearAll={handleClearAll}
                clubFilter={clubFilter}
                onClubFilterChange={setClubFilter}
                clubs={clubs}
                genderFilter={genderFilter}
                onGenderFilterChange={setGenderFilter}
                search={search}
                onSearchChange={setSearch}
                excludePlayerIds={assignedPlayerIds}
                onAddNew={clubId ? () => setQuickAddOpen(true) : undefined}
                maxHeight={280}
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Số đội"
                  type="number"
                  size="small"
                  value={teamCount}
                  onChange={(event) =>
                    setTeamCount(Math.max(2, Number(event.target.value) || 2))
                  }
                  inputProps={{ min: 2, max: 20 }}
                  sx={{ width: { xs: "100%", sm: 140 } }}
                />
                <TextField
                  label="Thành viên mỗi đội"
                  size="small"
                  value="4 VĐV (2 nam + 2 nữ)"
                  disabled
                  sx={{ flex: 1 }}
                />
              </Stack>

              <Stack spacing={1}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Tên các đội
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {teamNames.map((name, index) => (
                    <TextField
                      key={`team-name-${index}`}
                      label={`Đội ${index + 1}`}
                      size="small"
                      value={name}
                      onChange={(event) => {
                        const next = [...teamNames];
                        next[index] = event.target.value;
                        setTeamNames(next);
                      }}
                      sx={{ minWidth: 160, flex: "1 1 160px" }}
                    />
                  ))}
                </Stack>
              </Stack>

              <Button
                variant="contained"
                onClick={handlePairTeams}
                disabled={!isMlp || selectedIds.length < 4}
              >
                Ghép đội
              </Button>

              {pairingResult?.warnings?.map((warning) => (
                <Alert key={warning} severity="warning">
                  {warning}
                </Alert>
              ))}

              {pairingResult?.teams?.length ? (
                <Alert severity="success">
                  Đã ghép {pairingResult.teams.length} đội
                  {pairingResult.waitingPlayerIds.length
                    ? ` · ${pairingResult.waitingPlayerIds.length} VĐV chờ`
                    : ""}
                  . Bấm Tiếp tục để chọn đội trưởng.
                </Alert>
              ) : pairingResult && !pairingResult.teams.length ? (
                <Alert severity="error">Không ghép được đội với cấu hình hiện tại.</Alert>
              ) : null}
            </Stack>
          ) : (
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems="stretch"
            >
              <Box sx={{ flex: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  Đội đã ghép
                </Typography>
                <Stack spacing={1.5}>
                  {pairingResult?.teams?.map((team) => {
                    const roster = team.playerIds
                      .map((id) => playerById.get(String(id)))
                      .filter(Boolean);

                    return (
                      <Paper key={team.id} variant="outlined" sx={{ p: 2 }}>
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
                              label={`Hạt giống #${team.seed} · TB ${team.avgLevel?.toFixed(2) || "—"}`}
                              variant="outlined"
                            />
                          </Stack>

                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {roster.map((player) => (
                              <Chip
                                key={player.id}
                                size="small"
                                label={playerLabel(player)}
                                variant="outlined"
                              />
                            ))}
                          </Stack>

                          <FormControl fullWidth size="small">
                            <InputLabel id={`captain-${team.id}`}>Đội trưởng</InputLabel>
                            <Select
                              labelId={`captain-${team.id}`}
                              label="Đội trưởng"
                              value={captains[team.id] || ""}
                              onChange={(event) =>
                                handleCaptainChange(team.id, event.target.value)
                              }
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
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  VĐV chờ ({waitingPlayers.length})
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.5, minHeight: 120 }}>
                  {waitingPlayers.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
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
                      <Typography variant="caption" color="text.secondary">
                        Có thể thêm thủ công vào đội sau khi xác nhận.
                      </Typography>
                    </Stack>
                  )}
                </Paper>
              </Box>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        {activeStep === 1 ? (
          <Button onClick={() => setActiveStep(0)}>Ghép lại</Button>
        ) : null}
        {activeStep === 0 ? (
          <Button
            variant="contained"
            disabled={!isMlp || !pairingResult?.teams?.length}
            onClick={handleContinue}
          >
            Tiếp tục
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={!allCaptainsSelected}
            onClick={handleApply}
          >
            Xác nhận
          </Button>
        )}
      </DialogActions>

      <TournamentPlayerQuickAddDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        hostClubId={clubId}
        defaultClubName={defaultClubName}
        onSaved={handleQuickAddSaved}
      />
    </Dialog>
  );
}
