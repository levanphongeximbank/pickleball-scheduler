import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Chip,
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Link } from "react-router-dom";

import { NAV_ITEM_STATUS } from "../../config/navigationConfig.js";
import { getNavIcon } from "../../config/navIcons.js";
import { resolveMenuItemPath } from "../../auth/menuAccess.js";
import { groupHasActiveItem, isNavItemActive } from "./navPathMatchers.js";
import { SHELL_COLORS } from "../shell/shellTokens.js";

function NavItemBadge({ item }) {
  if (item.navStatus === NAV_ITEM_STATUS.COMING_SOON || item.badge) {
    return (
      <Chip
        size="small"
        label={item.badge || "Sắp ra mắt"}
        sx={{
          height: 18,
          fontSize: 10,
          fontWeight: 700,
          ml: 0.5,
          bgcolor: "rgba(245, 158, 11, 0.14)",
          color: "#b45309",
        }}
      />
    );
  }
  return null;
}

function NavGroupSection({
  group,
  groupIndex,
  totalGroups,
  currentPath,
  user,
  onItemClick,
  compact = false,
  variant = "light",
}) {
  const isDark = variant === "dark";
  const hasMultipleItems = group.items.length > 1;
  const initiallyOpen = useMemo(
    () => groupHasActiveItem(currentPath, group, user, resolveMenuItemPath),
    [currentPath, group, user]
  );
  const [open, setOpen] = useState(initiallyOpen);

  useEffect(() => {
    if (initiallyOpen) {
      setOpen(true);
    }
  }, [initiallyOpen]);

  const toggleOpen = () => {
    if (hasMultipleItems) {
      setOpen((value) => !value);
    }
  };

  return (
    <Box sx={{ mb: 0.25 }}>
      {group.label && hasMultipleItems && (
        <ListItemButton
          onClick={toggleOpen}
          sx={{
            borderRadius: 1,
            mx: 1,
            py: 0.35,
            minHeight: 32,
            color: isDark ? SHELL_COLORS.sidebarTextMuted : SHELL_COLORS.textSecondary,
            "&:hover": {
              bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(15, 23, 42, 0.04)",
            },
          }}
        >
          <ListItemText
            primary={group.label}
            slotProps={{
              primary: {
                sx: {
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  color: "inherit",
                },
              },
            }}
          />
          {open ? (
            <ExpandLessIcon sx={{ fontSize: 16, color: SHELL_COLORS.sidebarTextMuted }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 16, color: SHELL_COLORS.sidebarTextMuted }} />
          )}
        </ListItemButton>
      )}

      <Collapse in={!hasMultipleItems || open} timeout="auto" unmountOnExit={false}>
        <List dense disablePadding sx={{ px: 0.5 }}>
          {group.items.map((item) => {
            const path = resolveMenuItemPath(item, user);
            const selected = isNavItemActive(currentPath, item, path);

            return (
              <ListItemButton
                component={Link}
                to={path}
                key={item.key || `${group.label}-${item.text}`}
                selected={selected}
                aria-current={selected ? "page" : undefined}
                onClick={onItemClick}
                sx={{
                  position: "relative",
                  borderRadius: 1,
                  mx: 0.75,
                  mb: 0.2,
                  py: compact ? 0.6 : 0.7,
                  pl: 1.5,
                  color: isDark ? "rgba(255,255,255,0.78)" : "inherit",
                  "&.Mui-selected": {
                    bgcolor: isDark ? SHELL_COLORS.sidebarSelectedBg : "rgba(16, 185, 129, 0.1)",
                    color: isDark ? "#FFFFFF" : SHELL_COLORS.primaryGreen,
                    fontWeight: 600,
                    "&::before": isDark
                      ? {
                          content: '""',
                          position: "absolute",
                          left: 0,
                          top: 6,
                          bottom: 6,
                          width: 3,
                          borderRadius: "0 2px 2px 0",
                          bgcolor: SHELL_COLORS.sidebarAccentBar,
                        }
                      : undefined,
                    "&:hover": {
                      bgcolor: isDark ? SHELL_COLORS.sidebarSelectedHover : "rgba(16, 185, 129, 0.14)",
                    },
                    "& .MuiListItemIcon-root": {
                      color: isDark ? SHELL_COLORS.sidebarAccent : SHELL_COLORS.primaryGreen,
                    },
                  },
                  "&:hover": {
                    bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(15, 23, 42, 0.04)",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: compact ? 30 : 34,
                    color: selected
                      ? isDark
                        ? SHELL_COLORS.sidebarAccent
                        : SHELL_COLORS.primaryGreen
                      : isDark
                        ? "rgba(255,255,255,0.55)"
                        : "text.secondary",
                  }}
                >
                  {getNavIcon(item.icon || item.key)}
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
                        }}
                      >
                        {item.text}
                      </Box>
                      <NavItemBadge item={item} />
                    </Box>
                  }
                  slotProps={{
                    primary: {
                      component: "div",
                      sx: {
                        fontSize: 13.5,
                        fontWeight: selected ? 600 : 500,
                        color: "inherit",
                      },
                    },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Collapse>

      {groupIndex < totalGroups - 1 && (
        <Divider sx={{ my: 0.75, mx: 1.5, borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)" }} />
      )}
    </Box>
  );
}

export default function NavMenuList({ groups, user, currentPath, onItemClick, compact = false, variant = "light" }) {
  if (!groups?.length) {
    return null;
  }

  return (
    <List dense disablePadding>
      {groups.map((group, groupIndex) => (
        <NavGroupSection
          key={group.id || group.label || `group-${groupIndex}`}
          group={group}
          groupIndex={groupIndex}
          totalGroups={groups.length}
          currentPath={currentPath}
          user={user}
          onItemClick={onItemClick}
          compact={compact}
          variant={variant}
        />
      ))}
    </List>
  );
}
