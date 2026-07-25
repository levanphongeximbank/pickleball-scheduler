import { useState } from "react";
import {
  Box,
  Container,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import ClubCard from "../../components/public/cards/ClubCard.jsx";
import { PUBLIC_COLORS, publicSectionSx } from "../../components/public/publicPortalStyles.js";
import {
  PublicDataSourceNotice,
  PublicEmptyState,
  PublicErrorState,
  PublicUnavailableState,
} from "../../components/public/states/index.js";
import { usePublicDocumentTitle } from "../../components/public/usePublicDocumentTitle.js";
import { VIETNAM_REGIONS } from "../../data/public/mockPublicData.js";
import { PUBLIC_DATA_RESULT_STATUS } from "../../features/experience-channels/public-portal/data-source/index.js";
import { getPublicClubsResult } from "../../features/public-portal/services/publicClubsCourtsDataSource.js";

export default function ClubsPage() {
  usePublicDocumentTitle("Câu lạc bộ");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("Tất cả");
  const [retryToken, setRetryToken] = useState(0);

  // retryToken forces a fresh sync read; sync adapter has no async subscription.
  void retryToken;
  const clubsResult = getPublicClubsResult();
  const all = Array.isArray(clubsResult.data) ? clubsResult.data : [];
  const query = search.trim().toLowerCase();
  const clubs = all.filter((club) => {
    const matchSearch =
      !query ||
      club.name.toLowerCase().includes(query) ||
      club.city.toLowerCase().includes(query);
    const matchRegion = region === "Tất cả" || club.city === region;
    return matchSearch && matchRegion;
  });

  const retry = () => setRetryToken((value) => value + 1);

  return (
    <Box sx={{ ...publicSectionSx, pt: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <Typography variant="h3" component="h1" fontWeight={800} sx={{ mb: 1 }}>
          Câu lạc bộ
        </Typography>
        <Typography variant="body1" color={PUBLIC_COLORS.textMuted} sx={{ mb: 4 }}>
          Danh sách CLB pickleball trên toàn quốc
        </Typography>

        <PublicDataSourceNotice
          source={clubsResult.source}
          fallbackReason={clubsResult.fallbackReason}
        />

        {clubsResult.status === PUBLIC_DATA_RESULT_STATUS.ERROR &&
        (!Array.isArray(clubsResult.data) || clubsResult.data.length === 0) ? (
          <PublicErrorState
            title="Không tải được danh sách CLB"
            message={
              clubsResult.error?.message ||
              "Đã xảy ra lỗi khi tải câu lạc bộ công khai. Vui lòng thử lại."
            }
            actionLabel="Thử lại"
            onAction={retry}
          />
        ) : clubsResult.status === PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE ? (
          <PublicUnavailableState
            title="Danh sách CLB tạm thời không khả dụng"
            message="Nội dung câu lạc bộ công khai hiện chưa sẵn sàng."
            actionLabel="Thử lại"
            onAction={retry}
          />
        ) : (
          <>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 4 }}>
              <TextField
                placeholder="Tìm kiếm CLB..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ flex: 1, minWidth: 240, maxWidth: 400 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon aria-hidden sx={{ color: PUBLIC_COLORS.textMuted }} />
                    </InputAdornment>
                  ),
                }}
                inputProps={{ "aria-label": "Tìm kiếm câu lạc bộ" }}
              />
              <FormControl sx={{ minWidth: 180 }}>
                <InputLabel id="public-clubs-region-label">Tỉnh/Thành</InputLabel>
                <Select
                  labelId="public-clubs-region-label"
                  label="Tỉnh/Thành"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  {VIETNAM_REGIONS.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {clubs.length ? (
              <Grid container spacing={3}>
                {clubs.map((club) => (
                  <Grid key={club.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <ClubCard club={club} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <PublicEmptyState
                title="Không tìm thấy CLB phù hợp"
                message="Thử đổi từ khóa hoặc khu vực để xem thêm câu lạc bộ."
                actionLabel="Xóa bộ lọc"
                onAction={() => {
                  setSearch("");
                  setRegion("Tất cả");
                }}
              />
            )}
          </>
        )}
      </Container>
    </Box>
  );
}
