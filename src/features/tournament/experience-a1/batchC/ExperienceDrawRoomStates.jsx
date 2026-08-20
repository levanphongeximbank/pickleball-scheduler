import { Alert, Box } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import ClubAssignmentBanner from "../../../../components/auth/ClubAssignmentBanner.jsx";
import ExperienceDrawRoomShell from "./ExperienceDrawRoomShell.jsx";

export function DrawRoomLoading({ testId, title, subtitle, message }) {
  return (
    <ExperienceDrawRoomShell testId={testId} title={title} subtitle={subtitle} overviewPath="/tournament">
      <Alert severity="info">{message}</Alert>
    </ExperienceDrawRoomShell>
  );
}

export function DrawRoomError({ testId, title, subtitle, error }) {
  return (
    <ExperienceDrawRoomShell testId={testId} title={title} subtitle={subtitle} overviewPath="/tournament">
      <Alert severity="error">{error}</Alert>
    </ExperienceDrawRoomShell>
  );
}

export function DrawRoomMissingTournament({ testId, title, subtitle }) {
  return (
    <ExperienceDrawRoomShell testId={testId} title={title} subtitle={subtitle} overviewPath="/tournament">
      <Box sx={{ mb: 1 }}>
        <ClubAssignmentBanner />
      </Box>
      <Alert severity="warning">Không tìm thấy giải. Chọn CLB trên thanh công cụ rồi mở lại giải.</Alert>
    </ExperienceDrawRoomShell>
  );
}

export function DrawRoomWrongFamily({ testId, title, subtitle }) {
  return (
    <ExperienceDrawRoomShell testId={testId} title={title} subtitle={subtitle} overviewPath="/tournament">
      <Alert severity="info">
        Màn này dành cho giải cá nhân / chính thức.{" "}
        <Box component={RouterLink} to="/tournament" sx={{ color: "inherit" }}>
          Quay lại
        </Box>
      </Alert>
    </ExperienceDrawRoomShell>
  );
}
