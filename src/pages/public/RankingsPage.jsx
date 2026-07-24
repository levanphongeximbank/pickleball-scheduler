import { useMemo, useState } from "react";
import {
  Box,
  Chip,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import { PUBLIC_COLORS, publicCardSx, publicSectionSx } from "../../components/public/publicPortalStyles.js";
import { PublicEmptyState } from "../../components/public/states/index.js";
import { usePublicDocumentTitle } from "../../components/public/usePublicDocumentTitle.js";
import { RANKING_CATEGORIES, VIETNAM_REGIONS } from "../../data/public/mockPublicData.js";
import { getPublicRankings } from "../../features/public-portal/services/publicPortalService.js";

export default function RankingsPage() {
  usePublicDocumentTitle("Bảng xếp hạng VPR");
  const [category, setCategory] = useState("men_single");
  const [region, setRegion] = useState("Tất cả");
  const [gender, setGender] = useState("all");
  const [year, setYear] = useState("");
  const [search, setSearch] = useState("");

  const rankings = useMemo(
    () =>
      getPublicRankings({
        category,
        region,
        gender: gender === "all" ? null : gender,
        year: year ? Number(year) : null,
        search,
      }),
    [category, region, gender, year, search]
  );

  const categories = RANKING_CATEGORIES;

  return (
    <Box sx={{ ...publicSectionSx, pt: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <Typography variant="h3" component="h1" fontWeight={800} sx={{ mb: 1 }}>
          Bảng xếp hạng VPR
        </Typography>
        <Typography variant="body1" color={PUBLIC_COLORS.textMuted} sx={{ mb: 3 }}>
          Vietnam Pickleball Ranking — chỉ tính từ giải Pick_VN Certified / VPT.
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          role="group"
          aria-label="Hạng mục xếp hạng"
          sx={{ mb: 2, flexWrap: "wrap" }}
        >
          {categories.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              onClick={() => setCategory(item.id)}
              aria-pressed={category === item.id}
              color={category === item.id ? "primary" : "default"}
              variant={category === item.id ? "filled" : "outlined"}
              sx={{
                "&:focus-visible": {
                  outline: `2px solid ${PUBLIC_COLORS.lime}`,
                  outlineOffset: 2,
                },
              }}
            />
          ))}
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
            <InputLabel id="public-rankings-region-label">Khu vực</InputLabel>
            <Select
              labelId="public-rankings-region-label"
              label="Khu vực"
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
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 140 } }}>
            <InputLabel id="public-rankings-gender-label">Giới tính</InputLabel>
            <Select
              labelId="public-rankings-gender-label"
              label="Giới tính"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <MenuItem value="all">Tất cả</MenuItem>
              <MenuItem value="male">Nam</MenuItem>
              <MenuItem value="female">Nữ</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Năm"
            placeholder="2026"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            sx={{ width: { xs: "100%", sm: 120 } }}
          />
          <TextField
            size="small"
            label="Tìm VĐV"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: { xs: "100%", sm: 180 } }}
          />
        </Stack>

        {rankings.length === 0 ? (
          <PublicEmptyState
            title="Chưa có dữ liệu xếp hạng"
            message="Không có VĐV phù hợp với bộ lọc hiện tại. Thử đổi hạng mục, khu vực hoặc từ khóa."
            actionLabel="Xóa bộ lọc"
            onAction={() => {
              setCategory("men_single");
              setRegion("Tất cả");
              setGender("all");
              setYear("");
              setSearch("");
            }}
          />
        ) : (
          <TableContainer
            sx={{
              ...publicCardSx,
              width: "100%",
              maxWidth: "100%",
              overflowX: "auto",
            }}
          >
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Hạng</TableCell>
                  <TableCell>VĐV</TableCell>
                  <TableCell>CLB</TableCell>
                  <TableCell>Khu vực</TableCell>
                  <TableCell align="right">Điểm VPR</TableCell>
                  <TableCell align="right">Giải</TableCell>
                  <TableCell>TT tốt nhất</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rankings.map((row) => (
                  <TableRow key={`${row.rank}-${row.name}-${row.vprAthleteId || row.name}`}>
                    <TableCell>
                      <Typography fontWeight={700} color={PUBLIC_COLORS.primary}>
                        #{row.rank}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.name || row.displayName}</TableCell>
                    <TableCell>{row.clubName || row.club || "—"}</TableCell>
                    <TableCell>{row.region}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700}>{row.points ?? row.totalPoints}</Typography>
                    </TableCell>
                    <TableCell align="right">{row.tournamentsCount ?? "—"}</TableCell>
                    <TableCell>{row.bestPlacement || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>
    </Box>
  );
}
