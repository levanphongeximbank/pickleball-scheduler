/**
 * AppSnackbar — authenticated transient feedback (Wave 2 Batch 2D).
 *
 * Adapted from InterventionFeedbackSnackbar.
 * Not the notification inbox / CanonicalNotificationButton system.
 *
 * @ownership AUTHENTICATED_SHARED
 */

import { Alert, Snackbar } from "@mui/material";

const TONES = Object.freeze(["info", "success", "warning", "error"]);

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.message — visible text required (not color-only)
 * @param {'info'|'success'|'warning'|'error'} [props.tone]
 * @param {() => void} [props.onClose]
 * @param {number} [props.autoHideDuration]
 */
export default function AppSnackbar({
  open,
  message,
  tone = "info",
  onClose,
  autoHideDuration = 4000,
  anchorOrigin = { vertical: "bottom", horizontal: "center" },
}) {
  const severity = TONES.includes(tone) ? tone : "info";
  const live = severity === "error" ? "assertive" : "polite";

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
      data-testid="app-snackbar"
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant="filled"
        role="status"
        aria-live={live}
        sx={{ width: "100%" }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}

export { TONES as APP_SNACKBAR_TONES };
