import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PermissionGate from "../../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";

export default function TournamentStatsPanel({
  completedResultSessions,
  matchOutcomeStats,
  operationalMetrics,
  trendPoints,
  trendPath,
  trendSummary,
  waitingTrendPoints,
  waitingTrendPath,
  waitingTrendMaxY,
  rounds,
  selectedCompareRoundA,
  onSelectedCompareRoundAChange,
  selectedCompareRoundB,
  onSelectedCompareRoundBChange,
  waitingAlertThreshold,
  onWaitingAlertThresholdChange,
  onExportCompareCsv,
  compareWinner,
  compareRoundAName,
  compareRoundBName,
  compareRoundAMetrics,
  compareRoundBMetrics,
  compareRoundAGrade,
  compareRoundBGrade,
  fairnessMetrics,
  fairnessLevel,
}) {
  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              🏅 Bảng thắng/thua theo kết quả vòng
            </Typography>

            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
              <Chip label={`Phiên hoàn tất: ${completedResultSessions}`} color="success" />
              <Chip label={`Người có dữ liệu kết quả: ${matchOutcomeStats.length}`} color="info" />
            </Stack>

            {matchOutcomeStats.length === 0 ? (
              <Typography color="text.secondary">
                Chưa có dữ liệu kết quả vòng hoàn tất để tính thắng/thua.
              </Typography>
            ) : (
              matchOutcomeStats.slice(0, 16).map((item, index) => (
                <Box key={item.id} sx={{ py: 0.8 }}>
                  <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
                    <Typography fontWeight="bold">#{index + 1} {item.name}</Typography>
                    <Chip label={`${item.winRate}% thắng`} color={item.winRate >= 60 ? "success" : item.winRate >= 40 ? "warning" : "default"} size="small" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    W-L-D: {item.wins}-{item.losses}-{item.draws} • Trận: {item.totalMatches} • Điểm: {item.pointsFor}/{item.pointsAgainst} (diff {item.pointDiff >= 0 ? "+" : ""}{item.pointDiff})
                  </Typography>
                  <Divider sx={{ mt: 1 }} />
                </Box>
              ))
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              📌 Dashboard vận hành
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="subtitle2" color="text.secondary">Tổng phiên</Typography>
                <Typography variant="h5" fontWeight="bold">{operationalMetrics.totalSessions}</Typography>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="subtitle2" color="text.secondary">AI score TB</Typography>
                <Typography variant="h5" fontWeight="bold" color="primary.main">{operationalMetrics.avgAIScore}</Typography>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="subtitle2" color="text.secondary">Người chờ TB</Typography>
                <Typography variant="h5" fontWeight="bold" color="warning.main">{operationalMetrics.avgWaiting}</Typography>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="subtitle2" color="text.secondary">Tổng lượt sân</Typography>
                <Typography variant="h5" fontWeight="bold" color="success.main">{operationalMetrics.totalCourtsUsed}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
              📈 Xu hướng AI score theo thời gian
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Dựa trên {trendPoints.length} phiên gần nhất sau lọc. Trục dọc là điểm AI từ 0 đến 100.
            </Typography>

            {trendPoints.length === 0 ? (
              <Typography color="text.secondary">Không có phiên nào để vẽ biểu đồ.</Typography>
            ) : (
              <>
                <Box sx={{ width: "100%", overflowX: "auto", border: "1px solid", borderColor: "grey.300", borderRadius: 2, p: 1, mb: 1.5 }}>
                  <svg width="100%" viewBox="0 0 720 220" role="img" aria-label="AI score trend">
                    <line x1="24" y1="196" x2="696" y2="196" stroke="#cfd8dc" strokeWidth="1" />
                    <line x1="24" y1="24" x2="24" y2="196" stroke="#cfd8dc" strokeWidth="1" />
                    <line x1="24" y1="24" x2="696" y2="24" stroke="#eceff1" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="24" y1="110" x2="696" y2="110" stroke="#eceff1" strokeWidth="1" strokeDasharray="4 4" />

                    <path d={trendPath} fill="none" stroke="#1976d2" strokeWidth="2.5" />

                    {trendPoints.map((point, index) => {
                      const x = 24 + (trendPoints.length > 1 ? (672 / (trendPoints.length - 1)) * index : 336);
                      const y = 196 - (Math.max(0, Math.min(100, point.y)) / 100) * 172;

                      return (
                        <g key={`${point.label}-${index}`}>
                          <circle cx={x} cy={y} r="3" fill="#1565c0" />
                        </g>
                      );
                    })}

                    <text x="8" y="28" fontSize="10" fill="#607d8b">100</text>
                    <text x="10" y="114" fontSize="10" fill="#607d8b">50</text>
                    <text x="12" y="200" fontSize="10" fill="#607d8b">0</text>
                  </svg>
                </Box>

                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  <Chip
                    label={`Xu hướng: ${trendSummary.delta > 0 ? "+" : ""}${trendSummary.delta}`}
                    color={trendSummary.delta >= 0 ? "success" : "error"}
                  />
                  <Chip label={`Best: ${trendSummary.best}`} color="primary" />
                  <Chip label={`Worst: ${trendSummary.worst}`} color="warning" />
                </Stack>
              </>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
              👥 Xu hướng số người chờ theo thời gian
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Dựa trên {waitingTrendPoints.length} phiên gần nhất sau lọc.
            </Typography>

            {waitingTrendPoints.length === 0 ? (
              <Typography color="text.secondary">Không có phiên nào để vẽ biểu đồ người chờ.</Typography>
            ) : (
              <Box sx={{ width: "100%", overflowX: "auto", border: "1px solid", borderColor: "grey.300", borderRadius: 2, p: 1, mb: 1.5 }}>
                <svg width="100%" viewBox="0 0 720 220" role="img" aria-label="Waiting trend">
                  <line x1="24" y1="196" x2="696" y2="196" stroke="#cfd8dc" strokeWidth="1" />
                  <line x1="24" y1="24" x2="24" y2="196" stroke="#cfd8dc" strokeWidth="1" />
                  <path d={waitingTrendPath} fill="none" stroke="#ef6c00" strokeWidth="2.5" />

                  {waitingTrendPoints.map((point, index) => {
                    const x = 24 + (waitingTrendPoints.length > 1 ? (672 / (waitingTrendPoints.length - 1)) * index : 336);
                    const y = 196 - (Math.max(0, Math.min(waitingTrendMaxY, point.y)) / waitingTrendMaxY) * 172;

                    return <circle key={`${point.label}-${index}`} cx={x} cy={y} r="3" fill="#e65100" />;
                  })}

                  <text x="8" y="28" fontSize="10" fill="#607d8b">{waitingTrendMaxY}</text>
                  <text x="12" y="200" fontSize="10" fill="#607d8b">0</text>
                </svg>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              ⚖️ So sánh 2 round
            </Typography>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Round A</InputLabel>
                <Select
                  label="Round A"
                  value={selectedCompareRoundA}
                  onChange={(event) => onSelectedCompareRoundAChange(event.target.value)}
                >
                  <MenuItem value="all">Chọn Round A</MenuItem>
                  {rounds.map((round) => (
                    <MenuItem key={`A-${round.id}`} value={String(round.id)}>
                      {round.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Round B</InputLabel>
                <Select
                  label="Round B"
                  value={selectedCompareRoundB}
                  onChange={(event) => onSelectedCompareRoundBChange(event.target.value)}
                >
                  <MenuItem value="all">Chọn Round B</MenuItem>
                  {rounds.map((round) => (
                    <MenuItem key={`B-${round.id}`} value={String(round.id)}>
                      {round.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                size="small"
                type="number"
                label="Ngưỡng cảnh báo chờ"
                value={waitingAlertThreshold}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (Number.isNaN(nextValue)) {
                    return;
                  }
                  onWaitingAlertThresholdChange(Math.max(0, nextValue));
                }}
                sx={{ width: 200 }}
              />

              <PermissionGate permission={PERMISSIONS.STATISTICS_EXPORT}>
                <Button variant="outlined" onClick={onExportCompareCsv}>
                  Xuất CSV so sánh
                </Button>
              </PermissionGate>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
              {compareWinner.winner === "A" && <Chip color="success" label={`Round tốt hơn: ${compareRoundAName}`} />}
              {compareWinner.winner === "B" && <Chip color="success" label={`Round tốt hơn: ${compareRoundBName}`} />}
              {compareWinner.winner === "tie" && <Chip color="info" label="Kết quả: hòa" />}
              {compareWinner.winner === null && <Chip color="default" label="Cần thêm dữ liệu" />}
              <Chip color="default" label={compareWinner.reason} />
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography fontWeight="bold">{compareRoundAName}</Typography>
                    <Typography variant="body2" color="text.secondary">Sessions: {compareRoundAMetrics.sessionCount}</Typography>
                    <Typography variant="body2" color="text.secondary">AI TB: {compareRoundAMetrics.avgAIScore}</Typography>
                    <Typography variant="body2" color="text.secondary">Chờ TB: {compareRoundAMetrics.avgWaiting}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                      <Chip label={`Grade: ${compareRoundAGrade}`} color={compareRoundAGrade === "A" || compareRoundAGrade === "B" ? "success" : compareRoundAGrade === "C" ? "warning" : "error"} size="small" />
                      {compareRoundAMetrics.avgWaiting > waitingAlertThreshold && (
                        <Chip label="Cảnh báo chờ cao" color="error" size="small" />
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography fontWeight="bold">{compareRoundBName}</Typography>
                    <Typography variant="body2" color="text.secondary">Sessions: {compareRoundBMetrics.sessionCount}</Typography>
                    <Typography variant="body2" color="text.secondary">AI TB: {compareRoundBMetrics.avgAIScore}</Typography>
                    <Typography variant="body2" color="text.secondary">Chờ TB: {compareRoundBMetrics.avgWaiting}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                      <Chip label={`Grade: ${compareRoundBGrade}`} color={compareRoundBGrade === "A" || compareRoundBGrade === "B" ? "success" : compareRoundBGrade === "C" ? "warning" : "error"} size="small" />
                      {compareRoundBMetrics.avgWaiting > waitingAlertThreshold && (
                        <Chip label="Cảnh báo chờ cao" color="error" size="small" />
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
              🧠 Fairness Score
            </Typography>
            <Typography variant="h3" color={fairnessMetrics.fairnessScore >= 70 ? "success.main" : fairnessMetrics.fairnessScore >= 40 ? "warning.main" : "error.main"} fontWeight="bold">
              {fairnessMetrics.fairnessScore}/100
            </Typography>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {fairnessLevel} — phản ánh mức độ cân bằng và đa dạng lịch sử ghép trận.
            </Typography>

            <Box sx={{ mb: 2 }}>
              <LinearProgress
                variant="determinate"
                value={fairnessMetrics.fairnessScore}
                sx={{ height: 12, borderRadius: 2, bgcolor: "grey.200", "& .MuiLinearProgress-bar": { borderRadius: 2 } }}
              />
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
              <Chip label={`Cân bằng ${fairnessMetrics.balanceScore}`} color="primary" size="small" />
              <Chip label={`Đồng đội ${fairnessMetrics.partnerScore}`} color="success" size="small" />
              <Chip label={`Đối thủ ${fairnessMetrics.opponentScore}`} color="warning" size="small" />
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="subtitle2" color="text.secondary">Tổng trận</Typography>
                <Typography fontWeight="bold">{fairnessMetrics.totalGames}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="subtitle2" color="text.secondary">Đã lặp đồng đội</Typography>
                <Typography fontWeight="bold">{fairnessMetrics.repeatedPartnerCount}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="subtitle2" color="text.secondary">Đã lặp đối thủ</Typography>
                <Typography fontWeight="bold">{fairnessMetrics.repeatedOpponentCount}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </>
  );
}
