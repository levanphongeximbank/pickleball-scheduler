import { useMemo, useState } from "react";

import { Box, Card, CardContent, Stack, Tooltip, Typography } from "@mui/material";
import GridViewIcon from "@mui/icons-material/GridView";

import { formatCurrency } from "../services/dashboardService.js";
import DashboardEmptyState, { LEVEL_COLORS, LEVEL_LABELS } from "./DashboardEmptyState.jsx";

export default function CourtHeatmap({ heatmap }) {
  const [hoverCell, setHoverCell] = useState(null);

  const { weekdays = [], hours = [], cells = [] } = heatmap || {};

  const cellMap = useMemo(() => {
    const map = new Map();
    cells.forEach((cell) => {
      map.set(`${cell.dayIndex}-${cell.hour}`, cell);
    });
    return map;
  }, [cells]);

  if (!cells.length) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Heatmap sử dụng sân
          </Typography>
          <DashboardEmptyState
            title="Chưa có dữ liệu heatmap"
            description="Cần booking theo khung giờ để hiển thị ma trận."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
          <GridViewIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            Heatmap sử dụng sân
          </Typography>
        </Stack>

        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: 560 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: `72px repeat(${hours.length}, minmax(28px, 1fr))`,
                gap: 0.5,
                mb: 1,
              }}
            >
              <Box />
              {hours.map((hour) => (
                <Typography
                  key={hour}
                  variant="caption"
                  sx={{ textAlign: "center", color: "text.secondary" }}
                >
                  {String(hour).padStart(2, "0")}h
                </Typography>
              ))}
            </Box>

            {weekdays.map((weekday, dayIndex) => (
              <Box
                key={weekday}
                sx={{
                  display: "grid",
                  gridTemplateColumns: `72px repeat(${hours.length}, minmax(28px, 1fr))`,
                  gap: 0.5,
                  mb: 0.5,
                }}
              >
                <Typography variant="caption" fontWeight="bold" sx={{ alignSelf: "center" }}>
                  {weekday}
                </Typography>
                {hours.map((hour) => {
                  const cell = cellMap.get(`${dayIndex}-${hour}`);
                  const level = cell?.level || "low";
                  return (
                    <Tooltip
                      key={`${weekday}-${hour}`}
                      title={
                        cell ? (
                          <Box>
                            <Typography variant="caption" sx={{ display: "block" }}>
                              {cell.weekday} • {cell.hourLabel}
                            </Typography>
                            <Typography variant="caption" sx={{ display: "block" }}>
                              {cell.bookings} lượt • {cell.fillPercent}% lấp đầy
                            </Typography>
                            <Typography variant="caption" sx={{ display: "block" }}>
                              {formatCurrency(cell.revenue)}
                            </Typography>
                            <Typography variant="caption">{LEVEL_LABELS[level]}</Typography>
                          </Box>
                        ) : ""
                      }
                    >
                      <Box
                        onMouseEnter={() => setHoverCell(cell)}
                        onMouseLeave={() => setHoverCell(null)}
                        sx={{
                          height: 28,
                          borderRadius: 0.75,
                          bgcolor: LEVEL_COLORS[level],
                          border: hoverCell === cell ? "2px solid" : "1px solid transparent",
                          borderColor: hoverCell === cell ? "primary.main" : "transparent",
                          cursor: "pointer",
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>

        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
          {Object.entries(LEVEL_LABELS).map(([level, label]) => (
            <Stack key={level} direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: LEVEL_COLORS[level] }} />
              <Typography variant="caption">{label}</Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
