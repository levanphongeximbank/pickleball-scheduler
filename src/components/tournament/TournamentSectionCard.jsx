import { Card, CardContent, Stack, Typography } from "@mui/material";

import {
  tournamentCardContentSx,
  tournamentCardSx,
  tournamentSectionTitleSx,
} from "./tournamentLayout.js";

export default function TournamentSectionCard({
  title,
  subtitle,
  badge,
  headerAction,
  children,
  sx,
  contentSx,
  noPadding = false,
}) {
  return (
    <Card variant="outlined" elevation={0} sx={{ ...tournamentCardSx, ...sx }}>
      {(title || subtitle || badge || headerAction) && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
          sx={{
            px: tournamentCardContentSx.p,
            pt: tournamentCardContentSx.p,
            pb: 0,
          }}
        >
          <Stack spacing={0.25}>
            {title ? <Typography sx={tournamentSectionTitleSx}>{title}</Typography> : null}
            {subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Stack>
          {headerAction || badge}
        </Stack>
      )}
      <CardContent
        sx={{
          ...(noPadding ? { p: 0, "&:last-child": { pb: 0 } } : tournamentCardContentSx),
          ...contentSx,
        }}
      >
        {children}
      </CardContent>
    </Card>
  );
}
