import { Link as RouterLink } from "react-router-dom";
import { Breadcrumbs, Link, Typography } from "@mui/material";

import { useCanonicalShell } from "../hooks/useCanonicalShell.js";

/**
 * Canonical breadcrumbs foundation — registry-driven trail.
 */
export default function CanonicalBreadcrumbs({ items = [] }) {
  const { palette } = useCanonicalShell();

  if (!items.length) return null;

  return (
    <Breadcrumbs
      aria-label="Đường dẫn điều hướng"
      sx={{
        fontSize: 13,
        "& .MuiBreadcrumbs-separator": { color: palette.textSecondary },
        maxWidth: { xs: 160, sm: 280, md: 420 },
        overflow: "hidden",
      }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        if (isLast || !item.href) {
          return (
            <Typography
              key={item.id || item.label}
              color="text.primary"
              sx={{ fontSize: 13, fontWeight: isLast ? 600 : 400 }}
              aria-current={isLast ? "page" : undefined}
            >
              {item.label}
            </Typography>
          );
        }
        return (
          <Link
            key={item.id || item.label}
            component={RouterLink}
            to={item.href}
            underline="hover"
            color="inherit"
            sx={{ fontSize: 13, color: palette.textSecondary }}
          >
            {item.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
