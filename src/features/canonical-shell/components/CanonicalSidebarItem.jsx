import { NavLink as RouterNavLink } from "react-router-dom";
import { Box, ListItemButton, ListItemIcon, ListItemText, Tooltip, Typography } from "@mui/material";

import { useCanonicalShell } from "../hooks/useCanonicalShell.js";
import { renderNavIcon } from "../utils/resolveNavIcon.jsx";

/**
 * Leaf Level-2/Level-3 sidebar item with active-route highlighting.
 */
export default function CanonicalSidebarItem({
  node,
  active = false,
  collapsed = false,
  depth = 1,
  onNavigate,
}) {
  const { palette, layout } = useCanonicalShell();

  const button = (
    <ListItemButton
      component={node.route ? RouterNavLink : "div"}
      to={node.route || undefined}
      onClick={onNavigate}
      selected={active}
      aria-current={active ? "page" : undefined}
      aria-label={node.label}
      sx={{
        minHeight: Math.max(layout.sidebarItemHeight, layout.touchTargetMin - 4),
        mx: 1,
        mb: 0.25,
        borderRadius: 1.5,
        pl: collapsed ? 1.25 : 1.25 + depth * 0.75,
        pr: 1,
        color: palette.sidebarText,
        position: "relative",
        "&.Mui-selected": {
          bgcolor: palette.sidebarActive,
          color: "#FFFFFF",
          "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: "0 2px 2px 0",
            bgcolor: palette.sidebarAccent,
          },
          "&:hover": { bgcolor: palette.sidebarActive },
        },
        "&:hover": { bgcolor: palette.sidebarBgHover },
        "&:focus-visible": {
          outline: `2px solid ${palette.focusRing}`,
          outlineOffset: 2,
        },
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: "inherit", justifyContent: "center" }}>
        {renderNavIcon(node.icon, { sx: { fontSize: layout.iconSize }, "aria-hidden": true })}
      </ListItemIcon>
      {!collapsed && (
        <ListItemText
          primary={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
              <Typography
                component="span"
                sx={{
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  lineHeight: 1.3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {node.label}
              </Typography>
              {node.badge?.label ? (
                <Typography
                  component="span"
                  sx={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: palette.sidebarTextMuted,
                    flexShrink: 0,
                  }}
                >
                  {node.badge.label}
                </Typography>
              ) : null}
            </Box>
          }
        />
      )}
    </ListItemButton>
  );

  if (!collapsed) return button;

  return (
    <Tooltip title={node.label} placement="right" enterDelay={400}>
      <Box component="span" sx={{ display: "block" }}>
        {button}
      </Box>
    </Tooltip>
  );
}
