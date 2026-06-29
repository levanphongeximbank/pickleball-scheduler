import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { Box, Stack, Typography } from "@mui/material";

import { getCreationStepState } from "./dailyFairMatchUtils.js";

const STEPS = [
  { key: "analyze", label: "Phân tích người chơi" },
  { key: "fairness", label: "Đánh giá cân bằng" },
  { key: "confirm", label: "Tạo trận thành công" },
];

export default function MatchCreationSteps({ phase }) {
  const state = getCreationStepState(phase);

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      className="daily-creation-steps"
      useFlexGap
      flexWrap="wrap"
    >
      {STEPS.map((step) => {
        const stepState = state[step.key];
        const isDone = stepState === "done";
        const isActive = stepState === "active";

        return (
          <Box
            key={step.key}
            className={`daily-creation-step daily-creation-step--${stepState}`}
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              {isDone ? (
                <CheckCircleIcon sx={{ fontSize: 18, color: "success.main" }} />
              ) : (
                <RadioButtonUncheckedIcon
                  sx={{
                    fontSize: 18,
                    color: isActive ? "primary.main" : "text.disabled",
                  }}
                />
              )}
              <Typography
                variant="caption"
                fontWeight={isActive ? 700 : 500}
                color={isActive ? "primary.main" : isDone ? "success.main" : "text.secondary"}
              >
                {step.label}
              </Typography>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
