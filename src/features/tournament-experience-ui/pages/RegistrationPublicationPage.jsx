import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import SearchIcon from "@mui/icons-material/Search";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Box,
  Button,
  Divider,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState } from "react";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentStatusChip from "../components/TournamentStatusChip.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import {
  TOURNAMENT_COLOR,
  TOURNAMENT_RADIUS,
} from "../design/tournamentDesignTokens.js";
import {
  FIXTURE_REGISTRATION_PUBLICATION_STATUS,
  FIXTURE_REGISTRATIONS,
} from "../fixtures/prototypeFixture.js";
import { publicationPrimaryActionLabel } from "../publicationSemantics.js";

const SOURCE_LABEL = {
  "Public link": "Liên kết công khai",
  "BTC nhập": "BTC nhập",
  Import: "Nhập file",
};

const STATUS_META = {
  confirmed: { tone: "success", label: "Đã xác nhận" },
  pending: { tone: "warning", label: "Chờ duyệt" },
  waitlist: { tone: "info", label: "Danh sách chờ" },
  missing: { tone: "danger", label: "Thiếu thông tin" },
};

const TABS = [
  { id: "all", label: "Tất cả (67)" },
  { id: "confirmed", label: "Đã xác nhận (58)" },
  { id: "pending", label: "Chờ duyệt (4)" },
  { id: "waitlist", label: "Danh sách chờ (5)" },
];

function RegistrationRecord({ row }) {
  const status = STATUS_META[row.status];
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        mb: 1,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
        border: `1px solid ${TOURNAMENT_COLOR.divider}`,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ mb: 0.5, justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{row.names}</Typography>
        <TournamentStatusChip tone={status.tone} label={status.label} />
      </Stack>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{row.id} • {row.phone}</Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
        {SOURCE_LABEL[row.source] || row.source} • {row.time}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
        <Button size="small" variant="outlined">{row.status === "pending" ? "Duyệt" : "Xem"}</Button>
      </Stack>
    </Paper>
  );
}

