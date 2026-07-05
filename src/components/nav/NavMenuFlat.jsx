import {
  Box,
  Chip,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { Link } from "react-router-dom";

import {
  NAV_ITEM_STATUS,
  flattenMenuGroupsForShell,
  resolveTournamentMenuRoot,
} from "../../config/navigationConfig.js";
import { getNavIcon } from "../../config/navIcons.js";
import { resolveMenuItemPath } from "../../auth/menuAccess.js";
import { isNavItemActive } from "./navPathMatchers.js";
import NavMenuTree from "./NavMenuTree.jsx";
import { SHELL_COLORS } from "../shell/shellTokens.js";
import { SIDEBAR_NAV, sidebarNavItemSx } from "../shell/sidebarNavTokens.js";

function NavItemBadge({ item }) {
  if (item.navStatus === NAV_ITEM_STATUS.COMING_SOON || item.badge) {
    return (
      <Chip
        size="small"
        label={item.badge || "Sắp ra mắt"}
        sx={{
          height: SIDEBAR_NAV.badgeHeight,
          fontSize: SIDEBAR_NAV.badgeFontSize,
          fontWeight: 700,
          ml: 0.35,
          maxWidth: 72,
          "& .MuiChip-label": { px: 0.5, overflow: "hidden", textOverflow: "ellipsis" },
          bgcolor: "rgba(245, 158, 11, 0.14)",
          color: "#b45309",
        }}
      />
    );
  }
  return null;
}

export default function NavMenuFlat({ groups, user, currentPath, onItemClick, variant = "dark" }) {
  const isDark = variant === "dark";
  const items = flattenMenuGroupsForShell(groups, user);
  const tournamentRoot = resolveTournamentMenuRoot(groups);

  if (!items.length) {
    return null;
  }

  return (
    <List dense disablePadding sx={{ px: SIDEBAR_NAV.listPx, py: 0.35 }}>
      {items.map((item) => {
        if (item.type === "tournament-tree" && tournamentRoot) {
          return (
            <Box key="tournament-tree">
              <NavMenuTree
                root={tournamentRoot}
                user={user}
                currentPath={currentPath}
                onItemClick={onItemClick}
                variant={variant}
              />
            </Box>
          );
        }

        const path = resolveMenuItemPath(item, user);
        const selected = isNavItemActive(currentPath, item, path);

        return (
          <ListItemButton
            component={Link}
            to={path}
            key={item.key || item.path}
            selected={selected}
            onClick={onItemClick}
            sx={sidebarNavItemSx({ isDark, selected })}
          >
            <ListItemIcon
              sx={{
                minWidth: SIDEBAR_NAV.iconMinWidth,
                color: selected
                  ? isDark
                    ? "#FFFFFF"
                    : SHELL_COLORS.primaryGreen
                  : isDark
                    ? "rgba(255,255,255,0.5)"
                    : "text.secondary",
              }}
            >
              {getNavIcon(item.icon || item.key, SIDEBAR_NAV.iconSize)}
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: "flex", alignItems: "center", minWidth: 0, color: "inherit" }}>
                  <Box
                    component="span"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "inherit",
                      fontSize: SIDEBAR_NAV.fontSize,
                      fontWeight: selected ? SIDEBAR_NAV.fontWeightActive : SIDEBAR_NAV.fontWeight,
                      lineHeight: 1.3,
                    }}
                  >
                    {item.text}
                  </Box>
                  <NavItemBadge item={item} />
                </Box>
              }
              slotProps={{ primary: { component: "div" } }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}
