import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { Box, Stack, Typography } from "@mui/material";

import { TOURNAMENT_FLOW_STEPS, getFlowStepState } from "./tournamentFlowConfig.js";

export default function TournamentFlowProgress({ activeStepKey }) {
  return (
    <Box className="tournament-anim-header" sx={{ p: { xs: 1.25, sm: 1.5 }, mb: 1.5 }}>
      <Stack
        direction="row"
        spacing={0.75}
        flexWrap="wrap"
        useFlexGap
        alignItems="center"
        justifyContent={{ xs: "flex-start", md: "center" }}
      >
        {TOURNAMENT_FLOW_STEPS.map((step, index) => {
          const state = getFlowStepState(activeStepKey, step.key);
          const isActive = state === "active";
          const isDone = state === "done";

          return (
            <Stack key={step.key} direction="row" alignItems="center" spacing={0.5}>
              {isDone ? (
                <CheckCircleIcon sx={{ fontSize: 16, color: "#2e7d32" }} />
              ) : (
                <RadioButtonUncheckedIcon
                  sx={{ fontSize: 16, color: isActive ? "#1565c0" : "#94a3b8" }}
                />
              )}
              <Typography
                variant="caption"
                className={`tournament-flow-step${
                  isActive ? " tournament-flow-step--active" : ""
                }${isDone ? " tournament-flow-step--done" : ""}`}
                sx={{ fontWeight: isActive ? 700 : 500 }}
              >
                {index + 1}. {step.label}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
