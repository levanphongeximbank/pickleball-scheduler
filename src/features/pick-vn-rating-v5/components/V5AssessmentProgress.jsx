import { Box, Chip, Stack, Typography } from "@mui/material";

import { ASSESSMENT_UI_GROUPS, getGroupProgress } from "../constants/assessmentUiGroups.js";

export default function V5AssessmentProgress({ answeredQuestionIds = [], currentQuestionId = null }) {
  return (
    <Stack spacing={1} sx={{ mb: 2 }} data-testid="v5-assessment-progress">
      {ASSESSMENT_UI_GROUPS.map((group) => {
        const progress = getGroupProgress(group, answeredQuestionIds);
        const isActive = group.adaptive
          ? String(currentQuestionId ?? "").startsWith("adp_")
          : group.questionIds.includes(currentQuestionId);
        const label = group.adaptive
          ? `${group.label}${progress.answered ? ` (${progress.answered})` : ""}`
          : `${group.label} (${progress.answered}/${progress.total})`;

        return (
          <Box key={group.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip
              size="small"
              color={isActive ? "primary" : progress.complete ? "success" : "default"}
              variant={isActive ? "filled" : "outlined"}
              label={label}
            />
          </Box>
        );
      })}
      <Typography variant="caption" color="text.secondary">
        Tiến trình theo nhóm kỹ năng — không phải tổng số câu trong ngân hàng đề.
      </Typography>
    </Stack>
  );
}
