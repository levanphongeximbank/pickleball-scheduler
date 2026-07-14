/**
 * S2-C — Pre-lock / pre-publish roster substitution (BTC or captain).
 */

import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Autocomplete,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

import {
  getTeamSubstitutionGate,
  getTeamSubstitutionLog,
  substituteTeamPlayer,
} from "../../features/team-tournament/services/teamTournamentService.js";
import {
  canApproveSubstitution,
  canRequestSubstitution,
} from "../../features/team-tournament/engines/teamPermissionEngine.js";

function playerLabel(player) {
  if (!player) return "";
  const gender = player.gender ? ` · ${player.gender}` : "";
  return `${player.name || player.id}${gender}`;
}

export default function TeamSubstitutionPanel({
  clubId,
  tournamentId,
  team = null,
  teamData = null,
  teams = [],
  players = [],
  permissions = [],
  mode = "btc",
  onUpdated,
  onError,
  onMessage,
  dense = false,
}) {
  const [selectedTeamId, setSelectedTeamId] = useState(team?.id || "");
  const [outPlayer, setOutPlayer] = useState(null);
  const [inPlayer, setInPlayer] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (team?.id) {
      setSelectedTeamId(team.id);
    }
  }, [team?.id]);

  const effectiveTeamId = team?.id || selectedTeamId;
  const effectiveTeam =
    team ||
    (teamData?.teams || teams || []).find((row) => String(row.id) === String(effectiveTeamId)) ||
    null;

  const canAct =
    mode === "btc"
      ? canApproveSubstitution({ permissions })
      : canRequestSubstitution({ permissions });

  const gate = useMemo(() => {
    if (!clubId || !tournamentId || !effectiveTeamId) {
      return { ok: false, allowed: false, error: "Chọn đội để thay người." };
    }
    return getTeamSubstitutionGate(clubId, tournamentId, effectiveTeamId);
  }, [clubId, tournamentId, effectiveTeamId, teamData]);

  const log = useMemo(() => {
    if (!clubId || !tournamentId) return [];
    return getTeamSubstitutionLog(clubId, tournamentId, effectiveTeamId).slice(-8).reverse();
  }, [clubId, tournamentId, effectiveTeamId, teamData]);

  const playerById = useMemo(() => {
    const map = new Map();
    (players || []).forEach((player) => map.set(String(player.id), player));
    return map;
  }, [players]);

  const rosterOptions = useMemo(() => {
    if (!effectiveTeam) return [];
    return (effectiveTeam.playerIds || [])
      .map((id) => playerById.get(String(id)) || { id, name: id })
      .map((player) => ({ ...player, label: playerLabel(player) }));
  }, [effectiveTeam, playerById]);

  const inOptions = useMemo(() => {
    const onTeam = new Set((effectiveTeam?.playerIds || []).map(String));
    return (players || [])
      .filter((player) => !onTeam.has(String(player.id)))
      .map((player) => ({ ...player, label: playerLabel(player) }));
  }, [players, effectiveTeam]);

  async function handleSubstitute() {
    if (!effectiveTeamId || !outPlayer || !inPlayer) {
      onError?.("Chọn VĐV ra, VĐV vào và đội.");
      return;
    }
    setBusy(true);
    try {
      const result = await substituteTeamPlayer(clubId, tournamentId, {
        teamId: effectiveTeamId,
        outPlayerId: outPlayer.id,
        inPlayerId: inPlayer.id,
        reason,
      });
      if (!result.ok) {
        onError?.(result.error || "Không thay người được.");
        return;
      }
      const warningText =
        (result.warnings || []).length > 0 ? ` ${result.warnings.join(" ")}` : "";
      onMessage?.(`Đã thay người trên đội “${effectiveTeam?.name || effectiveTeamId}”.${warningText}`);
      setOutPlayer(null);
      setInPlayer(null);
      setReason("");
      onUpdated?.();
    } finally {
      setBusy(false);
    }
  }

  if (!canAct) {
    return (
      <Alert severity="info">
        Bạn không có quyền thay người (
        {mode === "btc" ? "team_substitution.approve" : "team_substitution.request"}).
      </Alert>
    );
  }

  const showTeamSelect = mode === "btc" && !team;

  return (
    <Paper variant="outlined" sx={{ p: dense ? 1.5 : 2 }}>
      <Stack spacing={1.5}>
        <Typography fontWeight={700}>Thay người (trước khóa / công bố)</Typography>
        <Typography variant="body2" color="text.secondary">
          Đổi VĐV trên roster khi đội hình còn chỉnh được. Sau khi khóa hoặc công bố, dùng override
          BTC (TT-3).
        </Typography>

        {showTeamSelect ? (
          <FormControl fullWidth size="small">
            <InputLabel id="s2c-team-select">Đội</InputLabel>
            <Select
              labelId="s2c-team-select"
              label="Đội"
              value={selectedTeamId}
              onChange={(e) => {
                setSelectedTeamId(e.target.value);
                setOutPlayer(null);
              }}
              inputProps={{ "aria-label": "Chọn đội để thay người" }}
            >
              <MenuItem value="">
                <em>— Chọn đội —</em>
              </MenuItem>
              {(teamData?.teams || teams || []).map((row) => (
                <MenuItem key={row.id} value={row.id}>
                  {row.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        {!gate.allowed ? (
          <Alert severity="warning">{gate.error || "Không thể thay người lúc này."}</Alert>
        ) : (
          <>
            <Autocomplete
              options={rosterOptions}
              value={outPlayer}
              onChange={(_e, value) => setOutPlayer(value)}
              getOptionLabel={(option) => option.label || option.name || ""}
              isOptionEqualToValue={(a, b) => String(a.id) === String(b.id)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="VĐV ra"
                  size="small"
                  inputProps={{ ...params.inputProps, "aria-label": "Chọn VĐV ra" }}
                />
              )}
            />
            <Autocomplete
              options={inOptions}
              value={inPlayer}
              onChange={(_e, value) => setInPlayer(value)}
              getOptionLabel={(option) => option.label || option.name || ""}
              isOptionEqualToValue={(a, b) => String(a.id) === String(b.id)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="VĐV vào"
                  size="small"
                  inputProps={{ ...params.inputProps, "aria-label": "Chọn VĐV vào" }}
                />
              )}
            />
            <TextField
              label="Lý do (tuỳ chọn)"
              size="small"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
            />
            <Button
              variant="contained"
              startIcon={<SwapHorizIcon />}
              onClick={() => void handleSubstitute()}
              disabled={busy || !gate.allowed || !outPlayer || !inPlayer || !effectiveTeamId}
              sx={{ minHeight: { xs: 44, md: 36 }, alignSelf: "flex-start" }}
            >
              Xác nhận thay người
            </Button>
          </>
        )}

        {log.length > 0 ? (
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Lịch sử gần đây</Typography>
            {log.map((entry) => (
              <Typography key={entry.id} variant="caption" color="text.secondary">
                {entry.outPlayerId} → {entry.inPlayerId}
                {entry.reason ? ` · ${entry.reason}` : ""}
                {entry.captainChanged ? " · (đổi đội trưởng)" : ""}
              </Typography>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
