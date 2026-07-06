import { Stack, Typography } from "@mui/material";

export default function TournamentActionBar({ children, summary, sx }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      alignItems={{ xs: "stretch", sm: "center" }}
      flexWrap="wrap"
      useFlexGap
      sx={{ mb: 1.5, ...sx }}
    >
      {children}
      {summary ? (
        <Typography variant="body2" color="text.secondary" sx={{ ml: { sm: "auto" } }}>
          {summary}
        </Typography>
      ) : null}
    </Stack>
  );
}
