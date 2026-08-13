import { Alert, Box, Chip, Stack, Typography } from "@mui/material";

/**
 * Module-local Internal lifecycle stepper (IT-E2E-007).
 * Projection-only — authority is resolveInternalTournamentLifecycle(tournament).
 */
export default function InternalTournamentLifecycleStepper({
  lifecycle,
  onSelectStep,
  selectedStepId = null,
}) {
  if (!lifecycle) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        sx={{ mb: 1 }}
        aria-label="Tiến trình giải nội bộ"
      >
        {lifecycle.steps.map((step) => (
          <Chip
            key={step.id}
            size="small"
            label={step.label}
            clickable={typeof onSelectStep === "function"}
            onClick={
              typeof onSelectStep === "function" ? () => onSelectStep(step.id) : undefined
            }
            color={
              step.status === "current" || step.id === selectedStepId
                ? "primary"
                : step.status === "done"
                  ? "success"
                  : "default"
            }
            variant={step.status === "pending" && step.id !== selectedStepId ? "outlined" : "filled"}
          />
        ))}
      </Stack>
      <Alert severity={lifecycle.BLOCKING_REASON ? "warning" : "info"} sx={{ mb: 0 }}>
        <Typography variant="subtitle2" component="div">
          Bước hiện tại: {lifecycle.PRIMARY_ACTION_LABEL}
        </Typography>
        <Typography variant="body2" component="div">
          {lifecycle.NEXT_REQUIRED_ACTION}
        </Typography>
        {lifecycle.oneGroup ? (
          <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
            Giải có 1 bảng — kết thúc sau vòng bảng (không có vòng knock-out).
          </Typography>
        ) : null}
      </Alert>
    </Box>
  );
}
