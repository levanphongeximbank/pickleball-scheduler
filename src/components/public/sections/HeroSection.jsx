import { Link as RouterLink } from "react-router-dom";
import { alpha } from "@mui/material/styles";
import {
  Box,
  Button,
  Container,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import {
  PUBLIC_COLORS,
  displayHeadingSx,
  heroEntranceSx,
  publicCtaButtonSx,
  publicOutlineButtonSx,
} from "../publicPortalStyles.js";

export default function HeroSection() {
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: { xs: 520, md: 580 },
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        background: PUBLIC_COLORS.heroBg,
        mt: { xs: -7.5, md: -9 },
        pt: { xs: 14, md: 16 },
        pb: { xs: 8, md: 10 },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: PUBLIC_COLORS.heroOverlay,
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <Box sx={{ maxWidth: 640, ...heroEntranceSx }}>
          <Typography
            variant="overline"
            sx={{
              display: "block",
              mb: 2,
              color: PUBLIC_COLORS.lime,
              fontWeight: 700,
              letterSpacing: 2,
              fontSize: "0.7rem",
            }}
          >
            NỀN TẢNG QUẢN LÝ PICKLEBALL TOÀN DIỆN
          </Typography>

          <Typography
            component="h1"
            sx={{
              ...displayHeadingSx,
              fontSize: { xs: "2rem", sm: "2.75rem", md: "3.25rem" },
              mb: 2,
              color: PUBLIC_COLORS.text,
            }}
          >
            Kết nối{" "}
            <Box component="span" sx={{ color: PUBLIC_COLORS.lime }}>
              đam mê
            </Box>
            , nâng{" "}
            <Box component="span" sx={{ color: PUBLIC_COLORS.lime }}>
              tầm pickleball
            </Box>
          </Typography>

          <Typography
            variant="body1"
            sx={{
              mb: 3.5,
              color: PUBLIC_COLORS.textMuted,
              fontSize: "1.05rem",
            }}
          >
            Dành cho giải đấu · Câu lạc bộ · Sân · Vận động viên
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2.5 }}>
            <Button component={RouterLink} to="/login" sx={publicCtaButtonSx}>
              Tạo giải đấu ngay
            </Button>
            <Button component={RouterLink} to="/courts" variant="outlined" sx={publicOutlineButtonSx}>
              Tìm sân gần bạn
            </Button>
          </Stack>

          <Button
            component={RouterLink}
            to="/news"
            startIcon={<PlayArrowIcon />}
            sx={{
              color: PUBLIC_COLORS.textMuted,
              textTransform: "none",
              px: 0,
              "&:hover": { color: PUBLIC_COLORS.lime, bgcolor: "transparent" },
            }}
          >
            Xem video giới thiệu
          </Button>
        </Box>
      </Container>

      <Box
        sx={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 0.75,
        }}
      >
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: i === 0 ? 24 : 8,
              height: 8,
              borderRadius: 4,
              bgcolor: i === 0 ? PUBLIC_COLORS.lime : alpha("#fff", 0.3),
            }}
          />
        ))}
      </Box>
      <IconButton
        disabled
        sx={{
          position: "absolute",
          left: 16,
          top: "50%",
          color: alpha("#fff", 0.4),
          display: { xs: "none", md: "flex" },
        }}
      >
        <ChevronLeftIcon />
      </IconButton>
      <IconButton
        disabled
        sx={{
          position: "absolute",
          right: 16,
          top: "50%",
          color: alpha("#fff", 0.4),
          display: { xs: "none", md: "flex" },
        }}
      >
        <ChevronRightIcon />
      </IconButton>
    </Box>
  );
}
