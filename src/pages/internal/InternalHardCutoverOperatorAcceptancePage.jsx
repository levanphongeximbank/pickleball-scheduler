import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { useCommunicationRuntimeOptional } from "../../features/communication/runtime/useCommunicationRuntime.js";
import {
  runOperatorAcceptanceSequence,
} from "../../features/platform-hard-cutover/operatorAcceptanceRunner.js";
import {
  buildOperatorAcceptanceEvidence,
  OPERATOR_ACCEPTANCE_ROUTE,
  resolveOperatorAcceptanceAccess,
} from "../../features/platform-hard-cutover/operatorAcceptanceShared.js";
import { scrubRestrictedCapabilityEvidence } from "../../features/platform-hard-cutover/operatorAcceptanceSecurityBoundary.js";

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function statusColor(status) {
  if (status === "PASS") return "success";
  if (status === "FAIL") return "error";
  return "default";
}

export default function InternalHardCutoverOperatorAcceptancePage() {
  const { user, authLoading } = useAuth();
  const { currentTenantId, isSuperAdmin } = useTenant();
  const commsRuntime = useCommunicationRuntimeOptional();
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [startedAt, setStartedAt] = useState(null);
  const [finishedAt, setFinishedAt] = useState(null);

  const access = useMemo(
    () =>
      resolveOperatorAcceptanceAccess({
        env: import.meta.env,
        authUser: user,
        sessionUserId: user?.id || null,
        currentTenantId,
        isSuperAdmin,
      }),
    [currentTenantId, isSuperAdmin, user]
  );

  const handleRun = async () => {
    setRunning(true);
    const started = new Date().toISOString();
    setStartedAt(started);
    setFinishedAt(null);
    try {
      const result = await runOperatorAcceptanceSequence({
        authUser: user,
        currentTenantId,
        isSuperAdmin,
        communicationRuntimeStatus: commsRuntime?.status || null,
      });
      setSteps(result.steps || []);
      setFinishedAt(new Date().toISOString());
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    const evidence = buildOperatorAcceptanceEvidence({
      access,
      steps,
      startedAt,
      finishedAt: finishedAt || new Date().toISOString(),
    });
    downloadJson(
      `operator-acceptance-${Date.now()}.json`,
      evidence
    );
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Operator Acceptance Runner
          </Typography>
          <Typography color="text.secondary">
            Route nội bộ: {OPERATOR_ACCEPTANCE_ROUTE}
          </Typography>
        </Box>

        <Alert severity={access.ok ? "success" : "warning"}>
          {access.ok
            ? "Runner chỉ dùng browser session hiện tại của Owner/SUPER_ADMIN trên Staging."
            : `Route đang fail-closed: ${access.code}`}
        </Alert>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.25}>
            <Typography variant="h6">Pre-run checks</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <Chip
                label={`project_ref: ${access.target?.projectRef || "unknown"}`}
                color={access.target?.isExpectedStagingRef ? "success" : "warning"}
                variant="outlined"
              />
              <Chip
                label={`env: ${access.target?.appEnv || "unknown"}`}
                color={access.target?.isStagingEnv ? "success" : "warning"}
                variant="outlined"
              />
              <Chip
                label={`user: ${access.maskedActorId || "unknown"}`}
                variant="outlined"
              />
              <Chip
                label={`tenant: ${access.tenantId || "missing"}`}
                color={access.tenantId ? "info" : "warning"}
                variant="outlined"
              />
              <Chip
                label={`role: ${access.role || String(user?.role || "unknown").toUpperCase()}`}
                color={access.ok ? "success" : "warning"}
                variant="outlined"
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Không hiển thị token/JWT/password/secret. Production bị chặn cứng bằng
              `project_ref` và `VITE_APP_ENV`.
            </Typography>
          </Stack>
        </Paper>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button
            variant="contained"
            onClick={handleRun}
            disabled={!access.ok || running || authLoading}
          >
            RUN OPERATOR ACCEPTANCE
          </Button>
          <Button
            variant="outlined"
            onClick={handleExport}
            disabled={steps.length === 0}
          >
            Export Evidence
          </Button>
        </Stack>

        {authLoading || running ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={22} />
            <Typography color="text.secondary">
              {authLoading ? "Đang xác minh phiên đăng nhập..." : "Đang chạy acceptance..."}
            </Typography>
          </Stack>
        ) : null}

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Step</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Error code</TableCell>
                <TableCell>Object ID</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {steps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    Chưa chạy.
                  </TableCell>
                </TableRow>
              ) : (
                steps.map((step) => (
                  <TableRow key={step.id} hover>
                    <TableCell>{step.id}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={step.status}
                        color={statusColor(step.status)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{step.code || "—"}</TableCell>
                    <TableCell>{step.objectId || "—"}</TableCell>
                    <TableCell>{step.message || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {steps.length > 0 ? (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              Acceptance details
            </Typography>
            <Stack spacing={1}>
              {steps.map((step) => {
                const details = !isSuperAdmin
                  ? scrubRestrictedCapabilityEvidence(step.details || {})
                  : step.details || {};
                return (
                  <Box key={`${step.id}-detail`}>
                    <Typography variant="body2" fontWeight={600}>
                      {step.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {JSON.stringify(details, null, 2)}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        ) : null}
      </Stack>
    </Box>
  );
}
