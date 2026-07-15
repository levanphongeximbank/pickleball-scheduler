/**
 * S2-F — BTC-facing TT-5 ops readiness summary (no Production SQL apply).
 */

import { useMemo } from "react";

import {
  Alert,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import {
  buildClientFlagInventoryFromEnv,
  buildProductionUntouchedInventory,
  buildStagingInventoryFromTt5Final,
  evaluateTt5OpsReadiness,
  getS2FSoftGapDisposition,
  summarizeMatchupRefereeOps,
} from "../../../features/team-tournament/engines/teamRefereeOpsReadinessEngine.js";

function verdictTone(verdict) {
  if (verdict === "READY") return "success";
  if (verdict === "READY_SQL_PENDING_E2E") return "info";
  if (verdict === "PRODUCTION_NOT_APPLIED") return "warning";
  return "error";
}

export default function TeamRefereeOpsReadinessPanel({
  teamData,
  canManage = false,
  environmentHint = "staging",
}) {
  const liveOps = useMemo(() => summarizeMatchupRefereeOps(teamData), [teamData]);

  const staging = useMemo(() => {
    const flags =
      typeof import.meta !== "undefined" && import.meta.env
        ? buildClientFlagInventoryFromEnv(import.meta.env)
        : {};
    return evaluateTt5OpsReadiness({
      ...buildStagingInventoryFromTt5Final({
        refereeEnabled: flags.VITE_REFEREE_V5_ENABLED || "true",
        dataMode: flags.VITE_REFEREE_V5_DATA_MODE || "remote",
        realtime: flags.VITE_REFEREE_V5_REALTIME_ENABLED || "false",
      }),
      flags: {
        ...buildStagingInventoryFromTt5Final().flags,
        ...flags,
      },
    });
  }, []);

  const production = useMemo(
    () => evaluateTt5OpsReadiness(buildProductionUntouchedInventory()),
    []
  );

  const softGaps = useMemo(() => getS2FSoftGapDisposition(), []);

  if (!canManage) {
    return null;
  }

  const focus = environmentHint === "production" ? production : staging;

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle1" fontWeight={700}>
            Sẵn sàng trọng tài (TT-5 / S2-F)
          </Typography>
          <Chip
            size="small"
            color={verdictTone(focus.verdict)}
            label={`Staging: ${staging.verdict}`}
          />
          <Chip
            size="small"
            color={verdictTone(production.verdict)}
            label={`Production: ${production.verdict}`}
          />
        </Stack>

        <Alert severity="info" sx={{ mb: 2 }}>
          Batch S2-F chỉ kiểm tra sẵn sàng ops — <strong>không</strong> apply SQL Production.
          Production cần Owner GO riêng.
        </Alert>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Trận hiện tại: linked {liveOps.linked} · có thể provision {liveOps.provisionable} ·
          sync lỗi {liveOps.syncError} · finalized {liveOps.finalized}
        </Typography>

        <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>
          Checklist staging (từ TT-5 evidence)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Loại</TableCell>
              <TableCell>Tên</TableCell>
              <TableCell>OK</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...staging.checks.tables, ...staging.checks.rpcs].slice(0, 8).map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.kind}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.ok ? "✓" : "✗"}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3}>
                <Typography variant="caption" color="text.secondary">
                  + còn {Math.max(0, staging.checks.tables.length + staging.checks.rpcs.length - 8)} mục…
                  sqlApplied={String(staging.sqlApplied)} · e2ePassed={String(staging.e2ePassed)}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Soft gaps (đóng / hoãn trong S2-F)
        </Typography>
        <Stack spacing={1}>
          {softGaps.map((gap) => (
            <Alert
              key={gap.id}
              severity={gap.disposition.startsWith("CLOSED") ? "success" : "warning"}
            >
              <strong>{gap.id}</strong> — {gap.disposition}: {gap.detail}
            </Alert>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
