import { useMemo, useState } from "react";
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
import { PublicEmptyState } from "../../components/public/states/index.js";
import { usePublicDocumentTitle } from "../../components/public/usePublicDocumentTitle.js";
import { VIETNAM_REGIONS } from "../../data/public/mockPublicData.js";
import { getPublicClubs } from "../../features/public-portal/services/publicPortalService.js";

export default function ClubsPage() {
  usePublicDocumentTitle("Câu lạc bộ");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("Tất cả");

  const clubs = useMemo(() => {
    const all = getPublicClubs();
    const query = search.trim().toLowerCase();

    return all.filter((club) => {
      const matchSearch =
        !query ||
        club.name.toLowerCase().includes(query) ||
        club.city.toLowerCase().includes(query);
      const matchRegion = region === "Tất cả" || club.city === region;
      return matchSearch && matchRegion;
    });
  }, [search, region]);

  return (
    <Box sx={{ ...publicSectionSx, pt: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <Typography variant="h3" component="h1" fontWeight={800} sx={{ mb: 1 }}>
          Câu lạc bộ
        </Typography>
        <Typography variant="body1" color={PUBLIC_COLORS.textMuted} sx={{ mb: 4 }}>
          Danh sách CLB pickleball trên toàn quốc
        </Typography>

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
      </Container>
    </Box>
  );
}
