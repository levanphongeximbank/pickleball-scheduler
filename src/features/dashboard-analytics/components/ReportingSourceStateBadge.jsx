import { Chip, Stack, Typography } from "@mui/material";

import {
  getReportingPresentationSourceStateLabel,
  REPORTING_PRESENTATION_SOURCE_STATE,
} from "../../reporting-analytics/index.js";

const COLOR_BY_STATE = Object.freeze({
  [REPORTING_PRESENTATION_SOURCE_STATE.LIVE]: "success",
  [REPORTING_PRESENTATION_SOURCE_STATE.MOCK]: "warning",
  [REPORTING_PRESENTATION_SOURCE_STATE.PREVIEW]: "warning",
  [REPORTING_PRESENTATION_SOURCE_STATE.STALE]: "warning",
  [REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE]: "default",
  [REPORTING_PRESENTATION_SOURCE_STATE.LOADING]: "info",
  [REPORTING_PRESENTATION_SOURCE_STATE.EMPTY]: "default",
  [REPORTING_PRESENTATION_SOURCE_STATE.ERROR]: "error",
  [REPORTING_PRESENTATION_SOURCE_STATE.MIXED]: "info",
  [REPORTING_PRESENTATION_SOURCE_STATE.PARTIAL]: "info",
});

/**
 * Source/provenance badge with text label (not color-only).
 */
export default function ReportingSourceStateBadge({ sourceState, freshnessLabel }) {
  const state =
    sourceState?.state || REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE;
  const label =
    sourceState?.label || getReportingPresentationSourceStateLabel(state);
  const reason = sourceState?.reason;
  const observedAt = sourceState?.observedAt || sourceState?.lastSuccessfulRefreshAt;

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      flexWrap="wrap"
      role="status"
      aria-label={`Trạng thái nguồn: ${label}${reason ? `, ${reason}` : ""}`}
    >
      <Chip
        size="small"
        label={label}
        color={COLOR_BY_STATE[state] || "default"}
        variant="outlined"
      />
      {reason && (
        <Typography variant="caption" color="text.secondary" component="span">
          {reason}
        </Typography>
      )}
      {(freshnessLabel || observedAt) && (
        <Typography variant="caption" color="text.secondary" component="span">
          {freshnessLabel || `Cập nhật: ${observedAt}`}
        </Typography>
      )}
    </Stack>
  );
}
