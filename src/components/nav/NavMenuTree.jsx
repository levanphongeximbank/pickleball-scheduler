import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Chip,
  Collapse,
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
import { isNavItemActive, treeHasActiveItem } from "./navPathMatchers.js";
import { SHELL_COLORS } from "../shell/shellTokens.js";
import {
  SIDEBAR_NAV,
  sidebarFolderActiveSx,
  sidebarNavItemSx,
} from "../shell/sidebarNavTokens.js";

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

function NavTreeNode({
  item,
  depth,
  user,
  currentPath,
  onItemClick,
  variant,
  defaultOpen = false,
}) {
  const isDark = variant === "dark";
  const isFolder = Boolean(item.children?.length);
  const path = !isFolder ? resolveMenuItemPath(item, user) : null;
  const selected = !isFolder && path ? isNavItemActive(currentPath, item, path) : false;
  const childActive = useMemo(
    () => (isFolder ? treeHasActiveItem(currentPath, item, user, resolveMenuItemPath) : false),
    [currentPath, isFolder, item, user]
  );
  const [open, setOpen] = useState(defaultOpen || childActive);

  useEffect(() => {
    if (childActive) {
      setOpen(true);
    }
  }, [childActive]);

  const pl = SIDEBAR_NAV.itemPl + depth * SIDEBAR_NAV.depthStep;
  const fontSize = depth === 0 ? SIDEBAR_NAV.fontSize : SIDEBAR_NAV.fontSizeNested;

  if (isFolder) {
    return (
      <Box>
        <ListItemButton
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={`${open ? "Thu gọn" : "Mở rộng"} ${item.text}`}
          sx={{
            ...sidebarNavItemSx({ isDark, selected: false, pl }),
            ...sidebarFolderActiveSx({ isDark, childActive, depth }),
            color: isDark ? "rgba(255,255,255,0.72)" : "text.secondary",
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: depth === 0 ? SIDEBAR_NAV.iconMinWidth : 22,
              color: "inherit",
            }}
          >
            {depth === 0 ? getNavIcon(item.icon || item.key, SIDEBAR_NAV.iconSize) : null}
          </ListItemIcon>
          <ListItemText
            primary={item.text}
            slotProps={{
              primary: {
                sx: {
                  fontSize,
                  fontWeight: depth === 0 ? SIDEBAR_NAV.fontWeightActive : SIDEBAR_NAV.fontWeight,
                  color: "inherit",
                  lineHeight: 1.3,
                },
              },
            }}
          />
          {open ? (
            <ExpandLessIcon sx={{ fontSize: 14, opacity: 0.65, flexShrink: 0 }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 14, opacity: 0.65, flexShrink: 0 }} />
          )}
        </ListItemButton>
        <Collapse in={open} timeout="auto" unmountOnExit={false}>
          <List dense disablePadding>
            {item.children.map((child) => (
              <NavTreeNode
                key={child.key || child.text}
                item={child}
                depth={depth + 1}
                user={user}
                currentPath={currentPath}
                onItemClick={onItemClick}
                variant={variant}
                defaultOpen={childActive}
              />
            ))}
          </List>
        </Collapse>
      </Box>
    );
  }

  return (
    <ListItemButton
      component={Link}
      to={path}
      selected={selected}
      onClick={onItemClick}
      sx={sidebarNavItemSx({ isDark, selected, pl })}
    >
      <ListItemIcon
        sx={{
          minWidth: depth === 0 ? SIDEBAR_NAV.iconMinWidth : 22,
          color: selected
            ? isDark
              ? "#FFFFFF"
              : SHELL_COLORS.primaryGreen
            : isDark
              ? "rgba(255,255,255,0.5)"
              : "text.secondary",
        }}
      >
        {getNavIcon(item.icon || item.key, depth === 0 ? SIDEBAR_NAV.iconSize : 15)}
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
                fontSize,
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
}

export default function NavMenuTree({
  root,
  user,
  currentPath,
  onItemClick,
  variant = "dark",
  skipRootLabel = false,
}) {
  if (!root) {
    return null;
  }

  if (!root.children?.length) {
    return (
      <List dense disablePadding sx={{ px: 0, py: 0 }}>
        <NavTreeNode
          item={root}
          depth={0}
          user={user}
          currentPath={currentPath}
          onItemClick={onItemClick}
          variant={variant}
        />
      </List>
    );
  }

  if (skipRootLabel) {
    return (
      <List dense disablePadding sx={{ px: 0, py: 0 }}>
        {root.children.map((child) => (
          <NavTreeNode
            key={child.key}
            item={child}
            depth={0}
            user={user}
            currentPath={currentPath}
            onItemClick={onItemClick}
            variant={variant}
          />
        ))}
      </List>
    );
  }

  return (
    <List dense disablePadding sx={{ px: 0, py: 0 }}>
      <NavTreeNode
        item={root}
        depth={0}
        user={user}
        currentPath={currentPath}
        onItemClick={onItemClick}
        variant={variant}
      />
    </List>
  );
}

export { NavTreeNode };
