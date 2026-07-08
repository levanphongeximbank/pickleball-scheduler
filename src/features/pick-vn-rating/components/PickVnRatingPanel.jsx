import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useAuth } from "../../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";
import {
  formatPickVnRating,
  getPickVnRatingSliderMarks,
  PICK_VN_MAX,
  PICK_VN_MIN,
  snapPickVnRating,
} from "../constants/pickVnRatingScale.js";
import { RATING_STATUS, RATING_STATUS_LABELS } from "../constants/ratingStatus.js";
import {
  PROVISIONAL_RATING_CALIBRATION,
  WARNING_FLAG_LABELS,
} from "../../player-rating/playerSkillAssessmentConfig.js";
import PickVnRatingBadge from "./PickVnRatingBadge.jsx";
import {
  getPickVnRatingByAuthUserId,
} from "../services/pickVnRatingService.js";
import {
  verifyClubPlayerRating,
} from "../services/ratingVerificationService.js";

export default function PickVnRatingPanel({
  player,
  clubId,
  authUserId = null,
}) {
  const { user, can } = useAuth();
  const [verifyRating, setVerifyRating] = useState(
    snapPickVnRating(player?.current_rating ?? player?.skillLevel ?? 3.5)
  );
  const [verifyNote, setVerifyNote] = useState("");
  const [message, setMessage] = useState(null);

  const globalRecord = useMemo(
    () => (authUserId ? getPickVnRatingByAuthUserId(authUserId) : null),
    [authUserId, player?.last_rating_updated_at, player?.rating_status]
  );

  const marks = useMemo(() => getPickVnRatingSliderMarks(), []);
  const status = player?.rating_status || RATING_STATUS.UNRATED;
  const current = player?.current_rating ?? player?.skillLevel ?? 3.5;

  const canVerifyClub = can(PERMISSIONS.SKILL_LEVEL_VERIFY_CLUB, {
    clubId,
    playerId: player?.id,
  });

  const history = globalRecord?.ratingHistory || [];
  const assessmentScore = globalRecord?.assessmentScore ?? player?.assessment_score;
  const warningFlags = globalRecord?.warningFlags?.length
    ? globalRecord.warningFlags
    : player?.warning_flags || [];
  const rawProvisional =
    globalRecord?.rawProvisionalRating ?? player?.raw_provisional_rating;
  const provisional =
    globalRecord?.provisionalRating ??
    player?.provisional_rating ??
    player?.current_rating;
  const ratingCalibration =
    globalRecord?.ratingCalibration ?? PROVISIONAL_RATING_CALIBRATION;
  const confidence =
    globalRecord?.ratingConfidence ?? player?.rating_confidence ?? null;
  const displayStatus =
    globalRecord?.ratingStatus || status;

  const handleVerify = () => {
    const result = verifyClubPlayerRating(clubId, player.id, verifyRating, {
      verifiedBy: user?.id || user?.email || null,
      note: verifyNote,
      authUserId,
    });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "Đã xác thực trình độ Pick_VN." });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
        Trình độ Pick_VN
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Đánh giá trình độ (2.0–6.0+) — tách biệt với điểm VPR Ranking.
      </Typography>

      <PickVnRatingBadge
        rating={current}
        status={displayStatus}
        confidence={confidence}
      />

      {displayStatus === RATING_STATUS.UNDER_REVIEW && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Hồ sơ đang được xem xét — có cảnh báo mâu thuẫn trong bảng đánh giá.
        </Alert>
      )}

      {assessmentScore != null && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Kết quả bảng đánh giá
          </Typography>
          <Stack spacing={0.75} sx={{ mb: 1 }}>
            <Typography variant="body2">
              Assessment score: <strong>{assessmentScore}/100</strong>
            </Typography>
            {confidence != null && (
              <Typography variant="body2">
                Độ tin cậy:{" "}
                <strong>{Math.round(Number(confidence) * 100)}%</strong>
              </Typography>
            )}
            {rawProvisional != null &&
              provisional != null &&
              rawProvisional !== provisional && (
                <Typography variant="body2" color="text.secondary">
                  Trước hiệu chuẩn ×{ratingCalibration}:{" "}
                  {formatPickVnRating(rawProvisional)} →{" "}
                  {formatPickVnRating(provisional)}
                </Typography>
              )}
          </Stack>
          {warningFlags.length > 0 && (
            <Stack spacing={0.5}>
              {warningFlags.map((flag) => (
                <Alert key={flag} severity="warning" sx={{ py: 0 }}>
                  {WARNING_FLAG_LABELS[flag] || flag}
                </Alert>
              ))}
            </Stack>
          )}
        </>
      )}

      <Stack spacing={1} sx={{ mt: 2 }}>
        <Typography variant="body2">
          Tự khai báo:{" "}
          {player?.self_declared_rating != null
            ? formatPickVnRating(player.self_declared_rating)
            : "—"}
        </Typography>
        <Typography variant="body2">
          Tạm tính:{" "}
          {player?.provisional_rating != null
            ? formatPickVnRating(player.provisional_rating)
            : "—"}
        </Typography>
        <Typography variant="body2">
          Đã xác thực:{" "}
          {player?.verified_rating != null
            ? formatPickVnRating(player.verified_rating)
            : "—"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Số trận tính rating: {player?.rating_match_count ?? 0}
        </Typography>
        {player?.rating_verification_note && (
          <Typography variant="caption" color="text.secondary">
            Ghi chú: {player.rating_verification_note}
          </Typography>
        )}
      </Stack>

      {history.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Lịch sử thay đổi
          </Typography>
          <Stack spacing={0.75}>
            {history
              .slice()
              .reverse()
              .slice(0, 6)
              .map((entry) => (
                <Typography key={entry.at} variant="caption" color="text.secondary">
                  {entry.at?.slice(0, 10)}: {formatPickVnRating(entry.from)} →{" "}
                  {formatPickVnRating(entry.to)} ({RATING_STATUS_LABELS[entry.status] || entry.status})
                </Typography>
              ))}
          </Stack>
        </>
      )}

      {canVerifyClub && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Xác thực trình độ (CLB)
          </Typography>
          {message && (
            <Alert severity={message.type === "error" ? "error" : "success"} sx={{ mb: 1 }}>
              {message.text}
            </Alert>
          )}
          <Box sx={{ px: 1, mb: 1 }}>
            <Slider
              value={verifyRating}
              min={PICK_VN_MIN}
              max={PICK_VN_MAX}
              step={0.5}
              marks={marks}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => formatPickVnRating(value)}
              onChange={(_, value) => setVerifyRating(snapPickVnRating(value))}
            />
          </Box>
          <TextField
            label="Ghi chú xác thực"
            fullWidth
            size="small"
            value={verifyNote}
            onChange={(event) => setVerifyNote(event.target.value)}
            sx={{ mb: 1 }}
          />
          <Button variant="contained" size="small" onClick={handleVerify}>
            Xác thực CLB
          </Button>
        </>
      )}
    </Paper>
  );
}
