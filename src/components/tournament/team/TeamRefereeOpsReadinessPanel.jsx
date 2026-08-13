/**
 * S2-F — BTC-facing TT-5 ops readiness summary (no Production SQL apply).
 * Soft cleanup: Staging-first; Production chip is informational only (untouched).
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
  if (verdict === "PRODUCTION_NOT_APPLIED") return "default";
  if (verdict === "FLAGS_MISMATCH") return "info";
  return "warning";
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
    const evidence = buildStagingInventoryFromTt5Final({
      refereeEnabled: flags.VITE_REFEREE_V5_ENABLED || "true",
      dataMode: flags.VITE_REFEREE_V5_DATA_MODE || "remote",
      realtime: flags.VITE_REFEREE_V5_REALTIME_ENABLED || "false",
    });
    // Only override evidence defaults when env keys are explicitly set.
    // Spreading unset `undefined` was falsely yielding Staging: MISSING_OBJECTS.
    const explicitFlags = Object.fromEntries(
      Object.entries(flags).filter(([, value]) => value != null && String(value).trim() !== "")
    );
    return evaluateTt5OpsReadiness({
      ...evidence,
      flags: {
        ...evidence.flags,
        ...explicitFlags,
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

  // After referee lifecycle is live, TT-5 inventory chip is operational noise —
  // collapse to a compact note. Keep Production informational chip untouched.
  const refereeLifecycleActive = liveOps.linked > 0 || liveOps.finalized > 0;
  if (refereeLifecycleActive && staging.verdict !== "MISSING_OBJECTS") {
    return (
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle2" fontWeight={700}>
            Trọng tài đang vận hành
          </Typography>
          <Chip size="small" color="success" label={`linked ${liveOps.linked}`} />
          <Chip size="small" color="default" label={`finalized ${liveOps.finalized}`} />
          <Chip
            size="small"
            variant="outlined"
            color="default"
            label="Production: untouched (Owner GO)"
          />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          Checklist TT-5 / S2-F đã ẩn vì vòng đời trọng tài đang hoạt động (không còn báo MISSING_OBJECTS giả).
        </Typography>
      </Paper>
    );
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
            color={verdictTone(focus.verdict === "PRODUCTION_NOT_APPLIED" ? staging.verdict : focus.verdict)}
            label={`Staging: ${staging.verdict}`}
          />
          <Chip
            size="small"
            variant="outlined"
            color="default"
            label="Production: untouched (Owner GO)"
          />
        </Stack>

        <Alert severity="info" sx={{ mb: 2 }}>
          Batch này kiểm tra ops Staging — <strong>không</strong> apply SQL Production.
          Chip Production cố ý không báo lỗi vì Production chưa được Owner GO.
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
              severity={gap.disposition.startsWith("CLOSED") ? "success" : "info"}
            >
              <strong>{gap.id}</strong> — {gap.disposition}: {gap.detail}
            </Alert>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
