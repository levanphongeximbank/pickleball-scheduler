/**
 * AuthConfirmDialog — authenticated confirmation pattern (Wave 2 Batch 2D).
 *
 * Adapted from ClubConfirmDialog. No domain/business logic.
 * Destructive confirms use error semantics — never primary blue.
 *
 * @ownership AUTHENTICATED_SHARED
 */

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

/**
 * @param {'primary'|'destructive'|'success'} confirmTone
 */
function toneToColor(confirmTone) {
  if (confirmTone === "destructive") return "error";
  if (confirmTone === "success") return "success";
  return "primary";
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.title
 * @param {import('react').ReactNode} [props.message]
 * @param {string} [props.confirmLabel]
 * @param {string} [props.cancelLabel]
 * @param {'primary'|'destructive'|'success'} [props.confirmTone]
 * @param {boolean} [props.loading]
 * @param {boolean} [props.disabled]
 * @param {() => void} [props.onConfirm]
 * @param {() => void} [props.onCancel]
 */
export default function AuthConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Xac nhan",
  cancelLabel = "Huy",
  confirmTone = "primary",
  loading = false,
  disabled = false,
  onConfirm,
  onCancel,
}) {
  const color = toneToColor(confirmTone);
  const busy = Boolean(loading);
  const confirmDisabled = busy || disabled;

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
      aria-labelledby="auth-confirm-dialog-title"
      aria-describedby={message ? "auth-confirm-dialog-desc" : undefined}
      data-testid="auth-confirm-dialog"
    >
      <DialogTitle id="auth-confirm-dialog-title">{title}</DialogTitle>
      {message ? (
        <DialogContent>
          <DialogContentText id="auth-confirm-dialog-desc">{message}</DialogContentText>
        </DialogContent>
      ) : null}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={color}
          onClick={onConfirm}
          disabled={confirmDisabled}
          autoFocus
          {...(busy ? { loading: true } : {})}
        >
          {busy ? "Dang xu ly…" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
