import { buildDebugSummary } from "../ai/debugPanel";

import {
  Box,
  Button,
  Card,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

export default function SelectPlayersResult({
  scheduleResult,
  previewMode,
  canIntervene = false,
  interventionBanner = null,
  onApplyPreview,
  onCancelPreview,
  lockedCourts,
  onToggleCourtLock,
  onSwapTeams,
  onMovePlayer,
  lockedPlayers,
  onSelectAlternative,
}) {
  if (!scheduleResult) {
    return null;
  }

  const summary = buildDebugSummary(scheduleResult);

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        🏟️ KẾT QUẢ XẾP SÂN
      </Typography>

      {previewMode && (
        <Card sx={{ mb: 3, p: 2, border: "2px solid", borderColor: "primary.main" }}>
          <Typography fontWeight="bold" color="primary.main" sx={{ mb: 1 }}>
            👀 Chế độ xem trước
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Bạn đang xem lịch xếp AI trước khi áp dụng. Bạn có thể chấp nhận hoặc hủy.
            {!canIntervene && " Chỉ Founder mới có thể can thiệp đổi cặp trên sân."}
          </Typography>
          {interventionBanner}
          <Stack direction="row" spacing={2}>
            <Button variant="contained" color="success" onClick={onApplyPreview}>
              ✅ Áp dụng lịch xếp
            </Button>
            <Button variant="outlined" color="error" onClick={onCancelPreview}>
              ❌ Hủy
            </Button>
          </Stack>
        </Card>
      )}

      <Card sx={{ mb: 3, p: 2, bgcolor: "grey.50" }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
          🤖 Đánh giá AI
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography fontWeight="bold">Điểm tổng</Typography>
            <Typography color="primary.main" variant="h6">
              {scheduleResult.aiScore?.total ?? 0}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography fontWeight="bold">Cân bằng</Typography>
            <Typography color="success.main">
              {scheduleResult.aiScore?.balance ?? 0}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography fontWeight="bold">Điểm chờ</Typography>
            <Typography color="warning.main">
              {scheduleResult.aiScore?.waiting ?? 0}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography fontWeight="bold">Người chờ</Typography>
            <Typography color="text.primary">
              {scheduleResult.waiting?.length ?? 0}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography fontWeight="bold">Phương án tốt nhất</Typography>
            <Typography color="secondary.main">
              {scheduleResult.bestCandidateScore ?? 0}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography fontWeight="bold">History score</Typography>
            <Typography color="info.main">
              {scheduleResult.aiScore?.history ?? 0}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography fontWeight="bold">Rule score</Typography>
            <Typography color="success.main">
              {scheduleResult.aiScore?.rules ?? 0}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography fontWeight="bold">Policy score</Typography>
            <Typography color="warning.main">
              {scheduleResult.aiScore?.policy ?? 0}
            </Typography>
          </Grid>
        </Grid>

        <Typography sx={{ mt: 2 }} color="text.secondary">
          AI ưu tiên các sân có mức chênh lệch đội hợp lý, giảm lặp lại đồng đội/đối thủ và giữ người chờ ở mức tối thiểu. Hệ thống đã tạo {scheduleResult.candidates?.length ?? 0} phương án và chọn phương án tốt nhất.
        </Typography>

        <Box sx={{ mt: 2, p: 1.5, border: "1px dashed", borderColor: "grey.400", borderRadius: 1 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            🧪 Debug summary
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {`Sân: ${summary.totalCourts} • Người chờ: ${summary.waitingCount} • Điểm AI: ${summary.aiScore} • Phương án: ${summary.candidateCount}${summary.persisted ? " • Đã lưu" : " • Preview"}`}
          </Typography>
          {summary.traceLines.length > 0 && (
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {summary.traceLines.map((line) => (
                <Typography key={line} variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  {line}
                </Typography>
              ))}
            </Stack>
          )}
        </Box>
      </Card>

      {Array.isArray(scheduleResult.alternatives) && scheduleResult.alternatives.length > 0 && (
        <Card sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
            🧠 So sánh phương án AI
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Chọn một phương án để xem chi tiết đội hình theo điểm tổng và độ chênh lệch.
          </Typography>

          <Grid container spacing={1.5}>
            {scheduleResult.alternatives.map((alternative) => {
              const isSelected = scheduleResult.selectedAlternativeIndex === alternative.index;

              return (
                <Grid key={alternative.index} size={{ xs: 12, md: 6 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderColor: isSelected ? "success.main" : "grey.300",
                    }}
                  >
                    <Typography fontWeight="bold">
                      Phương án #{alternative.index + 1}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Score: {Math.round(alternative.totalScore || 0)} • Avg diff: {Number(alternative.comparison?.avgDiff || 0).toFixed(2)} • Max diff: {Number(alternative.comparison?.maxDiff || 0).toFixed(2)}
                    </Typography>

                    <Button
                      size="small"
                      variant={isSelected ? "contained" : "outlined"}
                      color={isSelected ? "success" : "primary"}
                      sx={{ mt: 1 }}
                      onClick={() => onSelectAlternative?.(alternative.index)}
                    >
                      {isSelected ? "Đang chọn" : "Chọn phương án"}
                    </Button>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Card>
      )}

      <Grid container spacing={2}>
        {scheduleResult.courts.map((court) => (
          <Grid
            key={court.court}
            size={{
              xs: 12,
              md: 6,
            }}
          >
            <Card sx={{ p: 2 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                sx={{ mb: 2 }}
              >
                <Typography variant="h6" fontWeight="bold">
                  🏟️ {court.courtName || court.name || `Sân ${court.court}`}
                </Typography>

                <Button
                  size="small"
                  variant={
                    lockedCourts.includes(court.court)
                      ? "contained"
                      : "outlined"
                  }
                  color={
                    lockedCourts.includes(court.court)
                      ? "warning"
                      : "primary"
                  }
                  onClick={() => onToggleCourtLock(court.court)}
                >
                  {lockedCourts.includes(court.court)
                    ? "🔓 Đã khóa"
                    : "🔒 Khóa sân"}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
                {canIntervene ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onSwapTeams(court.court)}
                  >
                    Đảo đội A/B
                  </Button>
                ) : null}
              </Stack>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography fontWeight="bold" color="primary">
                      Đội A
                    </Typography>

                    {court.teamA.map((player) => (
                      <Stack key={player.id} direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                        <Typography>
                          • {player.name} ({player.level})
                        </Typography>
                        {canIntervene ? (
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => onMovePlayer(court.court, "A", player.id)}
                          >
                            Chuyển B
                          </Button>
                        ) : null}
                      </Stack>
                    ))}

                    <Typography fontWeight="bold" sx={{ mt: 1 }}>
                      Tổng: {court.teamATotal.toFixed(1)}
                    </Typography>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography fontWeight="bold" color="error">
                      Đội B
                    </Typography>

                    {court.teamB.map((player) => (
                      <Stack key={player.id} direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                        <Typography>
                          • {player.name} ({player.level})
                        </Typography>
                        {canIntervene ? (
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => onMovePlayer(court.court, "B", player.id)}
                          >
                            Chuyển A
                          </Button>
                        ) : null}
                      </Stack>
                    ))}

                    <Typography fontWeight="bold" sx={{ mt: 1 }}>
                      Tổng: {court.teamBTotal.toFixed(1)}
                    </Typography>
                  </Card>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Typography fontWeight="bold">VS</Typography>

                <Typography
                  fontWeight="bold"
                  color={
                    court.diff <= 0.3
                      ? "success.main"
                      : court.diff <= 0.7
                      ? "warning.main"
                      : "error.main"
                  }
                >
                  Chênh lệch: {court.diff.toFixed(1)}
                </Typography>

                {court.explanation && (
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {court.explanation}
                  </Typography>
                )}

                <Stack direction="row" spacing={1} sx={{ mt: 1, justifyContent: "center", flexWrap: "wrap" }}>
                  <Chip label={`Level: ${Math.round(court.detailScore?.levelScore ?? 0)}`} size="small" />
                  <Chip label={`History: ${Math.round(court.detailScore?.historyScore ?? 0)}`} size="small" />
                  <Chip label={`Rule: ${Math.round(court.detailScore?.ruleScore ?? 0)}`} size="small" />
                  <Chip label={`Policy: ${Math.round(court.detailScore?.policyScore ?? 0)}`} size="small" />
                  <Chip label={`Điểm sân: ${Math.round(court.score ?? 0)}`} color="primary" size="small" />
                </Stack>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {scheduleResult.waiting.length > 0 && (
        <Card sx={{ mt: 3, p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
            👤 Người chờ ({scheduleResult.waiting.length})
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Trạng thái người chờ được hiển thị theo lý do: khóa bởi Director hoặc tạm chờ vì hết chỗ trong vòng này.
          </Typography>

          <Grid container spacing={1}>
            {scheduleResult.waiting.map((player) => (
              <Grid
                key={player.id}
                size={{
                  xs: 12,
                  sm: 6,
                  md: 4,
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                  <Typography>
                    • {player.name} ({player.level})
                  </Typography>
                  {lockedPlayers.includes(player.id) ? (
                    <Chip size="small" color="warning" label="Khóa bởi Director" />
                  ) : (
                    <Chip size="small" color="default" label="Chờ vòng này" />
                  )}
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Card>
      )}
    </Box>
  );
}
