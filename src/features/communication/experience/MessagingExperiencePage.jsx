import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import {
  MessagingExperienceProvider,
} from "./MessagingExperienceProvider.jsx";
import { MessagingShell } from "./components/MessagingShell.jsx";
import { MESSAGING_EXPERIENCE_PHASE } from "./constants.js";
import { createDemoMessagingExperienceGateway } from "./createDemoMessagingExperienceGateway.js";
import { useCommunicationRuntimeOptional } from "../runtime/useCommunicationRuntime.js";
import {
  COMMUNICATION_RUNTIME_MODE,
  COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE,
} from "../runtime/constants.js";
import { createUnavailableMessagingExperienceGateway } from "../runtime/createUnavailableMessagingExperienceGateway.js";

/**
 * Messaging Experience page — COMMS-06 UI + COMMS-07 runtime boundary.
 *
 * - DEMO (dev/test/preview): demo gateway
 * - PRODUCTION (certified deps): production gateway from runtime
 * - UNAVAILABLE: fail-closed, no demo data
 *
 * Optional `gateway` prop supports isolated UI tests without full runtime tree.
 *
 * @param {{ gateway?: object }} [props]
 */
export default function MessagingExperiencePage({ gateway: injectedGateway } = {}) {
  const runtime = useCommunicationRuntimeOptional();

  if (!MESSAGING_EXPERIENCE_PHASE.hasUi) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Messaging Experience chưa được bật (fail-closed).
        </Alert>
      </Box>
    );
  }

  // Isolated UI tests / Story injection — explicit gateway wins.
  if (injectedGateway) {
    return (
      <Box sx={{ p: { xs: 1.5, md: 2 } }} data-testid="messaging-experience-page">
        <MessagingExperienceProvider gateway={injectedGateway} allowDemoFallback={false}>
          <MessagingShell />
        </MessagingExperienceProvider>
      </Box>
    );
  }

  if (runtime) {
    if (!runtime.status?.initialized && !runtime.gateway) {
      return (
        <Box
          sx={{ p: 3, display: "flex", alignItems: "center", gap: 2 }}
          data-testid="messaging-experience-booting"
          role="status"
          aria-live="polite"
        >
          <CircularProgress size={24} />
          <Typography>Đang khởi tạo tin nhắn…</Typography>
        </Box>
      );
    }

    if (
      runtime.mode === COMMUNICATION_RUNTIME_MODE.UNAVAILABLE ||
      runtime.unavailable
    ) {
      return (
        <Box sx={{ p: 3 }} data-testid="messaging-experience-unavailable">
          <Alert severity="warning">
            {COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE}
          </Alert>
        </Box>
      );
    }

    if (!runtime.gateway) {
      return (
        <Box sx={{ p: 3 }} data-testid="messaging-experience-unavailable">
          <Alert severity="warning">
            {COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE}
          </Alert>
        </Box>
      );
    }

    return (
      <Box sx={{ p: { xs: 1.5, md: 2 } }} data-testid="messaging-experience-page">
        {runtime.isDemo ? (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            Đang dùng demo/in-memory gateway. Persistence &amp; realtime remote
            (COMMS-05) chưa kích hoạt — không phải dữ liệu production.
          </Alert>
        ) : null}
        <MessagingExperienceProvider
          gateway={runtime.gateway}
          allowDemoFallback={false}
        >
          <MessagingShell />
        </MessagingExperienceProvider>
      </Box>
    );
  }

  // No runtime provider in tree (legacy / vitest without MainLayout):
  // Prefer explicit demo only on non-production surfaces via factory default.
  // Production builds must not invent demo data here — use unavailable gateway.
  const isProdBuild =
    typeof import.meta !== "undefined" && import.meta.env?.PROD === true;
  const fallbackGateway = isProdBuild
    ? createUnavailableMessagingExperienceGateway({
        reason: "NO_RUNTIME_PROVIDER_IN_PRODUCTION",
      })
    : createDemoMessagingExperienceGateway();

  if (isProdBuild) {
    return (
      <Box sx={{ p: 3 }} data-testid="messaging-experience-unavailable">
        <Alert severity="warning">
          {COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }} data-testid="messaging-experience-page">
      <Alert severity="info" sx={{ mb: 1.5 }}>
        Đang dùng demo/in-memory gateway. Persistence &amp; realtime remote
        (COMMS-05) chưa kích hoạt — không phải dữ liệu production.
      </Alert>
      <MessagingExperienceProvider
        gateway={fallbackGateway}
        allowDemoFallback={false}
      >
        <MessagingShell />
      </MessagingExperienceProvider>
    </Box>
  );
}
