import { useNavigate, useLocation } from "react-router-dom";
import { Box, Container } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import PickVnRatingOnboarding from "../../features/pick-vn-rating/components/PickVnRatingOnboarding.jsx";

export default function FirstSkillAssessmentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const fromPath =
    location.state?.from && typeof location.state.from === "string"
      ? location.state.from
      : "/player/skill";

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ minHeight: "60vh", display: "flex", alignItems: "center" }}>
        <PickVnRatingOnboarding
          authUserId={user?.id}
          clubId={user?.clubId}
          playerId={user?.playerId}
          title="Đánh giá trình độ lần đầu"
          onComplete={() => navigate(fromPath, { replace: true })}
        />
      </Box>
    </Container>
  );
}
