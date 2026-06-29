import { Box, Paper, Stack, Typography } from "@mui/material";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";

export default function LiveCourtsHero() {
  return (
    <Paper
      elevation={0}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 2,
        p: { xs: 2.5, md: 3 },
        mb: 3,
        color: "#ffffff",
        background: "linear-gradient(135deg, #0f3f2e 0%, #157347 52%, #0f766e 100%)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          opacity: 0.15,
          backgroundImage:
            "linear-gradient(90deg, transparent 49%, #ffffff 49%, #ffffff 51%, transparent 51%), linear-gradient(0deg, transparent 49%, #ffffff 49%, #ffffff 51%, transparent 51%)",
          backgroundSize: "120px 80px",
        }}
      />

      <Stack spacing={1} sx={{ position: "relative" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <SportsTennisIcon fontSize="small" />
          <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
            AI Director · Live
          </Typography>
        </Stack>
        <Typography
          variant="h4"
          sx={{ fontWeight: 900, fontSize: { xs: 26, md: 34 }, lineHeight: 1.1 }}
        >
          Live Courts
        </Typography>
        <Typography sx={{ maxWidth: 640, color: "rgba(255,255,255,0.85)", fontSize: { xs: 14, md: 15 } }}>
          Điều hành sân, trạng thái trận đấu và phân bổ người chơi theo thời gian thực.
        </Typography>
      </Stack>
    </Paper>
  );
}
