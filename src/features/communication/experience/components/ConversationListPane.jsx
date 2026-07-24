import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { MESSAGING_TAB } from "../constants.js";
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
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return String(value);
  }
}

export function ConversationListPane() {
  const {
    tab,
    list,
    activeId,
    listStatus,
    error,
    refreshList,
    openConversation,
    acceptRequest,
    declineRequest,
    cancelRequest,
    joinChannel,
  } = useMessagingExperience();

  if (listStatus === "loading") {
    return <MessagingLoadingState label="Đang tải danh sách…" />;
  }
  if (listStatus === "error") {
    return <MessagingErrorState message={error} onRetry={refreshList} />;
  }
  if (!list.length) {
    return (
      <MessagingEmptyState
        title="Chưa có hội thoại"
        description="Danh sách trống trong chế độ demo. Chọn tab khác hoặc thử lại sau khi có dữ liệu."
        actionLabel="Tải lại"
        onAction={refreshList}
      />
    );
  }

  return (
    <List
      aria-label="Danh sách hội thoại"
      dense
      sx={{ overflow: "auto", height: "100%", py: 0 }}
    >
      {list.map((item) => {
        const id = item.conversationId || item.requestId;
        const selected = activeId && item.conversationId === activeId;
        const primary =
          item.counterpart?.displayName ||
          item.name ||
          item.channelKey ||
          id;
        const secondary =
          item.latestMessagePreview ||
          item.messagePreview ||
          item.channelKind ||
          item.visibility ||
          "";

        return (
          <ListItemButton
            key={id}
            selected={Boolean(selected)}
            onClick={() => {
              if (tab === MESSAGING_TAB.REQUESTS) return;
              if (item.canJoin) {
                joinChannel(item.conversationId);
                return;
              }
              openConversation(item);
            }}
            aria-current={selected ? "true" : undefined}
            sx={{
              alignItems: "flex-start",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle2" component="span">
                    {primary}
                  </Typography>
                  {item.hasUnread ? (
                    <Chip
                      size="small"
                      color="primary"
                      label={`${item.unreadCount || "Mới"} chưa đọc`}
                      aria-label={`${item.unreadCount || 0} tin chưa đọc`}
                    />
                  ) : null}
                  {item.channelKind ? (
                    <Chip size="small" variant="outlined" label={item.channelKind} />
                  ) : null}
                  {item.visibility ? (
                    <Chip size="small" variant="outlined" label={item.visibility} />
                  ) : null}
                  {item.archived || item.readOnly ? (
                    <Chip size="small" color="warning" label={item.archived ? "Lưu trữ" : "Chỉ đọc"} />
                  ) : null}
                  {item.direction ? (
                    <Chip
                      size="small"
                      label={item.direction === "INCOMING" ? "Đến" : "Đi"}
                    />
                  ) : null}
                </Stack>
              }
              secondary={
                <Box component="span" sx={{ display: "block", mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary" component="span">
                    {secondary}
                  </Typography>
                  {item.latestActivityAt || item.createdAt ? (
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      component="span"
                      sx={{ display: "block" }}
                    >
                      {formatTime(item.latestActivityAt || item.createdAt)}
                    </Typography>
                  ) : null}
                  {tab === MESSAGING_TAB.REQUESTS ? (
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      {item.direction === "INCOMING" ? (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={(e) => {
                              e.stopPropagation();
                              acceptRequest(item.requestId);
                            }}
                          >
                            Chấp nhận
                          </Button>
                          <Button
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              declineRequest(item.requestId);
                            }}
                          >
                            Từ chối
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelRequest(item.requestId);
                          }}
                        >
                          Hủy yêu cầu
                        </Button>
                      )}
                    </Stack>
                  ) : null}
                  {item.canJoin ? (
                    <Button
                      size="small"
                      sx={{ mt: 1 }}
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        joinChannel(item.conversationId);
                      }}
                    >
                      Tham gia kênh
                    </Button>
                  ) : null}
                </Box>
              }
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}
