import { Alert, Box, Chip, Step, StepLabel, Stepper, Typography } from "@mui/material";

import { computeTeamTournamentWorkflow } from "./teamTournamentWorkflow.js";

export default function TeamTournamentWorkflowBar({ teamData, tournament = null }) {
  const workflow = computeTeamTournamentWorkflow(teamData, tournament);

  return (
    <Box sx={{ mb: 2 }}>
      {workflow.draftStatusLabel ? (
        <Chip
          size="small"
          color="primary"
          variant="outlined"
          label={workflow.draftStatusLabel}
          sx={{ mb: 1.5 }}
        />
      ) : null}

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
