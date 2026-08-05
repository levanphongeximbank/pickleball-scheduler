import { Collapse, List } from "@mui/material";

import CanonicalSidebarItem from "./CanonicalSidebarItem.jsx";
import { isCanonicalRouteActive } from "../services/matchCanonicalRoute.js";
import { useCanonicalShell } from "../hooks/useCanonicalShell.js";

/**
 * Level-3 submenu under a Level-2 module.
 */
export default function CanonicalSidebarSubmenu({
  parent,
  currentPath,
  collapsed = false,
  onNavigate,
}) {
  const { expandedLevel2, toggleLevel2 } = useCanonicalShell();
  const open = expandedLevel2.has(parent.id) || parent.children?.some((c) => isCanonicalRouteActive(currentPath, c));
  const parentActive = isCanonicalRouteActive(currentPath, parent);

  if (!parent.children?.length) {
    return (
      <CanonicalSidebarItem
        node={parent}
        active={parentActive}
        collapsed={collapsed}
        depth={1}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <>
      <CanonicalSidebarItem
        node={{ ...parent, route: undefined }}
        active={parentActive || open}
        collapsed={collapsed}
        depth={1}
        onNavigate={() => toggleLevel2(parent.id)}
      />
      <Collapse in={!collapsed && open} timeout="auto" unmountOnExit>
        <List
          component="div"
          disablePadding
          role="group"
          aria-label={parent.label}
          dense
        >
          {parent.children.map((child) => (
            <CanonicalSidebarItem
              key={child.id}
              node={child}
              active={isCanonicalRouteActive(currentPath, child)}
              collapsed={collapsed}
              depth={2}
              onNavigate={onNavigate}
            />
          ))}
        </List>
      </Collapse>
    </>
  );
}
