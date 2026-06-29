import { useEffect, useRef, useState } from "react";
import { Paper, Stack, Typography } from "@mui/material";

import DailyMatchCard from "./DailyMatchCard.jsx";

export default function DailyMatchListPanel({
  steps = [],
  revealedCount = 0,
  highlightLatest = true,
}) {
  const revealedSteps = steps.slice(0, revealedCount);
  const [newMatchId, setNewMatchId] = useState(null);
  const prevCountRef = useRef(revealedCount);

  useEffect(() => {
    if (revealedCount > prevCountRef.current) {
      const latest = steps[revealedCount - 1];
      if (latest?.matchId) {
        setNewMatchId(latest.matchId);
        const timer = setTimeout(() => setNewMatchId(null), 2000);
        prevCountRef.current = revealedCount;
        return () => clearTimeout(timer);
      }
    }

    prevCountRef.current = revealedCount;
    return undefined;
  }, [revealedCount, steps]);

  return (
    <Paper variant="outlined" className="daily-fair-panel daily-fair-panel--matches" sx={{ p: 1.25, height: "100%" }}>
      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
        Trận đã tạo ({revealedSteps.length})
      </Typography>

      <Stack spacing={0.75} sx={{ maxHeight: 480, overflow: "auto" }}>
        {revealedSteps.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            Chưa có trận nào được tạo.
          </Typography>
        ) : (
          revealedSteps.map((step, index) => (
            <DailyMatchCard
              key={step.matchId || index}
              step={step}
              index={index}
              revealedCount={revealedCount}
              isLatest={highlightLatest && index === revealedSteps.length - 1}
              isNew={step.matchId === newMatchId}
            />
          ))
        )}
      </Stack>
    </Paper>
  );
}
