import { Box, Container, Grid, Typography } from "@mui/material";

import CourtCard from "../../components/public/cards/CourtCard.jsx";
import { PUBLIC_COLORS, publicSectionSx } from "../../components/public/publicPortalStyles.js";
import { PublicEmptyState } from "../../components/public/states/index.js";
import { usePublicDocumentTitle } from "../../components/public/usePublicDocumentTitle.js";
import { getPublicCourts } from "../../features/public-portal/services/publicPortalService.js";

export default function CourtsPage() {
  usePublicDocumentTitle("Sân pickleball");
  const courts = getPublicCourts();

  return (
    <Box sx={{ ...publicSectionSx, pt: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <Typography variant="h3" component="h1" fontWeight={800} sx={{ mb: 1 }}>
          Sân pickleball
        </Typography>
        <Typography variant="body1" color={PUBLIC_COLORS.textMuted} sx={{ mb: 4 }}>
          Khám phá các sân pickleball và tiện ích trên toàn quốc
        </Typography>

        {courts.length ? (
          <Grid container spacing={3}>
            {courts.map((court) => (
              <Grid key={court.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <CourtCard court={court} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <PublicEmptyState
            title="Chưa có sân công khai"
            message="Danh sách sân đang trống. Vui lòng quay lại sau khi có dữ liệu mới."
          />
        )}
      </Container>
    </Box>
  );
}
