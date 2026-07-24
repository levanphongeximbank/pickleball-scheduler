import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PushPinIcon from "@mui/icons-material/PushPin";
import { useState } from "react";
import { useMessagingExperience } from "../hooks/useMessagingExperience.js";
import {
  MessagingEmptyState,
  MessagingErrorState,
  MessagingLoadingState,
} from "./MessagingStateViews.jsx";

function formatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function MessageBubble({ message }) {
  const {
    setReplyTo,
    reportMessage,
    pinMessage,
    unpinMessage,
    hideMessage,
    details,
  } = useMessagingExperience();
  const [anchor, setAnchor] = useState(null);
  const canModerate = Boolean(details?.conversation?.canModerate);
  const canPin = Boolean(details?.conversation?.canPin);

  return (
    <Box
      component="article"
      aria-label={`Tin nhắn từ ${message.sender?.displayName || "người dùng"}`}
      sx={{
        display: "flex",
        justifyContent: message.mine ? "flex-end" : "flex-start",
        mb: 1.25,
        px: 1,
      }}
    >
      <Box
        sx={{
          maxWidth: "78%",
          bgcolor: message.mine ? "primary.main" : "grey.100",
          color: message.mine ? "primary.contrastText" : "text.primary",
          borderRadius: 2,
          px: 1.5,
          py: 1,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>
            {message.sender?.displayName}
          </Typography>
          {message.pinned ? (
            <Chip size="small" icon={<PushPinIcon />} label="Ghim" sx={{ height: 20 }} />
          ) : null}
          {message.edited ? (
            <Chip size="small" label="Đã sửa" sx={{ height: 20 }} />
          ) : null}
          {message.hidden ? (
            <Chip size="small" color="warning" label="Đã ẩn" sx={{ height: 20 }} />
          ) : null}
        </Stack>

        {message.replyPreview ? (
          <Box
            sx={{
              borderLeft: 2,
              borderColor: message.mine ? "rgba(255,255,255,0.5)" : "primary.light",
              pl: 1,
              mb: 0.75,
              opacity: 0.9,
            }}
          >
            <Typography variant="caption" component="div">
              Trả lời: {message.replyPreview}
            </Typography>
          </Box>
        ) : null}

        <Typography
          variant="body2"
          sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {message.body}
        </Typography>

        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          justifyContent="flex-end"
          sx={{ mt: 0.5 }}
        >
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            {formatTime(message.createdAt)}
          </Typography>
          <IconButton
            size="small"
            aria-label="Thao tác tin nhắn"
            aria-haspopup="menu"
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ color: "inherit", p: 0.25 }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Menu
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={() => setAnchor(null)}
          MenuListProps={{ "aria-label": "Menu thao tác tin nhắn" }}
        >
          <MenuItem
            onClick={() => {
              setReplyTo(message);
              setAnchor(null);
            }}
          >
            Trả lời
          </MenuItem>
          <MenuItem
            onClick={() => {
              reportMessage(message.messageId, "inappropriate");
              setAnchor(null);
            }}
          >
            Báo cáo
          </MenuItem>
          {canPin && !message.pinned ? (
            <MenuItem
              onClick={() => {
                pinMessage(message.messageId);
                setAnchor(null);
              }}
            >
              Ghim
            </MenuItem>
          ) : null}
          {canPin && message.pinned ? (
            <MenuItem
              onClick={() => {
                unpinMessage(message.messageId);
                setAnchor(null);
              }}
            >
              Bỏ ghim
            </MenuItem>
          ) : null}
          {canModerate ? (
            <MenuItem
              onClick={() => {
                hideMessage(message.messageId);
                setAnchor(null);
              }}
            >
              Ẩn tin nhắn
            </MenuItem>
          ) : null}
        </Menu>
      </Box>
    </Box>
  );
}

export function ConversationThreadPane() {
  const {
    activeId,
    messages,
    threadStatus,
    error,
    refreshList,
    details,
    closeThread,
    mobileView,
  } = useMessagingExperience();

  if (!activeId) {
    return (
      <MessagingEmptyState
        title="Chọn một hội thoại"
        description="Chọn cuộc trò chuyện ở cột trái để xem nội dung."
      />
    );
  }

  if (threadStatus === "loading") {
    return <MessagingLoadingState label="Đang tải tin nhắn…" />;
  }
  if (threadStatus === "error") {
    return <MessagingErrorState message={error} onRetry={() => refreshList()} />;
  }

  const title =
    details?.conversation?.counterpart?.displayName ||
    details?.conversation?.name ||
    "Hội thoại";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
      id="messaging-panel"
      role="region"
      aria-label={`Nội dung hội thoại ${title}`}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        {mobileView === "thread" ? (
          <IconButton aria-label="Quay lại danh sách" onClick={closeThread}>
            <ArrowBackIcon />
          </IconButton>
        ) : null}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" noWrap>
            {title}
          </Typography>
          {details?.conversation?.channelKind ? (
            <Typography variant="caption" color="text.secondary">
              {details.conversation.channelKind}
              {details.conversation.visibility
                ? ` · ${details.conversation.visibility}`
                : ""}
            </Typography>
          ) : null}
        </Box>
      </Box>

      <Box
        component="section"
        aria-label="Danh sách tin nhắn"
        sx={{ flex: 1, overflow: "auto", py: 1.5, minHeight: 0 }}
      >
        {!messages.length ? (
          <MessagingEmptyState
            title="Chưa có tin nhắn"
            description="Hãy gửi tin nhắn đầu tiên."
          />
        ) : (
          messages.map((m) => <MessageBubble key={m.messageId} message={m} />)
        )}
      </Box>
    </Box>
  );
}
