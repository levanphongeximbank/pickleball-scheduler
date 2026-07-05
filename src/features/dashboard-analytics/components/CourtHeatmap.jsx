import { useMemo, useState } from "react";

import { Box, Card, CardContent, Stack, Tooltip, Typography } from "@mui/material";
import GridViewIcon from "@mui/icons-material/GridView";

import { formatCurrency } from "../services/dashboardService.js";
import DashboardEmptyState, { LEVEL_COLORS, LEVEL_LABELS } from "./DashboardEmptyState.jsx";
import {
  DASHBOARD_LAYOUT,
  dashboardCardContentSx,
  dashboardCardSx,
  dashboardSectionTitleSx,
} from "../constants/dashboardLayout.js";

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
      <Card variant="outlined" sx={dashboardCardSx}>
        <CardContent sx={dashboardCardContentSx}>
          <Typography sx={{ ...dashboardSectionTitleSx, mb: 2 }}>Đặt sân theo khung giờ</Typography>
          <DashboardEmptyState
            title="Chưa có dữ liệu heatmap"
            description="Cần booking theo khung giờ để hiển thị ma trận."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ ...dashboardCardSx, minHeight: DASHBOARD_LAYOUT.analyticsMinHeight }}>
      <CardContent sx={dashboardCardContentSx}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
          <GridViewIcon color="primary" sx={{ fontSize: 18 }} />
          <Typography sx={dashboardSectionTitleSx}>Đặt sân theo khung giờ</Typography>
        </Stack>

        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: 0 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: `52px repeat(${hours.length}, minmax(18px, 1fr))`,
                gap: 0.4,
                mb: 0.75,
              }}
            >
              <Box />
              {hours.map((hour) => (
                <Typography
                  key={hour}
                  variant="caption"
                  sx={{ textAlign: "center", color: "text.secondary", fontSize: 10 }}
                >
                  {String(hour).padStart(2, "0")}
                </Typography>
              ))}
            </Box>

            {weekdays.map((weekday, dayIndex) => (
              <Box
                key={weekday}
                sx={{
                  display: "grid",
                  gridTemplateColumns: `52px repeat(${hours.length}, minmax(18px, 1fr))`,
                  gap: 0.4,
                  mb: 0.4,
                }}
              >
                <Typography variant="caption" fontWeight={600} sx={{ alignSelf: "center", fontSize: 11 }}>
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
                          height: 22,
                          borderRadius: 0.5,
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

        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", gap: 0.5 }}>
          {Object.entries(LEVEL_LABELS).map(([level, label]) => (
            <Stack key={level} direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: LEVEL_COLORS[level] }} />
              <Typography variant="caption" sx={{ fontSize: 10 }}>
                {label}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
