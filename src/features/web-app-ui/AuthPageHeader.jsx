/**
 * AuthPageHeader — authenticated page-level header (Wave 2 Batch 2D).
 *
 * Below CanonicalTopBar (Wave 1 chrome). Not domain-aware.
 * Adapted from ClubPageShell header slice (no club maxWidth/padding shell).
 *
 * @ownership AUTHENTICATED_SHARED
 */

import { Box, Breadcrumbs, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {{ label: string, href?: string }[]} [props.breadcrumbs]
 * @param {import('react').ReactNode} [props.status]
 * @param {import('react').ReactNode} [props.primaryAction]
 * @param {import('react').ReactNode} [props.secondaryActions]
 * @param {import('react').ReactNode} [props.context]
 */
export default function AuthPageHeader({
  title,
  subtitle,
  breadcrumbs = [],
  status = null,
  primaryAction = null,
  secondaryActions = null,
  context = null,
  sx = {},
}) {
  const hasActions = Boolean(primaryAction || secondaryActions);

  return (
    <Box
      component="header"
      data-testid="auth-page-header"
      sx={{
        mb: 2,
        width: "100%",
        minWidth: 0,
        ...sx,
      }}
    >
      {breadcrumbs.length > 0 ? (
        <Breadcrumbs aria-label="Đường dẫn trang" sx={{ mb: 1.5 }}>
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            if (isLast || !crumb.href) {
              return (
                <Typography
                  key={`${crumb.label}-${index}`}
                  color="text.primary"
                  fontWeight={isLast ? 600 : 400}
                >
                  {crumb.label}
                </Typography>
              );
            }
            return (
              <Link
                key={`${crumb.label}-${index}`}
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
      ) : null}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        spacing={2}
        useFlexGap
        sx={{ width: "100%", minWidth: 0 }}
      >
        <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: subtitle ? 0.5 : 0 }}
          >
            <Typography
              component="h1"
              variant="h5"
              fontWeight={700}
              sx={{ wordBreak: "break-word" }}
            >
              {title}
            </Typography>
            {status}
          </Stack>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
          {context ? <Box sx={{ mt: 1 }}>{context}</Box> : null}
        </Box>

        {hasActions ? (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            justifyContent={{ xs: "flex-start", sm: "flex-end" }}
            sx={{
              flexShrink: 0,
              maxWidth: "100%",
              /* Keep primary reachable on narrow viewports; secondaries wrap */
              "& > *:first-of-type": {
                order: { xs: 0, sm: 0 },
              },
            }}
          >
            {primaryAction}
            {secondaryActions}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
