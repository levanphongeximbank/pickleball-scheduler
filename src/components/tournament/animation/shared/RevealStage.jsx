import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import { Box, Stack, Typography } from "@mui/material";

import StatusBadge from "./StatusBadge.jsx";

export default function RevealStage({
  statusTitle = "Đang xử lý",
  statusText,
  badges = [],
  children,
  presentationMode = false,
}) {
  return (
    <Box
      className="tournament-anim-reveal-stage"
      sx={{
        minHeight: presentationMode ? 480 : { xs: 340, md: 420 },
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Box className="tournament-anim-reveal-stage__glow" />
      <Stack spacing={1.5} sx={{ position: "relative", zIndex: 1, width: "100%" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="overline" color="primary.main" fontWeight={800}>
            {statusTitle}
          </Typography>
          {statusText ? (
            <Typography variant="caption" color="text.secondary">
              {statusText}
            </Typography>
          ) : null}
        </Stack>

        {badges.length > 0 ? (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap justifyContent="center">
            {badges.map((badge) => (
              <StatusBadge key={badge.key || badge.label} label={badge.label} tone={badge.tone} />
            ))}
          </Stack>
        ) : null}

        {children ?? (
          <Typography variant="body1" color="text.secondary" align="center">
            Sẵn sàng bắt đầu
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export function PlusHub({ visible = false }) {
  return (
    <Box className={`tournament-plus-hub${visible ? " tournament-plus-hub--visible" : ""}`}>
      <Typography className="tournament-plus-text">+</Typography>
    </Box>
  );
}

export function VsHub({ visible = false, pulse = false }) {
  return (
    <Box
      className={`tournament-vs-hub${visible ? " tournament-vs-hub--visible" : ""}${
        pulse ? " tournament-vs-hub--pulse" : ""
      }`}
    >
      <SportsTennisIcon sx={{ fontSize: 32, color: "#43a047", display: "block", mx: "auto", mb: 0.5 }} />
      <Typography className="tournament-vs-text">VS</Typography>
    </Box>
  );
}
