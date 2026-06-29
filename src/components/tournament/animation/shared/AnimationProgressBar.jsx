import { Box, LinearProgress, Stack, Typography } from "@mui/material";

export default function AnimationProgressBar({ value = 0, label, statusText }) {
  return (
    <Box className="tournament-anim-progress" sx={{ p: 1.25, mb: 1.5 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
        <Typography variant="body2" fontWeight="bold" color="primary.main">
          {statusText}
        </Typography>
        {label ? (
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        ) : null}
      </Stack>
      <LinearProgress
        variant="determinate"
        value={value}
        sx={{ mt: 1, height: 8, borderRadius: 1, bgcolor: "#e2e8f0" }}
      />
    </Box>
  );
}
