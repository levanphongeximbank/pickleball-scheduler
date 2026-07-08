import { Link as RouterLink } from "react-router-dom";
import { alpha } from "@mui/material/styles";
import { Box, Button, Typography } from "@mui/material";

import { PUBLIC_COLORS, publicCardSx } from "../publicPortalStyles.js";

export default function EcosystemCard({ item }) {
  return (
    <Box
      sx={{
        ...publicCardSx,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: item.color,
          boxShadow: `0 0 20px ${alpha(item.color, 0.5)}`,
        },
        "&:hover::before": {
          boxShadow: `0 0 30px ${alpha(item.color, 0.7)}`,
        },
      }}
    >
      <Box sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column" }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2.5,
            bgcolor: alpha(item.color, 0.15),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
            boxShadow: `0 0 24px ${alpha(item.color, 0.2)}`,
          }}
        >
          <Typography variant="subtitle2" fontWeight={800} sx={{ color: item.color }}>
            {item.code}
          </Typography>
        </Box>

        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5, color: PUBLIC_COLORS.text }}>
          {item.title}
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 1.5, fontWeight: 600, color: item.color }}
        >
          {item.subtitle}
        </Typography>
        <Typography
          variant="body2"
          color={PUBLIC_COLORS.textMuted}
          sx={{ mb: 2.5, flex: 1, lineHeight: 1.75 }}
        >
          {item.description}
        </Typography>

        <Button
          component={RouterLink}
          to={item.path}
          size="small"
          sx={{
            color: item.color,
            textTransform: "none",
            alignSelf: "flex-start",
            px: 0,
            fontWeight: 600,
            "&:hover": { bgcolor: "transparent", opacity: 0.85 },
          }}
        >
          Xem thêm →
        </Button>
      </Box>
    </Box>
  );
}