export default function RegistrationPublicationPage() {
  const theme = useTheme();
  const isTable = useMediaQuery(theme.breakpoints.up("md"));
  const [tab, setTab] = useState("all");
  const rows = FIXTURE_REGISTRATIONS.filter((row) => tab === "all" || row.status === tab);
  const publicationActionLabel = publicationPrimaryActionLabel(
    FIXTURE_REGISTRATION_PUBLICATION_STATUS
  );

  return (
    <TournamentExperienceShell
      title="Đăng ký & Công bố"
      subtitle="Hồ sơ đăng ký theo nội dung"
      showEventContext
      contextChip={<TournamentStatusChip tone="success" label="Đã công bố" />}
      actions={
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button variant="outlined" size="small" startIcon={<VisibilityOutlinedIcon />}>
            Xem trước
          </Button>
          <Button variant="contained" size="small">
            {publicationActionLabel}
          </Button>
          <Button variant="outlined" size="small" startIcon={<PersonAddIcon />}>
            Thêm VĐV
          </Button>
        </Stack>
      }
    >
      <Grid container spacing={1.25} sx={{ mb: 1.5, alignItems: "stretch" }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <TournamentKpiCard label="Tổng suất" value="64" hint="Tối đa" icon={<GroupsOutlinedIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <TournamentKpiCard label="Đã xác nhận" value="58" hint="90.6%" tone="success" icon={<CheckCircleOutlineIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <TournamentKpiCard label="Chờ duyệt" value="4" hint="6.3%" tone="warning" icon={<HourglassEmptyIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <TournamentKpiCard label="Danh sách chờ" value="5" hint="7.8%" tone="info" icon={<WarningAmberIcon />} />
        </Grid>
      </Grid>

      <TournamentWorkspace
        rail={
          <TournamentRightRailCard title="Công bố & phân phối" icon={<ShareOutlinedIcon sx={{ fontSize: 16 }} />}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted, mb: 0.6 }}>
              Kênh phân phối
            </Typography>
            <Stack spacing={0.5} sx={{ mb: 1.25 }}>
              {["Dashboard PICK_VN", "Website PICK_VN", "Trang giải đấu công khai"].map((item) => (
                <Stack key={item} direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <CheckCircleOutlineIcon sx={{ fontSize: 14, color: TOURNAMENT_COLOR.success }} />
                  <Typography sx={{ fontSize: 12.5 }}>{item}</Typography>
                </Stack>
              ))}
            </Stack>
            <Divider sx={{ mb: 1.25 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted, mb: 0.6 }}>
              Liên kết công khai
            </Typography>
            <TextField size="small" fullWidth value="pickvn.com/open-2026/md35" slotProps={{ input: { readOnly: true } }} />
            <Button startIcon={<ContentCopyIcon />} sx={{ mt: 0.75, mb: 1.25 }} size="small">
              Sao chép
            </Button>
            <Divider sx={{ mb: 1.25 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted, mb: 0.6 }}>
              QR đăng ký
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1.25, alignItems: "center" }}>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  border: `1px dashed ${TOURNAMENT_COLOR.divider}`,
                  borderRadius: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <QrCode2Icon sx={{ fontSize: 36, color: TOURNAMENT_COLOR.textMuted }} />
              </Box>
              <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted }}>
                Mã QR mẫu — không phát hành môi trường thật
              </Typography>
            </Stack>
            <Divider sx={{ mb: 1.25 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted, mb: 0.6 }}>
              Nút kêu gọi công khai
            </Typography>
            <Paper
              elevation={0}
              sx={{
                p: 1.1,
                mb: 1.25,
                bgcolor: TOURNAMENT_COLOR.primarySurface,
                borderRadius: `${TOURNAMENT_RADIUS.card}px`,
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: 13, mb: 0.75 }}>PICK VN OPEN 2026</Typography>
              <Button variant="contained" fullWidth size="small">
                Đăng ký ngay
              </Button>
            </Paper>
            <Divider sx={{ mb: 1.25 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted, mb: 0.6 }}>
              Sẵn sàng đóng đăng ký
            </Typography>
            <Stack spacing={0.5} sx={{ mb: 1 }}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 14, color: TOURNAMENT_COLOR.success }} />
                <Typography sx={{ fontSize: 12.5 }}>Đủ suất hợp lệ</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 14, color: TOURNAMENT_COLOR.success }} />
                <Typography sx={{ fontSize: 12.5 }}>Đã công bố public</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <ErrorOutlineIcon sx={{ fontSize: 14, color: TOURNAMENT_COLOR.warning }} />
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning }}>
                  2 hồ sơ thiếu thông tin — chưa sẵn sàng khóa
                </Typography>
              </Stack>
            </Stack>
            <Button
              variant="outlined"
              startIcon={<LockOutlinedIcon />}
              fullWidth
              size="small"
              sx={{
                color: TOURNAMENT_COLOR.text,
                borderColor: TOURNAMENT_COLOR.divider,
                "&:hover": { borderColor: TOURNAMENT_COLOR.text, bgcolor: TOURNAMENT_COLOR.hover },
              }}
            >
              Đóng đăng ký
            </Button>
            <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, mt: 0.75 }}>
              LOCK — cần xác nhận. Không phải Delete.
            </Typography>
          </TournamentRightRailCard>
        }
      >
        <TextField
          size="small"
          fullWidth
          placeholder="Tìm theo tên, SĐT, email, mã..."
          sx={{ mb: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Tabs
          value={tab}
          onChange={(_e, value) => setTab(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mb: 1, minHeight: 36, "& .MuiTab-root": { textTransform: "none", minHeight: 36, py: 0.5 } }}
        >
          {TABS.map((item) => (
            <Tab key={item.id} value={item.id} label={item.label} />
          ))}
        </Tabs>

        {isTable ? (
          <Paper
            elevation={0}
            sx={{
              border: `1px solid ${TOURNAMENT_COLOR.divider}`,
              borderRadius: `${TOURNAMENT_RADIUS.card}px`,
              overflow: "auto",
              maxWidth: "100%",
            }}
          >
            <Table size="small" sx={{ minWidth: 640, "& .MuiTableCell-root": { py: 0.7 } }}>
              <TableHead>
                <TableRow>
                  {["Mã", "Người đăng ký / Cặp", "Nguồn", "Trạng thái", "Thanh toán", "Check-in", "Thao tác"].map(
                    (header) => (
                      <TableCell key={header} sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted }}>
                        {header}
                      </TableCell>
                    )
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const status = STATUS_META[row.status];
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ fontSize: 12.5 }}>{row.id}</TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{row.names}</Typography>
                        <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted }}>{row.phone}</Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: 12.5 }}>{SOURCE_LABEL[row.source] || row.source}</TableCell>
                      <TableCell>
                        <TournamentStatusChip tone={status.tone} label={status.label} />
                      </TableCell>
                      <TableCell sx={{ fontSize: 12.5 }}>
                        {row.payment === "paid" ? "Đã thanh toán" : row.payment === "free" ? "Miễn phí" : "Chưa thanh toán"}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12.5 }}>{row.checkin ? "Đã check-in" : "Chưa check-in"}</TableCell>
                      <TableCell>
                        <Button size="small">{row.status === "pending" ? "Duyệt" : "Xem"}</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        ) : (
          <Box>
            {rows.map((row) => (
              <RegistrationRecord key={row.id} row={row} />
            ))}
          </Box>
        )}
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}
