import { Box, Typography } from "@mui/material";

import { useAuth } from "../../context/AuthContext.jsx";
import AthleteRatingSummary from "../../features/pick-vn-rating/components/AthleteRatingSummary.jsx";

export default function PlayerSkillOverviewPage() {
  const { user } = useAuth();

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Điểm trình độ
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Xem điểm Pick_VN và lịch sử đánh giá của bạn.
      </Typography>
      <AthleteRatingSummary authUserId={user?.id} />
    </Box>
  );
}
