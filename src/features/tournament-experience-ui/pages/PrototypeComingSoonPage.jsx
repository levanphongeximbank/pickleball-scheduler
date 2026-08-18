import { useLocation } from "react-router-dom";
import { Alert, Typography } from "@mui/material";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";

export default function PrototypeComingSoonPage() {
  const location = useLocation();
  return (
    <TournamentExperienceShell title="Chưa có trong Phase 2A" subtitle={location.pathname}>
      <Alert severity="info">
        Phase 2A chỉ calibrate 01 Trung tâm, 02 Tổng quan, 04 Đăng ký & Công bố. Màn này giữ chỗ điều hướng,
        chưa implement layout.
      </Alert>
      <Typography sx={{ mt: 2, fontSize: 13 }} color="text.secondary">
        Không có ghi dữ liệu production.
      </Typography>
    </TournamentExperienceShell>
  );
}
