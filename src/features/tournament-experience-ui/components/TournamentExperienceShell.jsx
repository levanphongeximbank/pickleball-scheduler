import { useState } from "react";
import { Link as RouterLink, Outlet, useLocation, useParams } from "react-router-dom";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToReg";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import {
  TOURNAMENT_COLOR,
  TOURNAMENT_LAYOUT,
  TOURNAMENT_SPACE,
  TOURNAMENT_TYPE,
} from "../design/tournamentDesignTokens.js";
import { FIXTURE_TOURNAMENT_ID, getFixtureTournament } from "../fixtures/prototypeFixture.js";
import { publicTournamentPath, resolveNavPath, TOURNAMENT_NAV_ITEMS } from "../navigation/tournamentNav.js";
import PrototypeBanner from "./PrototypeBanner.jsx";

const ICON_BY_ID = {
  center: DashboardOutlinedIcon,
  overview: EmojiEventsOutlinedIcon,
  registration: HowToRegOutlinedIcon,
  participants: GroupsOutlinedIcon,
};

function isItemActive(pathname, item, tournamentId) {
  const path = resolveNavPath(item, tournamentId);
  if (item.id === "center") {
    return pathname === path || pathname === `${path}/`;
  }
  if (item.id === "overview") {
    return pathname === path || pathname === `${path}/`;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavList({ tournamentId, onNavigate }) {
  const location = useLocation();
  const current = TOURNAMENT_NAV_ITEMS.filter((item) => item.implemented);
  const future = TOURNAMENT_NAV_ITEMS.filter((item) => !item.implemented);

  const renderItem = (item, compact) => {
    const Icon = ICON_BY_ID[item.id] || DashboardOutlinedIcon;
    const active = isItemActive(location.pathname, item, tournamentId);
    return (
      <ListItemButton
        key={item.id}
        component={RouterLink}
        to={resolveNavPath(item, tournamentId)}
        onClick={onNavigate}
        selected={active}
        sx={{
          mb: compact ? 0 : 0.15,
          py: compact ? 0.35 : 0.7,
          minHeight: compact ? 30 : 36,
          borderRadius: 1.25,
          color: active ? "#FFFFFF" : compact ? TOURNAMENT_COLOR.navyTextMuted : TOURNAMENT_COLOR.navyText,
          "&.Mui-selected": {
            bgcolor: TOURNAMENT_COLOR.primary,
            "&:hover": { bgcolor: TOURNAMENT_COLOR.primaryDark },
          },
          "&:hover": { bgcolor: TOURNAMENT_COLOR.navyHover },
          opacity: compact ? 0.55 : 1,
        }}
      >
        <ListItemIcon sx={{ minWidth: compact ? 28 : 32, color: "inherit" }}>
          <Icon sx={{ fontSize: compact ? 16 : 18 }} />
        </ListItemIcon>
        <ListItemText
          primary={item.label}
          slotProps={{
            primary: {
              sx: {
                fontSize: compact ? 12 : 13,
                fontWeight: active ? 700 : compact ? 400 : 600,
              },
            },
          }}
        />
      </ListItemButton>
    );
  };

  return (
    <Box sx={{ px: 1, py: 0.75 }}>
      <List dense disablePadding>
        {current.map((item) => renderItem(item, false))}
      </List>
      {future.length ? (
        <>
          <Divider sx={{ my: 0.75, borderColor: "rgba(255,255,255,0.08)" }} />
          <Typography
            sx={{
              px: 1,
              mb: 0.5,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              color: TOURNAMENT_COLOR.navyTextMuted,
              textTransform: "uppercase",
            }}
          >
            Chưa mở
          </Typography>
          <List dense disablePadding sx={{ maxHeight: 220, overflow: "auto" }}>
            {future.map((item) => renderItem(item, true))}
          </List>
        </>
      ) : null}
    </Box>
  );
}

export default function TournamentExperienceShell({
  title,
  subtitle,
  showEventContext = false,
  showPublicSite = false,
  contextChip,
  actions,
  children,
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [open, setOpen] = useState(false);
  const { tournamentId = FIXTURE_TOURNAMENT_ID } = useParams();
  const tournament = getFixtureTournament(tournamentId);

  const sidebar = (
    <Box
      sx={{
        width: TOURNAMENT_LAYOUT.sidebarWidth,
        bgcolor: TOURNAMENT_COLOR.navy,
        color: TOURNAMENT_COLOR.navyText,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "100dvh",
      }}
    >
      <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Typography sx={{ fontWeight: 800, letterSpacing: 0.4, fontSize: 15 }}>PICK_VN</Typography>
        <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.navyTextMuted }}>
          Trải nghiệm giải đấu
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <NavList tournamentId={tournament.id} onNavigate={() => setOpen(false)} />
      </Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ p: 1.5, borderTop: "1px solid rgba(255,255,255,0.06)", alignItems: "center" }}
      >
        <Avatar sx={{ width: 28, height: 28, bgcolor: TOURNAMENT_COLOR.primary, fontSize: 12 }}>A</Avatar>
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Admin PICK_VN</Typography>
          <Typography sx={{ fontSize: 10, color: TOURNAMENT_COLOR.navyTextMuted }}>Quản trị viên</Typography>
        </Box>
      </Stack>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100dvh",
        bgcolor: TOURNAMENT_COLOR.pageBg,
        overflowX: "hidden",
      }}
    >
      {isDesktop ? sidebar : (
        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          slotProps={{ paper: { sx: { bgcolor: TOURNAMENT_COLOR.navy, width: TOURNAMENT_LAYOUT.sidebarWidth } } }}
        >
          {sidebar}
        </Drawer>
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <PrototypeBanner />
        <Box
          data-testid="tournament-shared-header"
          sx={{
            px: { xs: 1.5, md: 2 },
            py: 1,
            bgcolor: TOURNAMENT_COLOR.cardBg,
            borderBottom: `1px solid ${TOURNAMENT_COLOR.divider}`,
          }}
        >
          <Box
            data-testid="tournament-app-header-row"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              minHeight: TOURNAMENT_LAYOUT.headerHeight,
            }}
          >
            {!isDesktop ? (
              <IconButton aria-label="Mở menu giải đấu" onClick={() => setOpen(true)} size="small" sx={{ flexShrink: 0 }}>
                <MenuIcon />
              </IconButton>
            ) : null}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: { xs: 18, md: TOURNAMENT_TYPE.pageTitle.size },
                  fontWeight: TOURNAMENT_TYPE.pageTitle.weight,
                  lineHeight: 1.15,
                }}
              >
                {title}
              </Typography>
              {subtitle ? (
                <Typography sx={{ fontSize: TOURNAMENT_TYPE.pageSubtitle.size, color: TOURNAMENT_COLOR.textMuted }}>
                  {subtitle}
                </Typography>
              ) : null}
              {showEventContext ? (
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ mt: 0.35, flexWrap: "wrap", alignItems: "center" }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: TOURNAMENT_COLOR.text }}>
                    {tournament.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>• Đôi nam 3.5</Typography>
                  {contextChip}
                </Stack>
              ) : null}
            </Box>
            {isDesktop ? (
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: "center", flexShrink: 0 }}>
                {actions}
                {showPublicSite ? (
                  <Button
                    component={RouterLink}
                    to={publicTournamentPath(tournament.id)}
                    variant="outlined"
                    size="small"
                    endIcon={<OpenInNewIcon />}
                  >
                    Xem trang công khai
                  </Button>
                ) : null}
              </Stack>
            ) : null}
            <IconButton aria-label="Thông báo" size="small" sx={{ flexShrink: 0 }} data-testid="tournament-header-notification">
              <Badge badgeContent={2} color="error">
                <NotificationsNoneIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Box>
          {!isDesktop && (actions || showPublicSite) ? (
            <Stack
              data-testid="tournament-header-page-actions"
              direction="row"
              spacing={0.75}
              useFlexGap
              sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}
            >
              {actions}
              {showPublicSite ? (
                <Button
                  component={RouterLink}
                  to={publicTournamentPath(tournament.id)}
                  variant="outlined"
                  size="small"
                  endIcon={<OpenInNewIcon />}
                  sx={{ display: { xs: "none", sm: "inline-flex" } }}
                >
                  Xem trang công khai
                </Button>
              ) : null}
            </Stack>
          ) : null}
        </Box>

        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            p: {
              xs: `${TOURNAMENT_SPACE.pagePadMobile}px`,
              md: `${TOURNAMENT_SPACE.pagePadTablet}px`,
              xl: `${TOURNAMENT_SPACE.pagePadDesktop}px`,
            },
            pb: { xs: 10, md: 2 },
            width: "100%",
            maxWidth: TOURNAMENT_LAYOUT.contentMax,
          }}
        >
          {children || <Outlet />}
        </Box>
      </Box>
    </Box>
  );
}
