/**
 * Wave 1 Batch 1C — Help control for CanonicalTopBar.
 * Reuses Header Help icon pattern; destination is support hub only.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { IconButton, Tooltip } from "@mui/material";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";

import { useAuth } from "../../../context/AuthContext.jsx";
import { canAccessRoute } from "../../../auth/menuAccess.js";
import { useCanonicalShell } from "../hooks/useCanonicalShell.js";

export const CANONICAL_HELP_TARGET = "/support";

export default function CanonicalHelpButton() {
  const navigate = useNavigate();
  const { palette, layout } = useCanonicalShell();
  const { can, rbacEnabled, isAuthenticated, user } = useAuth();

  const allowed = useMemo(() => {
    // RBAC off: Help chrome mirrors legacy Header affordance (destination still /support).
    if (!rbacEnabled) return true;
    if (!isAuthenticated || !user) return false;
    return canAccessRoute(can, CANONICAL_HELP_TARGET, {}, user);
  }, [isAuthenticated, user, rbacEnabled, can]);

  if (!allowed) {
    return null;
  }

  return (
    <Tooltip title="Hỗ trợ">
      <IconButton
        aria-label="Hỗ trợ"
        data-testid="canonical-help-button"
        data-help-target={CANONICAL_HELP_TARGET}
        onClick={() => navigate(CANONICAL_HELP_TARGET)}
        sx={{
          minWidth: layout.touchTargetMin,
          minHeight: layout.touchTargetMin,
          color: palette.textSecondary,
          "&:focus-visible": {
            outline: `2px solid ${palette.focusRing}`,
            outlineOffset: 2,
          },
        }}
      >
        <HelpOutlineOutlinedIcon />
      </IconButton>
    </Tooltip>
  );
}
