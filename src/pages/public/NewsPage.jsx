import { Box, Chip, Container, Grid, Stack, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";

import { PUBLIC_COLORS, publicCardSx, publicSectionSx } from "../../components/public/publicPortalStyles.js";
import { getPublicNews } from "../../features/public-portal/services/publicPortalService.js";

export default function NewsPage() {
  const news = getPublicNews();

  return (
    <Box sx={{ ...publicSectionSx, pt: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <Typography variant="h3" fontWeight={800} sx={{ mb: 1 }}>
          Tin tức
        </Typography>
        <Typography variant="body1" color={PUBLIC_COLORS.textMuted} sx={{ mb: 4 }}>
          Tin tức, hình ảnh và video phong trào pickleball Việt Nam
        </Typography>

        <Grid container spacing={3}>
          {news.map((item) => (
            <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Box sx={{ ...publicCardSx, p: 3, height: "100%" }}>
                <Box
                  sx={{
                    height: 160,
                    borderRadius: 2,
                    mb: 2,
                    background: `linear-gradient(135deg, ${PUBLIC_COLORS.primary}22 0%, ${PUBLIC_COLORS.bgAlt} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.type === "video" ? (
                    <PlayArrowIcon sx={{ fontSize: 48, color: PUBLIC_COLORS.accent }} />
                  ) : (
                    <ArticleOutlinedIcon sx={{ fontSize: 48, color: PUBLIC_COLORS.primary }} />
                  )}
                </Box>

                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                  <Chip
                    label={item.category}
                    size="small"
                    sx={{ bgcolor: "rgba(255,255,255,0.06)", color: PUBLIC_COLORS.textMuted }}
                  />
                  <Chip
                    label={item.type === "video" ? "Video" : "Bài viết"}
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: PUBLIC_COLORS.border, color: PUBLIC_COLORS.textMuted }}
                  />
                </Stack>

                <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                  {item.title}
                </Typography>
                <Typography variant="body2" color={PUBLIC_COLORS.textMuted} sx={{ mb: 2, lineHeight: 1.7 }}>
                  {item.excerpt}
                </Typography>
                <Typography variant="caption" color={PUBLIC_COLORS.textMuted}>
                  {item.date}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
