import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, CircularProgress, Container, Paper, Typography } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import { isPickVnRatingV5Enabled } from "../../features/pick-vn-rating-v5/config/flags.js";
import V5AssessmentWorkspace from "../../features/pick-vn-rating-v5/components/V5AssessmentWorkspace.jsx";
import { resolveRatingV5Access } from "../../features/pick-vn-rating-v5/services/ratingV5AccessService.js";
import { resolveAssessmentErrorMessage } from "../../features/pick-vn-rating-v5/constants/assessmentErrorMessages.js";

export default function SkillAssessmentV5Page() {
  const navigate = useNavigate();
  const { user, authLoading } = useAuth();
  const [accessState, setAccessState] = useState({ loading: true, allowed: false, code: null });

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      if (!isPickVnRatingV5Enabled()) {
        if (!cancelled) {
          setAccessState({ loading: false, allowed: false, code: "FEATURE_DISABLED", visible: false });
        }
        return;
      }
      if (!user?.id) {
        if (!cancelled) {
          setAccessState({ loading: false, allowed: false, code: "UNAUTHORIZED", visible: false });
        }
        return;
      }

      const access = await resolveRatingV5Access();
      if (!cancelled) {
        setAccessState({
          loading: false,
          allowed: access.ok,
          code: access.code,
          visible: access.visible,
          rolloutConfig: access.rolloutConfig,
        });
      }
    }

    if (!authLoading) {
      checkAccess();
    }
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  if (authLoading || accessState.loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!user?.id) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">Vui lòng đăng nhập để tiếp tục.</Alert>
      </Container>
    );
  }

  if (!accessState.allowed) {
    const message = resolveAssessmentErrorMessage(
      accessState.code,
      accessState.code === "FEATURE_DISABLED"
        ? "Đánh giá V5 chưa được bật trong môi trường này."
        : resolveAssessmentErrorMessage("ROLLOUT_BLOCKED"),
    );
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Đánh giá trình độ V5</Typography>
          <Alert severity="info">{message}</Alert>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }} data-testid="skill-assessment-v5-page">
      <V5AssessmentWorkspace onExit={() => navigate("/player/skill", { replace: true })} />
    </Container>
  );
}
