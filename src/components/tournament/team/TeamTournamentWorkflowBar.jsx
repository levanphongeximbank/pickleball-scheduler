import { Alert, Box, Step, StepLabel, Stepper, Typography } from "@mui/material";

import { computeTeamTournamentWorkflow } from "./teamTournamentWorkflow.js";

export default function TeamTournamentWorkflowBar({ teamData }) {
  const workflow = computeTeamTournamentWorkflow(teamData);

  return (
    <Box sx={{ mb: 2 }}>
      <Stepper
        activeStep={workflow.currentStep}
        alternativeLabel
        sx={{
          "& .MuiStepLabel-label": { fontSize: { xs: "0.7rem", sm: "0.8rem" } },
        }}
      >
        {workflow.steps.map((step, index) => (
          <Step key={step.id} completed={workflow.stepComplete[index]}>
            <StepLabel>{step.label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {workflow.hints.length > 0 && !workflow.allComplete ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Bước tiếp theo
          </Typography>
          <Typography variant="body2">{workflow.hints[0]}</Typography>
        </Alert>
      ) : null}

      {workflow.allComplete ? (
        <Alert severity="success" sx={{ mt: 2 }}>
          Giải đã sẵn sàng vận hành. Theo dõi BXH và kết quả trên tab tương ứng.
        </Alert>
      ) : null}
    </Box>
  );
}
