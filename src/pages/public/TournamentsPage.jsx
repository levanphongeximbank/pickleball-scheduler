import { useMemo, useState } from "react";
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
import { PublicEmptyState } from "../../components/public/states/index.js";
import { usePublicDocumentTitle } from "../../components/public/usePublicDocumentTitle.js";
import {
  TOURNAMENT_STATUS_FILTERS,
  TOURNAMENT_TYPE_FILTERS,
} from "../../data/public/mockPublicData.js";
import { getPublicTournaments } from "../../features/public-portal/services/publicPortalService.js";

export default function TournamentsPage() {
  usePublicDocumentTitle("Giải đấu");
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") || "all";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState(initialType);

  const tournaments = useMemo(() => {
    const all = getPublicTournaments();
    const query = search.trim().toLowerCase();

    return all.filter((t) => {
      const matchSearch = !query || t.name.toLowerCase().includes(query);
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchType = typeFilter === "all" || t.type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [search, statusFilter, typeFilter]);

  return (
    <Box sx={{ ...publicSectionSx, pt: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <Typography variant="h3" component="h1" fontWeight={800} sx={{ mb: 1 }}>
          Giải đấu
        </Typography>
        <Typography variant="body1" color={PUBLIC_COLORS.textMuted} sx={{ mb: 4 }}>
          Khám phá các giải VPT, VPL, VPC và giải phong trào trên toàn quốc
        </Typography>

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
          <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap role="group" aria-label="Lọc theo trạng thái">
            {TOURNAMENT_STATUS_FILTERS.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                onClick={() => setStatusFilter(f.id)}
                aria-pressed={statusFilter === f.id}
                sx={{
                  bgcolor: statusFilter === f.id ? PUBLIC_COLORS.primary : "rgba(255,255,255,0.06)",
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
          <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap role="group" aria-label="Lọc theo loại giải">
            {TOURNAMENT_TYPE_FILTERS.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                onClick={() => setTypeFilter(f.id)}
                aria-pressed={typeFilter === f.id}
                variant="outlined"
                sx={{
                  borderColor: typeFilter === f.id ? PUBLIC_COLORS.primary : PUBLIC_COLORS.border,
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
      </Container>
    </Box>
  );
}
