import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";

import { formatDomainList, formatRatingTerm, formatWarningFlag } from "../constants/terminology.js";
import { V5_RATING_STATUS_LABELS } from "../constants/ratingStatus.js";
import { toDisplayRating, toEstimatedRange } from "../constants/ratingScale.js";
import V5ShadowNotice from "./V5ShadowNotice.jsx";

function MetricRow({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Stack>
  );
}

export default function V5AssessmentResults({ result }) {
  if (!result) return null;

  const provisional = result.provisional_display_rating ?? toDisplayRating(result.provisional_rating);
  const estimated = toDisplayRating(result.estimated_rating ?? result.rating_before_gates);
  const confidence = result.confidence_score;
  const range = toEstimatedRange(
    result.estimated_rating ?? result.rating_before_gates,
    result.estimated_error,
  );
  const statusKey = result.rating_status;
  const statusLabel = V5_RATING_STATUS_LABELS[statusKey] ?? statusKey ?? "—";
  const domainScores = result.domain_scores ?? result.item_scores ?? {};
  const domainEntries = Object.entries(domainScores).filter(([, v]) => v != null);
  const isProvisionalCapped = Number(result.provisional_rating) > 4.5 || Number(result.rating_after_gates) > 4.5;

  return (
    <Stack spacing={2} data-testid="v5-assessment-results">
      <V5ShadowNotice />

      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Kết quả đánh giá V5
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Provisional rating là điểm tạm tính — không phải verified rating.
        </Typography>

        <Stack spacing={1.5}>
          <MetricRow
            label="Provisional rating (điểm trình độ tạm tính)"
            value={provisional != null ? provisional.toFixed(1) : "—"}
          />
          <MetricRow
            label="Estimated rating (điểm trình độ ước tính)"
            value={estimated != null ? estimated.toFixed(1) : "—"}
          />
          <MetricRow
            label="Confidence score (điểm độ tin cậy)"
            value={confidence != null ? `${confidence}` : "—"}
          />
          <MetricRow
            label="Estimated range (khoảng trình độ ước tính)"
            value={`${range.low.toFixed(1)} – ${range.high.toFixed(1)}`}
          />
          <MetricRow
            label="Rating status (trạng thái điểm)"
            value={statusLabel}
          />
        </Stack>

        {isProvisionalCapped && (
          <Typography variant="body2" color="warning.main" sx={{ mt: 2 }}>
            Provisional rating hiển thị được giới hạn ở 4.5 cho đến khi có xác minh thêm.
          </Typography>
        )}
      </Paper>

      {domainEntries.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>Domain scores</Typography>
          <Stack spacing={1}>
            {domainEntries.map(([code, score]) => (
              <MetricRow
                key={code}
                label={formatRatingTerm(code)}
                value={Number(score).toFixed(2)}
              />
            ))}
          </Stack>
        </Paper>
      )}

      {Array.isArray(result.limiting_skills) && result.limiting_skills.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>Limiting skills</Typography>
          <Typography variant="body2">{formatDomainList(result.limiting_skills)}</Typography>
        </Paper>
      )}

      {Array.isArray(result.applied_gates) && result.applied_gates.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>Applied gates</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {result.applied_gates.map((gate) => (
              <Chip key={gate} size="small" label={formatRatingTerm(gate)} />
            ))}
          </Box>
        </Paper>
      )}

      {(result.warning_flags?.length > 0 || result.contradiction_flags?.length > 0) && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>Warning / contradiction flags</Typography>
          <Stack spacing={1}>
            {[...(result.warning_flags ?? []), ...(result.contradiction_flags ?? [])].map((flag, index) => (
              <Typography key={index} variant="body2">
                {formatWarningFlag(flag)}
              </Typography>
            ))}
          </Stack>
        </Paper>
      )}

      {result.verification_required && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" color="warning.main">
            Verification required — cần xác minh thêm trước khi nâng trạng thái rating.
          </Typography>
        </Paper>
      )}

      <Divider />
    </Stack>
  );
}
