import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import { MESSAGE_BODY_MAX_LENGTH } from "../constants.js";
import { useMessagingExperience } from "../hooks/useMessagingExperience.js";

export function MessageComposer({ disabledReason }) {
  const {
    sendMessage,
    submitting,
    composerError,
    replyTo,
    setReplyTo,
    slowMode,
    details,
  } = useMessagingExperience();
  const [body, setBody] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (replyTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyTo]);

  const accessDenied =
    details?.access?.decision === "DENY" ||
    details?.access?.decision === "REQUEST_REQUIRED" ||
    details?.conversation?.readOnly ||
    details?.conversation?.canSend === false;

  const slowBlocked = slowMode?.enabled && !slowMode?.canSend;
  const disabled =
    Boolean(disabledReason) ||
    accessDenied ||
    slowBlocked ||
    submitting;

  const helper =
    disabledReason ||
    (accessDenied
      ? details?.access?.message || "Bạn không thể gửi tin trong kênh này"
      : slowBlocked
        ? `Slow-mode: còn ${slowMode.remainingSeconds}s`
        : `${body.length}/${MESSAGE_BODY_MAX_LENGTH}`);

  const onSubmit = async () => {
    if (disabled || !body.trim()) return;
    const text = body;
    setBody("");
    await sendMessage(text);
  };

  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      sx={{
        borderTop: 1,
        borderColor: "divider",
        p: 1.5,
        bgcolor: "background.paper",
      }}
    >
      {replyTo ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 1, p: 1, bgcolor: "action.hover", borderRadius: 1 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="primary">
              Đang trả lời
            </Typography>
            <Typography variant="body2" noWrap>
              {replyTo.body}
            </Typography>
          </Box>
          <IconButton
            size="small"
            aria-label="Hủy trả lời"
            onClick={() => setReplyTo(null)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      ) : null}

      {composerError ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {composerError}
        </Alert>
      ) : null}

      {details?.access?.decision && details.access.decision !== "ALLOW" ? (
        <Chip
          size="small"
          color={details.access.decision === "DENY" ? "error" : "warning"}
          label={`Truy cập: ${details.access.decision}`}
          sx={{ mb: 1 }}
        />
      ) : null}

      <Stack direction="row" spacing={1} alignItems="flex-end">
        <IconButton
          aria-label="Đính kèm (chưa khả dụng)"
          disabled
          title="Đính kèm chưa khả dụng trong COMMS-06"
        >
          <AttachFileIcon />
        </IconButton>
        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={6}
          minRows={1}
          size="small"
          label="Soạn tin nhắn"
          placeholder="Nhập tin nhắn… (Enter gửi, Shift+Enter xuống dòng)"
          value={body}
          disabled={disabled}
          onChange={(e) => setBody(e.target.value.slice(0, MESSAGE_BODY_MAX_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          helperText={helper}
          inputProps={{
            "aria-label": "Nội dung tin nhắn",
            maxLength: MESSAGE_BODY_MAX_LENGTH,
          }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={disabled || !body.trim()}
          aria-label="Gửi tin nhắn"
          endIcon={<SendIcon />}
        >
          {submitting ? "Đang gửi…" : "Gửi"}
        </Button>
      </Stack>
    </Box>
  );
}
