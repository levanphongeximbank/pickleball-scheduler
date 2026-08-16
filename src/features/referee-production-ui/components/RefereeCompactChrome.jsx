import { Link as RouterLink } from "react-router-dom";
import { IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

/**
 * Slim referee-only top chrome — keeps shell menu access without
 * dominating the dedicated My Assignments / Match workspace.
 */
export default function RefereeCompactChrome({
  onMenuClick,
  title = "Trọng tài",
  showBack = false,
  backTo = "/referee",
}) {
  return (
    <header className="rp-compact-chrome" data-testid="referee-compact-chrome">
      <div className="rp-compact-chrome-left">
        {showBack ? (
          <IconButton
            component={RouterLink}
            to={backTo}
            size="small"
            aria-label="Quay lại danh sách trận"
            data-testid="referee-chrome-back"
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        ) : null}
        {typeof onMenuClick === "function" ? (
          <IconButton
            size="small"
            onClick={onMenuClick}
            aria-label="Mở menu"
            data-testid="referee-chrome-menu"
          >
            <MenuIcon fontSize="small" />
          </IconButton>
        ) : null}
      </div>
      <p className="rp-compact-chrome-title">{title}</p>
      <span className="rp-compact-chrome-spacer" aria-hidden="true" />
    </header>
  );
}
