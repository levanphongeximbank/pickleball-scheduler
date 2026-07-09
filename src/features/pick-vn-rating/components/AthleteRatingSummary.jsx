import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ReplayIcon from "@mui/icons-material/Replay";
import AssessmentIcon from "@mui/icons-material/Assessment";

import { formatPickVnRating } from "../constants/pickVnRatingScale.js";
import { RATING_STATUS, RATING_STATUS_LABELS } from "../constants/ratingStatus.js";
import { WARNING_FLAG_LABELS } from "../../player-rating/playerSkillAssessmentConfig.js";
import PickVnRatingBadge from "./PickVnRatingBadge.jsx";
import { getPickVnRatingByAuthUserId } from "../services/pickVnRatingService.js";

export default function AthleteRatingSummary({ authUserId }) {
  const record = useMemo(
    () => (authUserId ? getPickVnRatingByAuthUserId(authUserId) : null),
    [authUserId]
  );

  const status = record?.ratingStatus || RATING_STATUS.UNRATED;
  const hasRating =
    record &&
    status !== RATING_STATUS.UNRATED &&
    record.currentRating != null;

  if (!hasRating) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2} alignItems={{ xs: "stretch", sm: "flex-start" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AssessmentIcon color="action" />
            <Typography variant="subtitle1" fontWeight={700}>
              Trình độ Pick_VN
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Chưa có điểm trình độ. Hoàn thành bài đánh giá kỹ năng để hệ thống gợi ý mức
            Pick_VN phù hợp (2.0–6.0+).
          </Typography>
          <Button
            component={RouterLink}
            to="/player/skill-assessment"
            variant="contained"
            startIcon={<AssessmentIcon />}
          >
            Bắt đầu đánh giá
          </Button>
        </Stack>
      </Paper>
    );
  }

  const history = record.ratingHistory || [];
  const assessmentScore = record.assessmentScore;
  const confidence = record.ratingConfidence;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
        Trình độ Pick_VN
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Điểm do hệ thống đánh giá kỹ năng tính toán — bạn không thể chỉnh tay tại đây.
      </Typography>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: 2,
          mb: 1,
          borderRadius: 2,
          bgcolor: "primary.50",
          border: 1,
          borderColor: "primary.light",
        }}
      >
        <Typography variant="h3" fontWeight={800} color="primary.main">
          {formatPickVnRating(record.currentRating)}
        </Typography>
      </Box>

      <PickVnRatingBadge
        rating={record.currentRating}
        status={status}
        confidence={confidence}
        size="medium"
      />

      {status === RATING_STATUS.UNDER_REVIEW && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Hồ sơ đang được xem xét — có cảnh báo trong bảng đánh giá.
        </Alert>
      )}

      {assessmentScore != null && (
        <Stack spacing={0.75} sx={{ mt: 2 }}>
          <Typography variant="body2">
            Điểm bảng đánh giá: <strong>{assessmentScore}/100</strong>
          </Typography>
          {confidence != null && (
            <Typography variant="body2">
              Độ tin cậy: <strong>{Math.round(Number(confidence) * 100)}%</strong>
            </Typography>
          )}
        </Stack>
      )}

      {(record.warningFlags || []).length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {record.warningFlags.map((flag) => (
            <Alert key={flag} severity="warning" sx={{ py: 0 }}>
              {WARNING_FLAG_LABELS[flag] || flag}
            </Alert>
          ))}
        </Stack>
      )}

      {history.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Lịch sử thay đổi
          </Typography>
          <Stack spacing={0.5}>
            {history
              .slice()
              .reverse()
              .slice(0, 5)
              .map((entry) => (
                <Typography key={entry.at} variant="caption" color="text.secondary">
                  {entry.at?.slice(0, 10)}: {formatPickVnRating(entry.from)} →{" "}
                  {formatPickVnRating(entry.to)} (
                  {RATING_STATUS_LABELS[entry.status] || entry.status})
                </Typography>
              ))}
          </Stack>
        </>
      )}

      <Button
        component={RouterLink}
        to="/player/skill-assessment"
        variant="outlined"
        size="small"
        startIcon={<ReplayIcon />}
        sx={{ mt: 2 }}
      >
        Làm lại đánh giá
      </Button>
    </Paper>
  );
}
