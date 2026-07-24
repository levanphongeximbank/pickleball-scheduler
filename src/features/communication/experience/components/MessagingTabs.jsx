import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import {
  MESSAGING_TAB,
  MESSAGING_TAB_LABEL,
} from "../constants.js";
import { useMessagingExperience } from "../hooks/useMessagingExperience.js";

export function MessagingTabs() {
  const { tab, setTab, unread } = useMessagingExperience();

  const badge = (key, count) => (
    <Badge
      color="error"
      badgeContent={count || 0}
      invisible={!count}
      max={99}
      sx={{ "& .MuiBadge-badge": { right: -10, top: 4 } }}
    >
      <span>{MESSAGING_TAB_LABEL[key]}</span>
    </Badge>
  );

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Tabs
        value={tab}
        onChange={(_, next) => setTab(next)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Phân loại tin nhắn"
      >
        <Tab
          value={MESSAGING_TAB.DIRECT}
          label={badge(MESSAGING_TAB.DIRECT, unread?.direct)}
          id="messaging-tab-direct"
          aria-controls="messaging-panel"
        />
        <Tab
          value={MESSAGING_TAB.CLUB}
          label={badge(MESSAGING_TAB.CLUB, unread?.club)}
          id="messaging-tab-club"
          aria-controls="messaging-panel"
        />
        <Tab
          value={MESSAGING_TAB.COMMUNITY}
          label={badge(MESSAGING_TAB.COMMUNITY, unread?.community)}
          id="messaging-tab-community"
          aria-controls="messaging-panel"
        />
        <Tab
          value={MESSAGING_TAB.REQUESTS}
          label={badge(MESSAGING_TAB.REQUESTS, unread?.requests)}
          id="messaging-tab-requests"
          aria-controls="messaging-panel"
        />
      </Tabs>
    </Box>
  );
}
