/**
 * S2-E — BTC configure tie-break order (frozen after knockout).
 */

import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import LockIcon from "@mui/icons-material/Lock";

import {
  DEFAULT_TIE_BREAK_ORDER,
} from "../../../features/team-tournament/constants.js";
import {
  isTiebreakFrozen,
  TIEBREAK_KEYS,
} from "../../../features/team-tournament/engines/teamStandingsEngine.js";
import {
  freezeTeamTiebreakOrder,
  updateTeamTiebreakOrder,
} from "../../../features/team-tournament/services/teamTournamentService.js";
import { TIEBREAK_LABELS } from "./teamStandingsLabels.js";

export default function TeamTiebreakConfigPanel({
  clubId,
  tournamentId,
  teamData,
  canManage = false,
  onUpdated,
  onError,
  onMessage,
}) {
  const frozen = isTiebreakFrozen(teamData);
  const initial = useMemo(() => {
    const order = teamData?.settings?.tiebreakOrder || DEFAULT_TIE_BREAK_ORDER;
    return order.filter((key) => TIEBREAK_KEYS.includes(key));
  }, [teamData]);

  const [order, setOrder] = useState(initial);

  useEffect(() => {
    setOrder(initial);
  }, [initial]);

  if (!canManage) {
    return null;
  }

  function move(index, delta) {
    if (frozen) return;
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    setOrder(next);
  }

  function handleSave() {
    const result = updateTeamTiebreakOrder(clubId, tournamentId, order);
    if (!result.ok) {
      onError?.(result.error || "Không lưu được thứ tự tie-break.");
      return;
    }
    onMessage?.("Đã lưu thứ tự tie-break.");
    onUpdated?.();
  }

  function handleFreeze() {
    const result = freezeTeamTiebreakOrder(clubId, tournamentId, {
      reason: "manual",
    });
    if (!result.ok) {
      onError?.(result.error || "Không khóa được tie-break.");
      return;
    }
    onMessage?.("Đã khóa thứ tự tie-break.");
    onUpdated?.();
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography fontWeight={700}>Thứ tự xử hòa (tie-break)</Typography>
          {frozen ? (
            <Chip size="small" color="warning" icon={<LockIcon />} label="Đã khóa" />
          ) : null}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Áp dụng khi nhiều đội bằng thắng / hiệu số. Từ 3 đội trở lên dùng mini-table (kết quả
          nội bộ giữa các đội hòa). Khóa tự động khi tạo knockout.
        </Typography>
        {frozen ? (
          <Alert severity="info">
            Tie-break đã khóa
            {teamData?.settings?.tiebreakFrozenReason
              ? ` (${teamData.settings.tiebreakFrozenReason})`
              : ""}
            . Không thể đổi sau khi tạo nhánh knockout.
          </Alert>
        ) : null}
        <Stack spacing={0.5}>
          {order.map((key, index) => (
            <Stack
              key={key}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                px: 1,
                py: 0.5,
              }}
            >
              <Typography sx={{ width: 28 }} color="text.secondary">
                {index + 1}.
              </Typography>
              <Typography sx={{ flex: 1 }}>{TIEBREAK_LABELS[key] || key}</Typography>
              <Button
                size="small"
                disabled={frozen || index === 0}
                onClick={() => move(index, -1)}
                aria-label={`Đưa ${key} lên`}
                sx={{ minWidth: 40, minHeight: 40 }}
              >
                <ArrowUpwardIcon fontSize="small" />
              </Button>
              <Button
                size="small"
                disabled={frozen || index === order.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`Đưa ${key} xuống`}
                sx={{ minWidth: 40, minHeight: 40 }}
              >
                <ArrowDownwardIcon fontSize="small" />
              </Button>
            </Stack>
          ))}
        </Stack>
        {!frozen ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              onClick={handleSave}
              sx={{ minHeight: { xs: 44, md: 36 } }}
            >
              Lưu thứ tự
            </Button>
            <Button
              variant="outlined"
              startIcon={<LockIcon />}
              onClick={handleFreeze}
              sx={{ minHeight: { xs: 44, md: 36 } }}
            >
              Khóa ngay
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
