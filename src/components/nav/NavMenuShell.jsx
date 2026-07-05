import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import NavMenuTree, { NavTreeNode } from "./NavMenuTree.jsx";
import { getNavIcon } from "../../config/navIcons.js";
import { isNavItemActive } from "./navPathMatchers.js";
import { resolveMenuItemPath } from "../../auth/menuAccess.js";
import {
  SIDEBAR_NAV,
  sidebarFolderActiveSx,
  sidebarNavItemSx,
} from "../shell/sidebarNavTokens.js";

/**
 * Nhóm nhiều mục lá (VĐV, Trọng tài) — cấp 1 xổ/thu, cấp 2 là các link.
 */
function NavMenuGroupAccordion({
  label,
  items,
  user,
  currentPath,
  onItemClick,
  variant = "dark",
}) {
  const isDark = variant === "dark";
  const childActive = useMemo(
    () =>
      (items || []).some((item) => {
        const path = resolveMenuItemPath(item, user);
        return path && isNavItemActive(currentPath, item, path);
      }),
    [items, user, currentPath]
  );
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) {
      setOpen(true);
    }
  }, [childActive]);

  if (!items?.length) {
    return null;
  }

  return (
    <Box sx={{ mb: 0.35 }}>
      <ListItemButton
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`${open ? "Thu gọn" : "Mở rộng"} ${label}`}
        sx={{
          ...sidebarNavItemSx({ isDark, selected: false, pl: SIDEBAR_NAV.itemPl }),
          ...sidebarFolderActiveSx({ isDark, childActive, depth: 0 }),
          color: isDark ? "rgba(255,255,255,0.72)" : "text.secondary",
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: SIDEBAR_NAV.iconMinWidth,
            color: "inherit",
          }}
        >
          {getNavIcon("groups", SIDEBAR_NAV.iconSize)}
        </ListItemIcon>
        <ListItemText
          primary={label}
          slotProps={{
            primary: {
              sx: {
                fontSize: SIDEBAR_NAV.fontSize,
                fontWeight: SIDEBAR_NAV.fontWeightActive,
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
          {items.map((item) => (
            <NavTreeNode
              key={item.key || item.text}
              item={item}
              depth={1}
              user={user}
              currentPath={currentPath}
              onItemClick={onItemClick}
              variant={variant}
            />
          ))}
        </List>
      </Collapse>
    </Box>
  );
}

function NavMenuGroup({ group, user, currentPath, onItemClick, variant }) {
  const roots = group.items || [];

  if (roots.length === 1 && roots[0].children?.length) {
    return (
      <NavMenuTree
        root={roots[0]}
        user={user}
        currentPath={currentPath}
        onItemClick={onItemClick}
        variant={variant}
        skipRootLabel={false}
      />
    );
  }

  if (roots.length > 1) {
    return (
      <NavMenuGroupAccordion
        label={group.label || group.id}
        items={roots}
        user={user}
        currentPath={currentPath}
        onItemClick={onItemClick}
        variant={variant}
      />
    );
  }

  if (roots.length === 1) {
    return (
      <NavMenuTree
        root={roots[0]}
        user={user}
        currentPath={currentPath}
        onItemClick={onItemClick}
        variant={variant}
        skipRootLabel={false}
      />
    );
  }

  return null;
}

/**
 * Sidebar V5 — menu accordion 2 cấp (cấp 1 xổ/thu → cấp 2).
 */
export default function NavMenuShell({
  groups,
  user,
  currentPath,
  onItemClick,
  variant = "dark",
}) {
  if (!groups?.length) {
    return null;
  }

  return (
    <Box sx={{ py: 0.35 }}>
      {groups.map((group) => (
        <Box key={group.id || group.label} sx={{ mb: 0.5 }}>
          <NavMenuGroup
            group={group}
            user={user}
            currentPath={currentPath}
            onItemClick={onItemClick}
            variant={variant}
          />
        </Box>
      ))}
    </Box>
  );
}
