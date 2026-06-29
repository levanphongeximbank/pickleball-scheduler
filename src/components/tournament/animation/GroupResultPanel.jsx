import { Box, Button, Paper, Stack, Typography } from "@mui/material";

import { getGroupTheme } from "./animationConfig.js";

function buildTeamsByGroup(steps = [], placedCount = 0, groupLabels = []) {
  const map = {};
  groupLabels.forEach((label) => {
    map[label] = [];
  });

  steps.slice(0, placedCount).forEach((step) => {
    const label = step.groupLabel || "A";
    if (!map[label]) {
      map[label] = [];
    }
    map[label].push(step);
  });

  return map;
}

export default function GroupResultPanel({
  steps = [],
  placedCount = 0,
  groups = [],
  highlightLabel = null,
  showSummary = false,
  matchCount = 0,
  onStartMatchPairing,
}) {
  const groupLabels = groups.length
    ? groups.map((group) => group.label || group.name?.replace("Bảng ", "") || "A")
    : [...new Set(steps.map((step) => step.groupLabel))].filter(Boolean);

  const teamsByGroup = buildTeamsByGroup(steps, placedCount, groupLabels);

  if (showSummary && placedCount >= steps.length) {
    return (
      <Paper variant="outlined" className="draw-summary-panel" sx={{ p: 2, bgcolor: "#f8fafc" }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Kết quả chia bảng
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Hoàn tất — dữ liệu khớp với engine
          {matchCount > 0 ? ` • Sẵn sàng ghép ${matchCount} trận` : ""}
        </Typography>
        <Stack spacing={1.5}>
          {groupLabels.map((label) => {
            const theme = getGroupTheme(label);
            const items = teamsByGroup[label] || [];

            return (
              <Paper
                key={label}
                variant="outlined"
                sx={{ p: 1.25, borderColor: theme.main, bgcolor: theme.light }}
              >
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: theme.main, mb: 0.75 }}>
                  {theme.label} ({items.length})
                </Typography>
                <Stack spacing={0.5}>
                  {items.map((step) => (
                    <Typography key={step.team.id} variant="body2">
                      • {step.team.name}
                    </Typography>
                  ))}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
        {onStartMatchPairing && matchCount > 0 && (
          <Button
            variant="contained"
            color="secondary"
            size="large"
            fullWidth
            sx={{ mt: 2 }}
            onClick={onStartMatchPairing}
          >
            Ghép cặp thi đấu ({matchCount} trận)
          </Button>
        )}
      </Paper>
    );
  }

  return (
    <Stack spacing={1} className="draw-group-panel">
      <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
        Kết quả bảng
      </Typography>
      {groupLabels.map((label) => {
        const theme = getGroupTheme(label);
        const items = teamsByGroup[label] || [];
        const highlighted = highlightLabel === label;

        return (
          <Paper
            key={label}
            variant="outlined"
            sx={{
              p: 1,
              borderColor: highlighted ? theme.main : "divider",
              borderWidth: highlighted ? 2 : 1,
              bgcolor: highlighted ? theme.light : "background.paper",
              transition: "all 0.35s ease",
            }}
          >
            <Typography variant="caption" fontWeight="bold" sx={{ color: theme.main }}>
              {theme.label}
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5, maxHeight: 120, overflow: "auto" }}>
              {items.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Chưa có đội
                </Typography>
              ) : (
                items.map((step, index) => (
                  <Box
                    key={`${step.team.id}-${index}`}
                    className="draw-group-team-chip"
                    sx={{
                      px: 0.75,
                      py: 0.4,
                      borderRadius: 1,
                      bgcolor: "background.paper",
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="caption" noWrap title={step.team.name}>
                      {step.team.name}
                    </Typography>
                  </Box>
                ))
              )}
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
