import { Box, Breadcrumbs, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { CLUB_PAGE_MAX_WIDTH, clubPagePadding } from "./clubUiTokens.js";

/**
 * Consistent page shell: breadcrumb + title + subtitle + actions.
 * Does not alter route guards or menu matrix (42L).
 */
export default function ClubPageShell({
  title,
  subtitle,
  breadcrumbs = [],
  actions = null,
  children,
  maxWidth = CLUB_PAGE_MAX_WIDTH,
  sx = {},
}) {
  return (
    <Box sx={{ p: clubPagePadding, maxWidth, mx: "auto", ...sx }}>
      {breadcrumbs.length > 0 && (
        <Breadcrumbs aria-label="Điều hướng CLB" sx={{ mb: 1.5 }}>
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            if (isLast || !crumb.href) {
              return (
                <Typography key={crumb.label} color="text.primary" fontWeight={isLast ? 600 : 400}>
                  {crumb.label}
                </Typography>
              );
            }
            return (
              <Link
                key={crumb.label}
                component={RouterLink}
                to={crumb.href}
                underline="hover"
                color="inherit"
              >
                {crumb.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography component="h1" variant="h5" fontWeight={700}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
      </Stack>

      {children}
    </Box>
  );
}
