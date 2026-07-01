import { Box, Card, CardContent, Grid, LinearProgress, Stack, Typography, useTheme } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DashboardEmptyState from "./DashboardEmptyState.jsx";

const PIE_COLORS = ["#1976d2", "#9c27b0", "#2e7d32", "#ed6c02"];

export default function PlayerAnalyticsSection({
  newCustomersSeries = [],
  skillDistribution = [],
  genderDistribution = [],
}) {
  const theme = useTheme();
  const hasData =
    newCustomersSeries.length > 0 ||
    skillDistribution.some((row) => row.count > 0) ||
    genderDistribution.some((row) => row.count > 0);

  if (!hasData) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Phân tích khách / người chơi
          </Typography>
          <DashboardEmptyState
            title="Chưa có dữ liệu người chơi"
            description="Thêm người chơi hoặc booking để phân tích."
          />
        </CardContent>
      </Card>
    );
  }

  const maxSkill = Math.max(...skillDistribution.map((row) => row.count), 1);

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
          Phân tích khách / người chơi
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Khách mới & quay lại theo thời gian
            </Typography>
            <Box sx={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={newCustomersSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="newCustomers" name="Khách mới" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="returningCustomers"
                    name="Quay lại"
                    fill={theme.palette.success.main}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 6, lg: 2.5 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Theo trình độ
            </Typography>
            <StackBars rows={skillDistribution} max={maxSkill} />
          </Grid>

          <Grid size={{ xs: 12, md: 6, lg: 2.5 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Theo giới tính
            </Typography>
            <Box sx={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={genderDistribution}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={3}
                  >
                    {genderDistribution.map((entry, index) => (
                      <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

function StackBars({ rows, max }) {
  return (
    <Stack spacing={1.5}>
      {rows.map((row) => (
        <Box key={row.label}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="caption">{row.label}</Typography>
            <Typography variant="caption" fontWeight="bold">
              {row.count}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.round((row.count / max) * 100)}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      ))}
    </Stack>
  );
}
