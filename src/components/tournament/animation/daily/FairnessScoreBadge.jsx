import { Paper, Typography } from "@mui/material";

import { getFairnessTier, hasFairnessScore } from "./dailyFairMatchUtils.js";

export default function FairnessScoreBadge({ match, balancePercent }) {
  const hasScore = hasFairnessScore(match);
  const percent = hasScore ? balancePercent : null;
  const tier = getFairnessTier(percent);

  return (
    <Paper
      variant="outlined"
      className={`daily-fairness-badge daily-fairness-badge--${tier.tone}`}
    >
      <Typography variant="caption" className="daily-fairness-badge__label">
        Độ cân bằng
      </Typography>
      <Typography variant="h4" fontWeight={800} className="daily-fairness-badge__score">
        {percent != null ? `${percent}%` : "—"}
      </Typography>
      <Typography variant="body2" fontWeight={700} className="daily-fairness-badge__tier">
        {tier.label}
      </Typography>
      {tier.sublabel ? (
        <Typography variant="caption" color="text.secondary">
          {tier.sublabel}
        </Typography>
      ) : null}
    </Paper>
  );
}
