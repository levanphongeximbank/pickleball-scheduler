import { Box } from "@mui/material";

const COURT_LINES =
  "repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 56px), repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 56px)";

export default function TournamentIdentitySurface({
  gradient,
  height = 68,
  children,
  mark = true,
}) {
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: height,
        overflow: "hidden",
        backgroundColor: "#0F1B2D",
        backgroundImage: `${COURT_LINES}, ${gradient}`,
        color: "#FFFFFF",
      }}
    >
      {mark ? (
        <Box
          sx={{
            position: "absolute",
            right: 10,
            bottom: 6,
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: 1,
            opacity: 0.18,
            pointerEvents: "none",
          }}
        >
          PICK_VN
        </Box>
      ) : null}
      <Box sx={{ position: "relative", zIndex: 1, height: "100%" }}>{children}</Box>
    </Box>
  );
}
