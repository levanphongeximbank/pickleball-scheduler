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
    <Box sx={{ mb: 0.5 }}>
      {group.label && (
        <ListItemButton
          onClick={toggleOpen}
          sx={{
            borderRadius: 1.5,
            mx: 0.5,
            py: 0.5,
            minHeight: 36,
            "&:hover": {
              bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(15, 23, 42, 0.04)",
            },
          }}
        >
          <ListItemText
            primary={group.label}
            primaryTypographyProps={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: isDark ? "rgba(255,255,255,0.55)" : "text.secondary",
            }}
          />
          {hasMultipleItems ? (
            open ? (
              <ExpandLessIcon sx={{ fontSize: 18, color: isDark ? "rgba(255,255,255,0.55)" : "text.secondary" }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 18, color: isDark ? "rgba(255,255,255,0.55)" : "text.secondary" }} />
            )
          ) : null}
        </ListItemButton>
      )}

      <Collapse in={!hasMultipleItems || open} timeout="auto" unmountOnExit={false}>
        <List dense disablePadding sx={{ pl: compact ? 0 : 0.5 }}>
          {group.items.map((item) => {
            const path = resolveMenuItemPath(item, user);
            const selected = isNavItemActive(currentPath, item, path);

            return (
              <ListItemButton
                component={Link}
                to={path}
                key={item.key || `${group.label}-${item.text}`}
                selected={selected}
                onClick={onItemClick}
                sx={{
                  borderRadius: 1.5,
                  mx: 0.5,
                  mb: 0.25,
                  py: compact ? 0.65 : 0.75,
                  color: isDark ? "rgba(255,255,255,0.88)" : "inherit",
                  "&.Mui-selected": {
                    bgcolor: isDark ? "rgba(255,255,255,0.12)" : "rgba(15, 118, 110, 0.12)",
                    color: isDark ? "#FFFFFF" : "#0f766e",
                    fontWeight: 800,
                    "&:hover": {
                      bgcolor: isDark ? "rgba(255,255,255,0.16)" : "rgba(15, 118, 110, 0.18)",
                    },
                    "& .MuiListItemIcon-root": { color: isDark ? "#6EE7B7" : "#0f766e" },
                  },
                  "&:hover": {
                    bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(15, 23, 42, 0.04)",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: compact ? 32 : 36,
                    color: selected
                      ? isDark
                        ? "#6EE7B7"
                        : "#0f766e"
                      : isDark
                        ? "rgba(255,255,255,0.65)"
                        : "text.secondary",
                  }}
                >
                  {getNavIcon(item.icon || item.key)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.text}
                      </Box>
                      <NavItemBadge item={item} />
                    </Box>
                  }
                  primaryTypographyProps={{
                    component: "div",
                    fontSize: compact ? 13.5 : 13.5,
                    fontWeight: selected ? 800 : 600,
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Collapse>

      {groupIndex < totalGroups - 1 && (
        <Divider sx={{ my: 1, mx: 1.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)" }} />
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
