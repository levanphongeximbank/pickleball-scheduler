import { Box, Paper, Stack, Typography } from "@mui/material";

import StatusBadge from "../animation/shared/StatusBadge.jsx";

export default function BracketRightPanel({ pendingMatches = [], advancingTeams = [] }) {
  return (
    <Stack spacing={1.5} className="tournament-bracket-right">
      <Paper variant="outlined" className="tournament-anim-panel" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
          Trận chưa có kết quả
        </Typography>
        {pendingMatches.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Tất cả các trận đã hoàn tất
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {pendingMatches.map((match) => (
              <Box key={match.id} className="tournament-result-card">
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  {match.code} • {match.roundDisplay}
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ wordBreak: "break-word" }}>
                  {match.home.name} vs {match.away.name}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" className="tournament-anim-panel" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
          Đội đã vào vòng sau
        </Typography>
        {advancingTeams.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chưa có đội đi tiếp
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {advancingTeams.map((item) => (
              <Box key={item.id} className="tournament-result-card tournament-result-card--latest">
                <Typography variant="body2" fontWeight={700} sx={{ wordBreak: "break-word" }}>
                  {item.teamName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  → {item.toRoundDisplay}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" className="tournament-anim-panel" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
          Chú thích
        </Typography>
        <Stack spacing={0.75}>
          <LegendItem label="Đã hoàn thành" tone="success" />
          <LegendItem label="Đang thi đấu" tone="active" />
          <LegendItem label="Chưa thi đấu" tone="default" />
          <Box className="tournament-bracket-legend-dash">
            <Typography variant="caption" color="text.secondary">
              Đường đi đội thua / tranh hạng ba
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}

function LegendItem({ label, tone }) {
  return <StatusBadge label={label} tone={tone} />;
}
