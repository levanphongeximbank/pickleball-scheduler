import { useNavigate } from "react-router-dom";
import { Box, Container } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import PickVnRatingOnboarding from "../../features/pick-vn-rating/components/PickVnRatingOnboarding.jsx";

export default function PickVnOnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ minHeight: "60vh", display: "flex", alignItems: "center" }}>
        <PickVnRatingOnboarding
          authUserId={user?.id}
          clubId={user?.clubId}
          playerId={user?.playerId}
          onComplete={() =>
            navigate(user?.clubId ? "/" : "/my-club", { replace: true })
          }
        />
      </Box>
    </Container>
  );
}
