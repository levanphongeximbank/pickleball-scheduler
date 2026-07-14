/**
 * S2-B — BTC UI: pick an existing team from other tournaments and clone into target.
 */

import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Autocomplete,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import {
  cloneExistingTeamIntoTournament,
  listExistingTeamsForClub,
} from "../../features/team-tournament/services/teamTournamentService.js";
import { canSelectExistingTeam } from "../../features/team-tournament/engines/teamPermissionEngine.js";

export default function ExistingTeamClonePanel({
  clubId,
  targetTournamentId,
  permissions = [],
  onUpdated,
  onError,
  onMessage,
  dense = false,
}) {
  const [entries, setEntries] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [nameOverride, setNameOverride] = useState("");
  const [busy, setBusy] = useState(false);

  const canSelect = canSelectExistingTeam({ permissions });

  const refresh = () => {
    if (!clubId) {
      setEntries([]);
      return;
    }
    const result = listExistingTeamsForClub(clubId, {
      excludeTournamentId: targetTournamentId,
    });
    if (!result.ok) {
      setLoadError(result.error || "Không tải được danh sách đội có sẵn.");
      setEntries([]);
      return;
    }
    setLoadError(null);
    setEntries(result.entries || []);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, targetTournamentId]);

  const options = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        label: `${entry.name} · ${entry.playerCount} VĐV · ${entry.sourceTournamentName}`,
      })),
    [entries]
  );

  async function handleClone() {
    if (!selected || !targetTournamentId) {
      onError?.("Chọn đội cần sao chép và đảm bảo đã mở giải đích.");
      return;
    }
    setBusy(true);
    try {
      const result = await cloneExistingTeamIntoTournament(clubId, targetTournamentId, {
        sourceTournamentId: selected.sourceTournamentId,
        sourceTeamId: selected.sourceTeamId,
        name: nameOverride.trim() || undefined,
      });
      if (!result.ok) {
        onError?.(result.error || "Không sao chép được đội.");
        return;
      }
      const warningText =
        (result.warnings || []).length > 0 ? ` ${result.warnings.join(" ")}` : "";
      onMessage?.(
        `Đã sao chép đội “${result.team?.name || selected.name}” vào giải.${warningText}`
      );
      setSelected(null);
      setNameOverride("");
      refresh();
      onUpdated?.();
    } finally {
      setBusy(false);
    }
  }

  if (!canSelect) {
    return (
      <Alert severity="info">
        Bạn không có quyền chọn / sao chép đội có sẵn (`existing_team.select`).
      </Alert>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: dense ? 1.5 : 2 }}>
      <Stack spacing={1.5}>
        <Typography fontWeight={700}>Sao chép đội có sẵn</Typography>
        <Typography variant="body2" color="text.secondary">
          Chọn đội từ giải đồng đội khác trong CLB. Hệ thống tạo đội mới trong giải này (giữ
          roster + đội trưởng).
        </Typography>
        {loadError ? <Alert severity="warning">{loadError}</Alert> : null}
        {options.length === 0 ? (
          <Alert severity="info">
            Chưa có đội nguồn (cần ít nhất một giải đồng đội khác đã có đội với VĐV).
          </Alert>
        ) : (
          <>
            <Autocomplete
              options={options}
              value={selected}
              onChange={(_e, value) => {
                setSelected(value);
                setNameOverride(value?.name || "");
              }}
              getOptionLabel={(option) => option.label || option.name || ""}
              isOptionEqualToValue={(a, b) => a.key === b.key}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Đội nguồn"
                  size="small"
                  inputProps={{ ...params.inputProps, "aria-label": "Chọn đội có sẵn" }}
                />
              )}
            />
            <TextField
              label="Tên đội trong giải này (tuỳ chọn)"
              size="small"
              value={nameOverride}
              onChange={(e) => setNameOverride(e.target.value)}
              fullWidth
            />
            <Button
              variant="contained"
              startIcon={<ContentCopyIcon />}
              onClick={() => void handleClone()}
              disabled={busy || !selected || !targetTournamentId}
              sx={{ minHeight: { xs: 44, md: 36 }, alignSelf: "flex-start" }}
            >
              Sao chép vào giải
            </Button>
          </>
        )}
      </Stack>
    </Paper>
  );
}
