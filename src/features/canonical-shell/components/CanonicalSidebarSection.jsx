import { useEffect } from "react";
import { Collapse, List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";

import CanonicalSidebarSubmenu from "./CanonicalSidebarSubmenu.jsx";
import { useCanonicalShell } from "../hooks/useCanonicalShell.js";
import { renderNavIcon } from "../utils/resolveNavIcon.jsx";
import { findActiveCanonicalNode } from "../services/matchCanonicalRoute.js";

/**
 * Level-1 business domain section (accordion).
 */
export default function CanonicalSidebarSection({
  group,
  currentPath,
  collapsed = false,
  onNavigate,
  registryGroup,
}) {
  const { palette, layout, expandedLevel1, toggleLevel1, setExpandedLevel1 } = useCanonicalShell();
  // Use full registry group so contextual parameterized routes still expand the domain.
  const activeChild = findActiveCanonicalNode(currentPath, [registryGroup || group]);
  const open = expandedLevel1.has(group.id) || Boolean(activeChild);

  useEffect(() => {
    if (!activeChild) return;
    setExpandedLevel1((prev) => {
      if (prev.has(group.id)) return prev;
      const next = new Set(prev);
      next.add(group.id);
      return next;
    });
  }, [activeChild, group.id, setExpandedLevel1]);

  return (
    <List
      component="nav"
      disablePadding
      role="group"
      aria-label={group.label}
      sx={{ mb: 0.5 }}
    >
      <ListItemButton
        onClick={() => toggleLevel1(group.id)}
        aria-expanded={open}
        aria-controls={`canonical-section-${group.id}`}
        sx={{
          minHeight: Math.max(layout.sidebarItemHeight, 40),
          mx: 1,
          borderRadius: 1.5,
          color: palette.sidebarTextMuted,
          "&:hover": { bgcolor: palette.sidebarBgHover, color: palette.sidebarText },
          "&:focus-visible": {
            outline: `2px solid ${palette.focusRing}`,
            outlineOffset: 2,
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: "inherit", justifyContent: "center" }}>
          {renderNavIcon(group.icon, { sx: { fontSize: layout.iconSize }, "aria-hidden": true })}
        </ListItemIcon>
        {!collapsed && (
          <>
            <ListItemText
              primary={
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "inherit",
                  }}
                >
                  {group.label}
                </Typography>
              }
            />
            {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </>
        )}
      </ListItemButton>

      <Collapse in={!collapsed && open} timeout="auto" unmountOnExit>
        <List id={`canonical-section-${group.id}`} component="div" disablePadding dense>
          {(group.children || []).map((moduleNode) => (
            <CanonicalSidebarSubmenu
              key={moduleNode.id}
              parent={moduleNode}
              currentPath={currentPath}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </List>
      </Collapse>
    </List>
  );
}
