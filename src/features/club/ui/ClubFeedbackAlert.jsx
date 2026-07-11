import { Alert } from "@mui/material";

/** Inline feedback banner with aria-live for club module actions. */
export default function ClubFeedbackAlert({ message, onClose, sx = {} }) {
  if (!message?.text) {
    return null;
  }
  return (
    <Alert
      severity={message.type || "info"}
      sx={{ mb: 2, ...sx }}
      onClose={onClose}
      role="alert"
      aria-live="polite"
    >
      {message.text}
    </Alert>
  );
}
