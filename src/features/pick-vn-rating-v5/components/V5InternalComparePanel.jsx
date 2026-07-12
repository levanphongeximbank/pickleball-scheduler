import { Paper, Stack, Typography } from "@mui/material";

import { toDisplayRating } from "../constants/ratingScale.js";
import { formatPickVnRating } from "../../pick-vn-rating/constants/pickVnRatingScale.js";

export default function V5InternalComparePanel({ v2Rating, v5Result }) {
  if (!v5Result) return null;

  const v5Estimated = toDisplayRating(v5Result.estimated_rating ?? v5Result.rating_before_gates);
  const v5Provisional = v5Result.provisional_display_rating
    ?? toDisplayRating(v5Result.provisional_rating);
  const v2Display = v2Rating?.currentRating != null
    ? formatPickVnRating(v2Rating.currentRating)
    : "—";
  const diff = v2Rating?.currentRating != null && v5Estimated != null
    ? (v5Estimated - Number(v2Rating.currentRating)).toFixed(1)
    : "—";
  const versions = v5Result.versions ?? {};

  return (
    <Paper sx={{ p: 3, bgcolor: "grey.50" }} data-testid="v5-internal-compare-panel">
      <Typography variant="subtitle1" gutterBottom>
        Internal V2 ↔ V5 comparison (kỹ thuật / owner)
      </Typography>
      <Stack spacing={1}>
        <Typography variant="body2">V2 current rating: {v2Display}</Typography>
        <Typography variant="body2">V5 estimated rating: {v5Estimated?.toFixed?.(1) ?? v5Estimated}</Typography>
        <Typography variant="body2">V5 provisional rating: {v5Provisional?.toFixed?.(1) ?? v5Provisional}</Typography>
        <Typography variant="body2">Difference (V5 est − V2): {diff}</Typography>
        <Typography variant="body2">Confidence score: {v5Result.confidence_score ?? "—"}</Typography>
        <Typography variant="body2">
          Applied gates: {(v5Result.applied_gates ?? []).join(", ") || "—"}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          Versions: assessment={versions.assessmentVersion ?? "—"},
          qbank={versions.questionBankVersion ?? "—"},
          scoring={versions.scoringEngineVersion ?? "—"},
          gates={versions.gateVersion ?? "—"},
          reliability={versions.reliabilityVersion ?? "—"},
          calibration={versions.calibrationVersion ?? "—"},
          glossary={versions.glossaryVersion ?? "—"}
        </Typography>
      </Stack>
    </Paper>
  );
}
