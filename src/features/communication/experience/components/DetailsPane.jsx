import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMessagingExperience } from "../hooks/useMessagingExperience.js";
import { MessagingEmptyState } from "./MessagingStateViews.jsx";

export function DetailsPane() {
  const {
    details,
    activeId,
    leaveChannel,
    blockUser,
    adapterInfo,
  } = useMessagingExperience();

  if (!activeId || !details?.conversation) {
    return (
      <MessagingEmptyState
        title="Chi tiết"
        description="Thông tin người dùng, CLB hoặc kênh sẽ hiện khi bạn chọn hội thoại."
      />
    );
  }

  const c = details.conversation;

  return (
    <Box
      component="aside"
      aria-label="Thông tin hội thoại"
      sx={{ p: 2, overflow: "auto", height: "100%" }}
    >
      <Typography variant="h6" sx={{ mb: 1 }}>
        {c.counterpart?.displayName || c.name || "Chi tiết"}
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {c.kind ? <Chip size="small" label={c.kind} /> : null}
        {c.channelKind ? <Chip size="small" label={c.channelKind} /> : null}
        {c.visibility ? <Chip size="small" variant="outlined" label={c.visibility} /> : null}
        {c.participantAccessState ? (
          <Chip size="small" label={`Access: ${c.participantAccessState}`} />
        ) : null}
        {details.access?.decision ? (
          <Chip
            size="small"
            color={
              details.access.decision === "ALLOW"
                ? "success"
                : details.access.decision === "DENY"
                  ? "error"
                  : "warning"
            }
            label={details.access.decision}
          />
        ) : null}
      </Stack>

      {details.access?.message ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {details.access.message}
        </Alert>
      ) : null}

      {details.ruleNotice || c.ruleNotice ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {details.ruleNotice || c.ruleNotice}
        </Alert>
      ) : null}

      {details.membershipNote ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {details.membershipNote}
        </Typography>
      ) : null}

      {c.readOnly || c.archived ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {c.archived
            ? "Kênh đã lưu trữ — chỉ xem."
            : "Kênh ở trạng thái chỉ đọc hoặc bị giới hạn."}
        </Alert>
      ) : null}

      <Divider sx={{ my: 2 }} />

      <Stack spacing={1}>
        {c.counterpart?.participantId ? (
          <Button
            variant="outlined"
            color="error"
            onClick={() => blockUser(c.counterpart.participantId)}
          >
            Chặn người dùng
          </Button>
        ) : null}
        {c.canLeave ? (
          <Button
            variant="outlined"
            onClick={() => leaveChannel(c.conversationId)}
          >
            Rời kênh
          </Button>
        ) : null}
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Typography variant="caption" color="text.secondary" component="p">
        Adapter: {adapterInfo.adapterKind} — {adapterInfo.note}
      </Typography>
    </Box>
  );
}
