/**
 * S2-G — BTC-facing realtime enable gates (flag matrix / reconnect / captain isolation).
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

import { buildRealtimeEnableGatesReport } from "../../../features/team-tournament/engines/teamRealtimeEnableGatesEngine.js";
import { readTeamTournamentRealtimeEnv } from "../../../features/team-tournament/realtime/realtimeFlags.js";
import { isTeamTournamentRealtimeEnabled } from "../../../features/team-tournament/realtime/realtimeFlags.js";

function verdictColor(verdict) {
  if (String(verdict).includes("READY_ON") || verdict === "COMPLIANT_ON") return "success";
  if (String(verdict).includes("READY") || String(verdict).includes("GATED")) return "info";
  if (String(verdict).includes("BLOCKED")) return "error";
  return "warning";
}

export default function TeamRealtimeEnableGatesPanel({ canManage = false }) {
  const report = useMemo(
    () =>
      buildRealtimeEnableGatesReport({
        env: readTeamTournamentRealtimeEnv(),
        assumeCaptainEvidencePass: true,
        captainSecurityVerdict: "PASS",
      }),
    []
  );

  if (!canManage) {
    return null;
  }

  const liveOn = isTeamTournamentRealtimeEnabled();

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle1" fontWeight={700}>
            Cổng realtime (TT-6 / S2-G)
          </Typography>
          <Chip size="small" color={verdictColor(report.verdict)} label={report.verdict} />
          <Chip
            size="small"
            color={liveOn ? "success" : "default"}
            label={liveOn ? "Flag ON" : "Flag OFF"}
          />
          <Chip size="small" label={`Stage: ${report.flagMatrix.stage}`} />
        </Stack>

        <Alert severity="info" sx={{ mb: 2 }}>
          Staging / Preview có thể bật <code>VITE_TT_REALTIME_ENABLED=true</code>. Production{" "}
          <strong>giữ OFF</strong> — cần Owner GO riêng. Khi mất kết nối → poll fallback.
        </Alert>

        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Reconnect / poll
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {report.reconnectPoll.ok
            ? `PASS — critical ${report.reconnectPoll.intervals.CRITICAL_MS}ms · tournament ${report.reconnectPoll.intervals.TOURNAMENT_MS}ms · hidden ${report.reconnectPoll.intervals.HIDDEN_MS}ms`
            : `FAIL — ${report.reconnectPoll.failed.join(", ")}`}
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Cô lập đội trưởng (publication)
        </Typography>
        <Alert
          severity={report.captainIsolation.ok ? "success" : "warning"}
          sx={{ mb: 1 }}
        >
          {report.captainIsolation.ok
            ? "PASS — lineup không đi WAL; get_visible_lineups vẫn SSOT."
            : "Chưa xác nhận isolation."}
        </Alert>

        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Multi-device smoke (TT-6D evidence)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Vai trò</TableCell>
              <TableCell>Focus</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {report.multiDeviceSmokeRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                <TableCell>{row.role}</TableCell>
                <TableCell>{row.focus}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
