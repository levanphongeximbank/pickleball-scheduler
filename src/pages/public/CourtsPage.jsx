import { useEffect, useState } from "react";
import { Box, Container, Grid, Typography } from "@mui/material";

import CourtCard from "../../components/public/cards/CourtCard.jsx";
import { PUBLIC_COLORS, publicSectionSx } from "../../components/public/publicPortalStyles.js";
import {
  PublicDataSourceNotice,
  PublicEmptyState,
  PublicErrorState,
  PublicLoadingState,
  PublicUnavailableState,
} from "../../components/public/states/index.js";
import { usePublicDocumentTitle } from "../../components/public/usePublicDocumentTitle.js";
import { PUBLIC_DATA_RESULT_STATUS } from "../../features/experience-channels/public-portal/data-source/index.js";
import { loadPublicCourtsPageResult } from "../../features/public-portal/services/publicClubsCourtsDataSource.js";

export default function CourtsPage() {
  usePublicDocumentTitle("Sân pickleball");
  const [retryToken, setRetryToken] = useState(0);
  const [courtsResult, setCourtsResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadPublicCourtsPageResult()
      .then((next) => {
        if (!cancelled) setCourtsResult(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  const courts = Array.isArray(courtsResult?.data) ? courtsResult.data : [];
  const retry = () => setRetryToken((value) => value + 1);

  return (
    <Box sx={{ ...publicSectionSx, pt: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <Typography variant="h3" component="h1" fontWeight={800} sx={{ mb: 1 }}>
          Sân pickleball
        </Typography>
        <Typography variant="body1" color={PUBLIC_COLORS.textMuted} sx={{ mb: 4 }}>
          Khám phá các sân pickleball và tiện ích trên toàn quốc
        </Typography>

        {loading || !courtsResult ? (
          <PublicLoadingState title="Đang tải danh sách sân…" />
        ) : (
          <>
            <PublicDataSourceNotice
              source={courtsResult.source}
              fallbackReason={courtsResult.fallbackReason}
            />

            {courtsResult.status === PUBLIC_DATA_RESULT_STATUS.ERROR && courts.length === 0 ? (
              <PublicErrorState
                title="Không tải được danh sách sân"
                message={
                  courtsResult.error?.message ||
                  "Đã xảy ra lỗi khi tải sân công khai. Vui lòng thử lại."
                }
                actionLabel="Thử lại"
                onAction={retry}
              />
            ) : courtsResult.status === PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE ? (
              <PublicUnavailableState
                title="Danh sách sân tạm thời không khả dụng"
                message="Nội dung sân công khai hiện chưa sẵn sàng."
                actionLabel="Thử lại"
                onAction={retry}
              />
            ) : courts.length ? (
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
                actionLabel="Thử lại"
                onAction={retry}
              />
            )}
          </>
        )}
      </Container>
    </Box>
  );
}
