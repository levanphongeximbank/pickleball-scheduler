import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import {
  MessagingExperienceProvider,
} from "./MessagingExperienceProvider.jsx";
import { MessagingShell } from "./components/MessagingShell.jsx";
import { MESSAGING_EXPERIENCE_PHASE } from "./constants.js";

/**
 * Messaging Experience page — COMMS-06.
 * Uses injected/demo gateway only. No remote Supabase / SQL apply.
 */
export default function MessagingExperiencePage() {
  if (!MESSAGING_EXPERIENCE_PHASE.hasUi) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Messaging Experience chưa được bật (fail-closed).
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
      <MessagingExperienceProvider>
        <MessagingShell />
      </MessagingExperienceProvider>
    </Box>
  );
}
