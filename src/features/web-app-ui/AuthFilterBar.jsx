/**
 * AuthFilterBar — authenticated filter composition slot (Wave 2 Batch 2D).
 *
 * Domain owns filter values and query semantics. This is layout only.
 *
 * @ownership AUTHENTICATED_SHARED
 */

import { Box, Stack, Typography } from "@mui/material";

/**
 * @param {object} props
 * @param {import('react').ReactNode} [props.search]
 * @param {import('react').ReactNode} [props.filters]
 * @param {import('react').ReactNode} [props.dateControls]
 * @param {import('react').ReactNode} [props.resetAction]
 * @param {import('react').ReactNode} [props.secondaryActions]
 * @param {string|number} [props.resultCount]
 * @param {string} [props.resultCountLabel]
 */
export default function AuthFilterBar({
  search = null,
  filters = null,
  dateControls = null,
  resetAction = null,
  secondaryActions = null,
  resultCount,
  resultCountLabel = "kết quả",
  sx = {},
}) {
  return (
    <Box
      component="section"
      aria-label="Bộ lọc"
      data-testid="auth-filter-bar"
      sx={{
        mb: 2,
        width: "100%",
        minWidth: 0,
        ...sx,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        useFlexGap
        flexWrap="wrap"
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ width: "100%" }}
      >
        {search ? <Box sx={{ flex: { md: "1 1 220px" }, minWidth: 0 }}>{search}</Box> : null}
        {filters ? (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            sx={{ flex: { md: "2 1 280px" }, minWidth: 0 }}
          >
            {filters}
          </Stack>
        ) : null}
        {dateControls ? <Box sx={{ minWidth: 0 }}>{dateControls}</Box> : null}
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          sx={{ ml: { md: "auto" } }}
        >
          {typeof resultCount === "number" || typeof resultCount === "string" ? (
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {resultCount} {resultCountLabel}
            </Typography>
          ) : null}
          {resetAction}
          {secondaryActions}
        </Stack>
      </Stack>
    </Box>
  );
}
