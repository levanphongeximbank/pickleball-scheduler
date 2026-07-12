import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { useAuth } from "../../../context/AuthContext.jsx";
import { getPickVnRatingByAuthUserId } from "../../pick-vn-rating/services/pickVnRatingService.js";
import { RATING_MODE } from "../constants/ratingModes.js";
import { resolveAssessmentErrorMessage } from "../constants/assessmentErrorMessages.js";
import { canViewV5InternalCompare } from "../services/ratingV5AccessService.js";
import { useV5AssessmentSession, V5_ASSESSMENT_PHASE } from "../hooks/useV5AssessmentSession.js";
import V5AssessmentProgress from "./V5AssessmentProgress.jsx";
import V5AssessmentQuestionCard from "./V5AssessmentQuestionCard.jsx";
import V5AssessmentResults from "./V5AssessmentResults.jsx";
import V5InternalComparePanel from "./V5InternalComparePanel.jsx";
import V5ShadowNotice from "./V5ShadowNotice.jsx";

export default function V5AssessmentWorkspace({ onExit }) {
  const { user, rbacEnabled } = useAuth();
  const [v2Rating, setV2Rating] = useState(null);
  const session = useV5AssessmentSession({
    ratingMode: RATING_MODE.DOUBLES,
  });

  useEffect(() => {
    if (!user?.id) return;
    const record = getPickVnRatingByAuthUserId(user.id);
    setV2Rating(record);
  }, [user?.id]);

  const showCompare = canViewV5InternalCompare(user, { rbacEnabled });

  if (session.phase === V5_ASSESSMENT_PHASE.LOADING) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (session.phase === V5_ASSESSMENT_PHASE.ERROR) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">{session.error?.message ?? resolveAssessmentErrorMessage(session.error?.code)}</Alert>
        {session.error?.code === "VERSION_MISMATCH" && (
          <Button variant="contained" onClick={session.restartAssessment}>
            Bắt đầu assessment mới
          </Button>
        )}
        {onExit && (
          <Button variant="text" onClick={onExit}>Quay lại</Button>
        )}
      </Stack>
    );
  }

  if (session.phase === V5_ASSESSMENT_PHASE.INTRO) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <V5ShadowNotice />
          <Typography variant="h5">Đánh giá trình độ V5 (doubles)</Typography>
          <Typography variant="body2" color="text.secondary">
            Bài gồm 22 câu cốt lõi và tối đa 8 câu thích ứng (tối đa 30 câu).
            Kết quả do máy chủ tính — client không tự chấm điểm.
          </Typography>
          <Button variant="contained" onClick={session.startAssessment} data-testid="v5-start-assessment">
            Bắt đầu đánh giá
          </Button>
          {onExit && (
            <Button variant="text" onClick={onExit}>Quay lại</Button>
          )}
        </Stack>
      </Paper>
    );
  }

  if (session.phase === V5_ASSESSMENT_PHASE.RESULTS) {
    return (
      <Stack spacing={2}>
        <V5AssessmentResults result={session.result} />
        {showCompare && (
          <V5InternalComparePanel v2Rating={v2Rating} v5Result={session.result} />
        )}
        <Button variant="contained" onClick={onExit ?? session.restartAssessment}>
          {onExit ? "Hoàn tất" : "Đánh giá mới"}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2} data-testid="v5-assessment-workspace">
      <V5ShadowNotice />
      <V5AssessmentProgress
        answeredQuestionIds={session.answeredQuestionIds}
        currentQuestionId={session.currentQuestionId}
      />

      {session.currentQuestion && (
        <V5AssessmentQuestionCard
          question={session.currentQuestion}
          value={session.answers[session.currentQuestionId]}
          onChange={session.answerCurrentQuestion}
          disabled={session.isSubmitting}
        />
      )}

      <Stack direction="row" spacing={1} justifyContent="space-between">
        <Button
          variant="outlined"
          disabled={session.currentStep <= 0 || session.isSubmitting}
          onClick={session.goBack}
        >
          Quay lại
        </Button>

        {session.canSubmit ? (
          <Button
            variant="contained"
            color="primary"
            disabled={session.isSubmitting}
            onClick={session.submitAssessment}
            data-testid="v5-submit-assessment"
          >
            {session.isSubmitting ? "Đang gửi…" : "Hoàn thành đánh giá"}
          </Button>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
            {session.answeredQuestionIds.length} / {session.totalQuestions} câu trong phiên
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
