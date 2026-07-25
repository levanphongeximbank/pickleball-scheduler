import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Chip,
  Container,
  Grid,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import TournamentCard from "../../components/public/cards/TournamentCard.jsx";
import { PUBLIC_COLORS, publicSectionSx } from "../../components/public/publicPortalStyles.js";
import {
  PublicDataSourceNotice,
  PublicEmptyState,
  PublicErrorState,
  PublicUnavailableState,
} from "../../components/public/states/index.js";
import { usePublicDocumentTitle } from "../../components/public/usePublicDocumentTitle.js";
import {
  TOURNAMENT_STATUS_FILTERS,
  TOURNAMENT_TYPE_FILTERS,
} from "../../data/public/mockPublicData.js";
import { PUBLIC_DATA_RESULT_STATUS } from "../../features/experience-channels/public-portal/data-source/index.js";
import { getPublicTournamentsResult } from "../../features/public-portal/services/publicTournamentsRankingsDataSource.js";

export default function TournamentsPage() {
  usePublicDocumentTitle("Giải đấu");
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") || "all";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [retryToken, setRetryToken] = useState(0);

  // retryToken forces a fresh sync read; sync adapter has no async subscription.
  void retryToken;
  const tournamentsResult = getPublicTournamentsResult();
  const all = Array.isArray(tournamentsResult.data) ? tournamentsResult.data : [];
  const query = search.trim().toLowerCase();
  const tournaments = all.filter((t) => {
    const matchSearch = !query || t.name.toLowerCase().includes(query);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchType = typeFilter === "all" || t.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const retry = () => setRetryToken((value) => value + 1);

  return (
    <Box sx={{ ...publicSectionSx, pt: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <Typography variant="h3" component="h1" fontWeight={800} sx={{ mb: 1 }}>
          Giải đấu
        </Typography>
        <Typography variant="body1" color={PUBLIC_COLORS.textMuted} sx={{ mb: 4 }}>
          Khám phá các giải VPT, VPL, VPC và giải phong trào trên toàn quốc
        </Typography>

        <PublicDataSourceNotice
          source={tournamentsResult.source}
          fallbackReason={tournamentsResult.fallbackReason}
        />

        {tournamentsResult.status === PUBLIC_DATA_RESULT_STATUS.ERROR &&
        (!Array.isArray(tournamentsResult.data) || tournamentsResult.data.length === 0) ? (
          <PublicErrorState
            title="Không tải được danh sách giải đấu"
            message={
              tournamentsResult.error?.message ||
              "Đã xảy ra lỗi khi tải giải đấu công khai. Vui lòng thử lại."
            }
            actionLabel="Thử lại"
            onAction={retry}
          />
        ) : tournamentsResult.status === PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE ? (
          <PublicUnavailableState
            title="Danh sách giải đấu tạm thời không khả dụng"
            message="Nội dung giải đấu công khai hiện chưa sẵn sàng."
            actionLabel="Thử lại"
            onAction={retry}
          />
        ) : (
          <>
            <TextField
              fullWidth
              placeholder="Tìm kiếm theo tên giải..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ mb: 3, maxWidth: 480 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon aria-hidden sx={{ color: PUBLIC_COLORS.textMuted }} />
                  </InputAdornment>
                ),
              }}
              inputProps={{ "aria-label": "Tìm kiếm giải đấu" }}
            />

            <Stack spacing={2} sx={{ mb: 4 }}>
              <Stack
                direction="row"
                flexWrap="wrap"
                gap={1}
                useFlexGap
                role="group"
                aria-label="Lọc theo trạng thái"
              >
                {TOURNAMENT_STATUS_FILTERS.map((f) => (
                  <Chip
                    key={f.id}
                    label={f.label}
                    onClick={() => setStatusFilter(f.id)}
                    aria-pressed={statusFilter === f.id}
                    sx={{
                      bgcolor:
                        statusFilter === f.id ? PUBLIC_COLORS.primary : "rgba(255,255,255,0.06)",
                      color: statusFilter === f.id ? "#0F172A" : PUBLIC_COLORS.textMuted,
                      fontWeight: 600,
                      cursor: "pointer",
                      "&:focus-visible": {
                        outline: `2px solid ${PUBLIC_COLORS.lime}`,
                        outlineOffset: 2,
                      },
                    }}
                  />
                ))}
              </Stack>
              <Stack
                direction="row"
                flexWrap="wrap"
                gap={1}
                useFlexGap
                role="group"
                aria-label="Lọc theo loại giải"
              >
                {TOURNAMENT_TYPE_FILTERS.map((f) => (
                  <Chip
                    key={f.id}
                    label={f.label}
                    onClick={() => setTypeFilter(f.id)}
                    aria-pressed={typeFilter === f.id}
                    variant="outlined"
                    sx={{
                      borderColor:
                        typeFilter === f.id ? PUBLIC_COLORS.primary : PUBLIC_COLORS.border,
                      color: typeFilter === f.id ? PUBLIC_COLORS.primary : PUBLIC_COLORS.textMuted,
                      cursor: "pointer",
                      "&:focus-visible": {
                        outline: `2px solid ${PUBLIC_COLORS.lime}`,
                        outlineOffset: 2,
                      },
                    }}
                  />
                ))}
              </Stack>
            </Stack>

            {tournaments.length ? (
              <Grid container spacing={3}>
                {tournaments.map((t) => (
                  <Grid key={t.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <TournamentCard tournament={t} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <PublicEmptyState
                title="Không tìm thấy giải đấu phù hợp"
                message="Thử đổi từ khóa, trạng thái hoặc loại giải để xem thêm kết quả."
                actionLabel="Xóa bộ lọc"
                onAction={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                }}
              />
            )}
          </>
        )}
      </Container>
    </Box>
  );
}
