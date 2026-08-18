import { useMemo, useState } from "react";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SearchIcon from "@mui/icons-material/Search";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import {
  Button,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentStatusChip from "../components/TournamentStatusChip.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import { ChipRow, FixtureAuthorityNote, ReadinessPanel, SurfaceState } from "../components/prototypeSurfaces.jsx";
import { MobileRecordCard } from "../components/prototypeCards.jsx";
import { TOURNAMENT_COLOR } from "../design/tournamentDesignTokens.js";
import { FIXTURE_PARTICIPANTS } from "../fixtures/opsFixture.js";

const PAYMENT_LABEL = { paid: "Đã thanh toán", unpaid: "Chưa thanh toán" };
const PROFILE_LABEL = { complete: "Đủ hồ sơ", incomplete: "Thiếu hồ sơ" };

function participantReadyItems(rows) {
  const unpaid = rows.filter((row) => row.payment !== "paid").length;
  const incomplete = rows.filter((row) => row.profile !== "complete").length;
  return [
    { label: "Thanh toán đủ", ready: unpaid === 0, note: unpaid ? `${unpaid} cặp chưa thanh toán` : "Tất cả đã thanh toán" },
    { label: "Hồ sơ đủ", ready: incomplete === 0, note: incomplete ? `${incomplete} cặp thiếu hồ sơ` : "Tất cả đủ hồ sơ" },
    { label: "Check-in bắt buộc", ready: true, note: "Không chặn chốt danh sách" },
  ];
}

export default function ParticipantsLockPage() {
  const theme = useTheme();
  const isTable = useMediaQuery(theme.breakpoints.up("md"));
  const [locked, setLocked] = useState(false);
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState("all");
  const [profile, setProfile] = useState("all");
  const [checkin, setCheckin] = useState("all");
  const [eligibility, setEligibility] = useState("all");
  const [issue, setIssue] = useState("all");

  const readyItems = participantReadyItems(FIXTURE_PARTICIPANTS);
  const blockers = readyItems.filter((item) => !item.ready);
  const notReady = blockers.length > 0;
  const canLock = !notReady && !locked;

  const kpis = useMemo(() => ({
    total: FIXTURE_PARTICIPANTS.length,
    paid: FIXTURE_PARTICIPANTS.filter((row) => row.payment === "paid").length,
    checkedIn: FIXTURE_PARTICIPANTS.filter((row) => row.checkin).length,
    complete: FIXTURE_PARTICIPANTS.filter((row) => row.profile === "complete").length,
    blocked: FIXTURE_PARTICIPANTS.filter((row) => !row.eligible || row.issue).length,
  }), []);

  const rows = FIXTURE_PARTICIPANTS.filter((row) => {
    const hay = `${row.names} ${row.id} ${row.issue || ""}`.toLowerCase();
    if (query && !hay.includes(query.trim().toLowerCase())) return false;
    if (payment !== "all" && row.payment !== payment) return false;
    if (profile !== "all" && row.profile !== profile) return false;
    if (checkin !== "all" && Boolean(row.checkin) !== (checkin === "yes")) return false;
    if (eligibility !== "all" && Boolean(row.eligible) !== (eligibility === "ready")) return false;
    if (issue === "has" && !row.issue) return false;
    if (issue === "none" && row.issue) return false;
    return true;
  });

  const lockLabel = "Chốt danh sách";

  return (
    <TournamentExperienceShell
      title="Người tham dự / Chốt danh sách"
      subtitle="Tách biệt Đăng ký & Công bố"
      showEventContext
      actions={
        <Button
          variant="outlined"
          size="small"
          startIcon={<LockOutlinedIcon />}
          disabled={!canLock}
          onClick={() => setLocked(true)}
        >
          {lockLabel}
        </Button>
      }
    >
      <FixtureAuthorityNote>Chốt danh sách là bước khóa nguyên mẫu. Không tạo quyền chốt danh sách thật.</FixtureAuthorityNote>
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, md: true }}><TournamentKpiCard label="Tổng cặp" value={kpis.total} icon={<GroupsOutlinedIcon />} /></Grid>
        <Grid size={{ xs: 6, md: true }}><TournamentKpiCard label="Đã thanh toán" value={kpis.paid} tone="success" /></Grid>
        <Grid size={{ xs: 6, md: true }}><TournamentKpiCard label="Đã check-in" value={kpis.checkedIn} /></Grid>
        <Grid size={{ xs: 6, md: true }}><TournamentKpiCard label="Đủ hồ sơ" value={kpis.complete} tone="success" /></Grid>
        <Grid size={{ xs: 6, md: true }}><TournamentKpiCard label="Bị chặn / Cần xử lý" value={kpis.blocked} tone="warning" /></Grid>
      </Grid>
      <TextField
        size="small"
        fullWidth
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Tìm cặp, mã, sự cố…"
        sx={{ mb: 1.25, maxWidth: 480 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: TOURNAMENT_COLOR.textMuted }} />
              </InputAdornment>
            ),
          },
        }}
      />
      <ChipRow
        value={payment}
        onChange={setPayment}
        items={[
          { id: "all", label: "Thanh toán: tất cả" },
          { id: "paid", label: "Đã thanh toán" },
          { id: "unpaid", label: "Chưa thanh toán" },
        ]}
      />
      <ChipRow
        value={profile}
        onChange={setProfile}
        items={[
          { id: "all", label: "Hồ sơ: tất cả" },
          { id: "complete", label: "Đủ hồ sơ" },
          { id: "incomplete", label: "Thiếu hồ sơ" },
        ]}
      />
      <ChipRow
        value={checkin}
        onChange={setCheckin}
        items={[
          { id: "all", label: "Check-in: tất cả" },
          { id: "yes", label: "Đã check-in" },
          { id: "no", label: "Chưa check-in" },
        ]}
      />
      <ChipRow
        value={eligibility}
        onChange={setEligibility}
        items={[
          { id: "all", label: "Điều kiện: tất cả" },
          { id: "ready", label: "Đủ điều kiện" },
          { id: "blocked", label: "Bị chặn" },
        ]}
      />
      <ChipRow
        value={issue}
        onChange={setIssue}
        items={[
          { id: "all", label: "Sự cố: tất cả" },
          { id: "has", label: "Có sự cố" },
          { id: "none", label: "Không sự cố" },
        ]}
      />
      <TournamentWorkspace
        rail={
          <>
            <ReadinessPanel
              title={notReady ? "Chưa sẵn sàng chốt" : "Sẵn sàng chốt danh sách"}
              statusLabel={notReady ? `CHƯA SẴN SÀNG • ${blockers.length}` : "SẴN SÀNG"}
              statusTone={notReady ? "warning" : "success"}
              items={readyItems}
              lockLabel={lockLabel}
              lockDisabled={!canLock}
              onLock={() => setLocked(true)}
            />
            <TournamentRightRailCard title="Tác động sau khi chốt">
              <Typography sx={{ fontSize: 12.5, mb: 0.75 }}>
                {locked
                  ? "Dữ liệu mẫu: danh sách đã khóa. Không thêm/xóa thường."
                  : "Sau khi chốt danh sách: không thêm VĐV thường. Mọi thay đổi cần Điều chỉnh / Mở lại."}
              </Typography>
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>
                LƯU ≠ KHÓA. Chỉ là bản sao nguyên mẫu.
              </Typography>
            </TournamentRightRailCard>
          </>
        }
      >
        <SurfaceState state={rows.length ? "ready" : "empty"} emptyText="Không có cặp khớp bộ lọc.">
          {isTable ? (
            <Paper elevation={0} sx={{ border: `1px solid ${TOURNAMENT_COLOR.divider}`, overflow: "auto" }}>
              <Table size="small" sx={{ minWidth: 720, "& .MuiTableCell-root": { py: 0.7 } }}>
                <TableHead>
                  <TableRow>
                    {["Cặp / đội", "Thanh toán", "Hồ sơ", "Check-in", "Điều kiện", "Sự cố", "Thao tác"].map((h) => (
                      <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{row.names}</Typography>
                        <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>{row.id}</Typography>
                      </TableCell>
                      <TableCell>
                        <TournamentStatusChip tone={row.payment === "paid" ? "success" : "warning"} label={PAYMENT_LABEL[row.payment]} />
                      </TableCell>
                      <TableCell>
                        <TournamentStatusChip tone={row.profile === "complete" ? "success" : "warning"} label={PROFILE_LABEL[row.profile]} />
                      </TableCell>
                      <TableCell>{row.checkin ? "Đã check-in" : "Chưa check-in"}</TableCell>
                      <TableCell>
                        <TournamentStatusChip tone={row.eligible ? "success" : "warning"} label={row.eligible ? "Đủ điều kiện" : "Bị chặn"} />
                      </TableCell>
                      <TableCell sx={{ color: row.issue ? TOURNAMENT_COLOR.warning : TOURNAMENT_COLOR.textMuted }}>
                        {row.issue || "—"}
                      </TableCell>
                      <TableCell>
                        <Button size="small">Xem</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          ) : (
            rows.map((row) => (
              <MobileRecordCard
                key={row.id}
                title={row.names}
                status={<TournamentStatusChip tone={row.eligible ? "success" : "warning"} label={row.eligible ? "Đủ điều kiện" : "Bị chặn"} />}
                meta={
                  <Stack spacing={0.35}>
                    <Typography sx={{ fontSize: 12, color: row.issue ? TOURNAMENT_COLOR.warning : TOURNAMENT_COLOR.text }}>
                      {row.issue || "Không sự cố chặn"}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                      {PAYMENT_LABEL[row.payment]} • {PROFILE_LABEL[row.profile]}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                      {row.id} • {row.checkin ? "Đã check-in" : "Chưa check-in"}
                    </Typography>
                  </Stack>
                }
                action={<Button size="small">Xem</Button>}
              />
            ))
          )}
        </SurfaceState>
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}
