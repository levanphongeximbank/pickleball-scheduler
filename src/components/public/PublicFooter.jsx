import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { PUBLIC_COLORS, publicContainerSx, sectionDarkSx } from "./publicPortalStyles.js";

const FOOTER_COLUMNS = [
  {
    title: "Về chúng tôi",
    links: [
      { label: "Giới thiệu", path: "/home" },
      { label: "Tính năng", path: "/home" },
      { label: "Bảng giá", path: "/login" },
      { label: "Liên hệ", path: "/login" },
    ],
  },
  {
    title: "Hỗ trợ",
    links: [
      { label: "Hướng dẫn sử dụng", path: "/news" },
      { label: "FAQ", path: "/news" },
      { label: "Điều khoản", path: "/news" },
      { label: "Chính sách bảo mật", path: "/news" },
    ],
  },
  {
    title: "Dành cho",
    links: [
      { label: "Ban tổ chức giải", path: "/tournaments" },
      { label: "Câu lạc bộ", path: "/clubs" },
      { label: "Chủ sân", path: "/courts" },
      { label: "Vận động viên", path: "/rankings" },
    ],
  },
];

export default function PublicFooter() {
  return (
    <Box
      component="footer"
      sx={{
        ...sectionDarkSx,
        bgcolor: PUBLIC_COLORS.bgDeep,
        borderTop: `1px solid ${PUBLIC_COLORS.border}`,
        pt: { xs: 5, md: 7 },
        pb: 3,
      }}
    >
      <Box sx={publicContainerSx}>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <SportsTennisIcon sx={{ color: PUBLIC_COLORS.lime }} />
              <Typography variant="h6" fontWeight={800} color={PUBLIC_COLORS.text}>
                PICK_VN
              </Typography>
            </Stack>
            <Typography variant="body2" color={PUBLIC_COLORS.textMuted} sx={{ mb: 2, lineHeight: 1.7, maxWidth: 280 }}>
              Nền tảng quản lý pickleball toàn diện tại Việt Nam — giải đấu, CLB, sân và bảng xếp hạng.
            </Typography>
            <Stack direction="row" spacing={1}>
              {["FB", "YT", "TT", "IG"].map((s) => (
                <Chip
                  key={s}
                  label={s}
                  size="small"
                  sx={{ bgcolor: PUBLIC_COLORS.surface, color: PUBLIC_COLORS.textMuted, fontSize: "0.7rem" }}
                />
              ))}
            </Stack>
          </Grid>

          {FOOTER_COLUMNS.map((col) => (
            <Grid key={col.title} size={{ xs: 6, sm: 4, md: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} color={PUBLIC_COLORS.text} gutterBottom>
                {col.title}
              </Typography>
              <Stack spacing={0.75}>
                {col.links.map((link) => (
                  <Typography
                    key={link.label}
                    component={RouterLink}
                    to={link.path}
                    variant="body2"
                    sx={{
                      color: PUBLIC_COLORS.textMuted,
                      textDecoration: "none",
                      "&:hover": { color: PUBLIC_COLORS.lime },
                    }}
                  >
                    {link.label}
                  </Typography>
                ))}
              </Stack>
            </Grid>
          ))}

          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="subtitle2" fontWeight={700} color={PUBLIC_COLORS.text} gutterBottom>
              Liên hệ
            </Typography>
            <Typography variant="body2" color={PUBLIC_COLORS.textMuted} sx={{ mb: 0.5 }}>
              support@pickvn.vn
            </Typography>
            <Typography variant="body2" color={PUBLIC_COLORS.textMuted} sx={{ mb: 2 }}>
              Hotline: 1900 xxxx
            </Typography>
            <Typography variant="subtitle2" fontWeight={700} color={PUBLIC_COLORS.text} gutterBottom>
              ĐĂNG KÝ NHẬN TIN
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                placeholder="Email của bạn"
                fullWidth
                sx={{
                  "& .MuiOutlinedInput-root": {
                    bgcolor: PUBLIC_COLORS.surface,
                    color: PUBLIC_COLORS.text,
                    borderRadius: 1.5,
                  },
                }}
              />
              <Button
                variant="contained"
                sx={{ bgcolor: PUBLIC_COLORS.lime, color: "#0B0F19", minWidth: 48, "&:hover": { bgcolor: PUBLIC_COLORS.limeDark } }}
              >
                <ArrowForwardIcon />
              </Button>
            </Stack>
          </Grid>
        </Grid>

        <Box sx={{ mt: 5, pt: 3, borderTop: `1px solid ${PUBLIC_COLORS.border}` }}>
          <Typography variant="caption" color={PUBLIC_COLORS.textMuted}>
            © {new Date().getFullYear()} PICK_VN — Pickleball Scheduler Pro. All rights reserved.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
