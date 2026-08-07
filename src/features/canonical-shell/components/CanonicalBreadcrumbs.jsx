import { Link as RouterLink } from "react-router-dom";
import { Breadcrumbs, Link, Typography } from "@mui/material";

import { useCanonicalShell } from "../hooks/useCanonicalShell.js";

/**
 * Canonical breadcrumbs — registry-driven trail with Wave 4 truncation.
 * Parent zone owns maxWidth; crumbs never expand into the organization selector.
 */
export default function CanonicalBreadcrumbs({ items = [] }) {
  const { palette } = useCanonicalShell();

  if (!items.length) return null;

  const crumbSx = {
    fontSize: 13,
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "inline-block",
    verticalAlign: "bottom",
  };

  return (
    <Breadcrumbs
      aria-label="Đường dẫn điều hướng"
      data-testid="canonical-breadcrumbs"
      sx={{
        fontSize: 13,
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
        "& .MuiBreadcrumbs-ol": {
          flexWrap: "nowrap",
          overflow: "hidden",
        },
        "& .MuiBreadcrumbs-li": {
          minWidth: 0,
          maxWidth: "100%",
          overflow: "hidden",
        },
        "& .MuiBreadcrumbs-separator": { color: palette.textSecondary, flexShrink: 0 },
      }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const title = item.truncated ? undefined : item.label;
        if (isLast || !item.href) {
          return (
            <Typography
              key={item.id || `${item.label}-${index}`}
              color="text.primary"
              title={title}
              aria-current={isLast ? "page" : undefined}
              sx={{ ...crumbSx, fontWeight: isLast ? 600 : 400 }}
            >
              {item.label}
            </Typography>
          );
        }
        return (
          <Link
            key={item.id || `${item.label}-${index}`}
            component={RouterLink}
            to={item.href}
            underline="hover"
            color="inherit"
            title={title}
            sx={{ ...crumbSx, color: palette.textSecondary }}
          >
            {item.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
