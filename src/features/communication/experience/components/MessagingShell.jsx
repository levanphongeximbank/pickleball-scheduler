import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useMessagingExperience } from "../hooks/useMessagingExperience.js";
import { ConversationListPane } from "./ConversationListPane.jsx";
import { ConversationThreadPane } from "./ConversationThreadPane.jsx";
import { DetailsPane } from "./DetailsPane.jsx";
import { MessageComposer } from "./MessageComposer.jsx";
import { MessagingTabs } from "./MessagingTabs.jsx";

export function MessagingShell() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const {
    activeId,
    mobileView,
    setMobileView,
    adapterInfo,
    unread,
  } = useMessagingExperience();

  const listPane = (
    <Paper
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Danh sách
          {unread?.hasUnread ? ` · ${unread.total} chưa đọc` : ""}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ConversationListPane />
      </Box>
    </Paper>
  );

  const threadPane = (
    <Paper
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ConversationThreadPane />
      </Box>
      {activeId ? <MessageComposer /> : null}
    </Paper>
  );

  const detailsPane = (
    <Paper
      variant="outlined"
      sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}
    >
      <DetailsPane />
    </Paper>
  );

  return (
    <Box
      data-testid="messaging-shell"
      sx={{
        display: "flex",
        flexDirection: "column",
        height: { xs: "calc(100vh - 120px)", md: "calc(100vh - 96px)" },
        minHeight: 480,
        gap: 1.5,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
      >
        <Box>
          <Typography variant="h5" component="h1">
            Tin nhắn
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cá nhân · Câu lạc bộ · Cộng đồng (demo gateway — chưa nối production)
          </Typography>
        </Box>
        <Typography variant="caption" color="warning.main">
          {adapterInfo.adapterKind}
        </Typography>
      </Stack>

      <MessagingTabs />

      {isMobile ? (
        <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
          {mobileView === "list" || !activeId ? listPane : null}
          {mobileView === "thread" && activeId ? (
            <Box sx={{ height: "100%", position: "relative" }}>
              {threadPane}
              <IconButton
                aria-label="Xem thông tin hội thoại"
                onClick={() => setMobileView("details")}
                sx={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
              >
                <InfoOutlinedIcon />
              </IconButton>
            </Box>
          ) : null}
          <Drawer
            anchor="bottom"
            open={mobileView === "details"}
            onClose={() => setMobileView("thread")}
            PaperProps={{ sx: { maxHeight: "70vh", borderTopLeftRadius: 12, borderTopRightRadius: 12 } }}
          >
            <Box sx={{ p: 1 }}>
              <DetailsPane />
            </Box>
          </Drawer>
        </Box>
      ) : (
        <Box
          data-testid="messaging-desktop-columns"
          sx={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: { md: "280px 1fr 280px", lg: "320px 1fr 300px" },
            gap: 1.5,
          }}
        >
          {listPane}
          {threadPane}
          {detailsPane}
        </Box>
      )}
    </Box>
  );
}
