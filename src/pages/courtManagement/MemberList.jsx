import { useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
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
import AddIcon from "@mui/icons-material/Add";
import GroupsIcon from "@mui/icons-material/Groups";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import { loadCustomersForClub, loadBookingsForClub } from "../../domain/clubStorage.js";
import { formatCurrency } from "../../domain/courtBookingEngine.js";
import PermissionGate from "../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import {
  getMembershipPlanLabel,
  getMembershipStatus,
} from "../../models/customer.js";
import CustomerDetailDialog from "./CustomerDetailDialog.jsx";
import MemberFormDialog from "./MemberFormDialog.jsx";
import BookingForm from "./BookingForm.jsx";
import BookingDetail from "./BookingDetail.jsx";
import { todayIsoDate } from "./courtManagement.constants.js";

const STATUS_LABELS = {
  active: "Đang hiệu lực",
  expired: "Hết hạn",
};

const STATUS_COLORS = {
  active: "success",
  expired: "error",
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN");
}

function SummaryCard({ label, value, icon: Icon, color = "primary.main" }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: `${color}14`,
            color,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h6" fontWeight={700}>
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function MemberList({ clubId, courts = [], revision = 0, onRefresh }) {
  const [selectedMember, setSelectedMember] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bookingFormMember, setBookingFormMember] = useState(null);

  const members = useMemo(
    () =>
      loadCustomersForClub(clubId)
        .filter((customer) => customer.customerType === "member")
        .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0)),
    [clubId, revision]
  );

  const bookings = useMemo(() => loadBookingsForClub(clubId), [clubId, revision]);

  const summary = useMemo(() => {
    const now = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);

    let active = 0;
    let expiringSoon = 0;

    for (const member of members) {
      const status = getMembershipStatus(member);
      if (status === "active") {
        active += 1;
        if (member.membershipExpiresAt) {
          const expires = new Date(member.membershipExpiresAt);
          if (!Number.isNaN(expires.getTime()) && expires <= soon && expires >= now) {
            expiringSoon += 1;
          }
        }
      }
    }

    return { total: members.length, active, expiringSoon };
  }, [members]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return members.filter((member) => {
      const status = getMembershipStatus(member);
      if (statusFilter === "active" && status !== "active") return false;
      if (statusFilter === "expired" && status !== "expired") return false;

      if (!query) return true;

      return (
        member.name.toLowerCase().includes(query) ||
        (member.phone && member.phone.includes(query))
      );
    });
  }, [members, search, statusFilter]);

  const openCreateForm = () => {
    setEditingMember(null);
    setFormOpen(true);
  };

  const openEditForm = (member) => {
    setEditingMember(member);
    setFormOpen(true);
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          Quản lý hội viên: gói thành viên, hạn sử dụng và lịch sử sử dụng sân.
        </Typography>
        <PermissionGate permission={PERMISSIONS.CUSTOMER_UPDATE}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateForm}>
            Thêm hội viên
          </Button>
        </PermissionGate>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <SummaryCard label="Tổng hội viên" value={summary.total} icon={GroupsIcon} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <SummaryCard
            label="Đang hiệu lực"
            value={summary.active}
            icon={EventAvailableIcon}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <SummaryCard
            label="Sắp hết hạn (30 ngày)"
            value={summary.expiringSoon}
            icon={WarningAmberIcon}
            color="warning.main"
          />
        </Grid>
      </Grid>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Tìm theo tên hoặc SĐT"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          fullWidth
        />
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel>Trạng thái</InputLabel>
          <Select
            label="Trạng thái"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <MenuItem value="all">Tất cả</MenuItem>
            <MenuItem value="active">Đang hiệu lực</MenuItem>
            <MenuItem value="expired">Hết hạn</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {members.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Chưa có hội viên. Bấm &quot;Thêm hội viên&quot; để bắt đầu hoặc chuyển khách hàng sang loại hội viên tại trang Khách hàng.
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tên</TableCell>
              <TableCell>Điện thoại</TableCell>
              <TableCell>Gói</TableCell>
              <TableCell>Gia nhập</TableCell>
              <TableCell>Hết hạn</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Booking</TableCell>
              <TableCell>Đã chi</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMembers.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                    {search || statusFilter !== "all"
                      ? "Không tìm thấy hội viên phù hợp."
                      : "Chưa có hội viên."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {filteredMembers.map((member) => {
              const status = getMembershipStatus(member);
              return (
                <TableRow
                  key={member.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => setSelectedMember(member)}
                >
                  <TableCell>{member.name}</TableCell>
                  <TableCell>{member.phone || "—"}</TableCell>
                  <TableCell>{getMembershipPlanLabel(member.membershipPlan)}</TableCell>
                  <TableCell>{formatDate(member.memberSince || member.createdAt)}</TableCell>
                  <TableCell>{formatDate(member.membershipExpiresAt)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={STATUS_LABELS[status] || status}
                      color={STATUS_COLORS[status] || "default"}
                    />
                  </TableCell>
                  <TableCell>{member.totalBookings || 0}</TableCell>
                  <TableCell>{formatCurrency(member.totalSpent || 0)} đ</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <MemberFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        clubId={clubId}
        editingMember={editingMember}
        onSaved={() => onRefresh?.()}
      />

      <CustomerDetailDialog
        open={Boolean(selectedMember)}
        customer={selectedMember}
        bookings={bookings}
        clubId={clubId}
        onClose={() => setSelectedMember(null)}
        onEdit={(member) => {
          setSelectedMember(null);
          openEditForm(member);
        }}
        onDeleted={() => {
          setSelectedMember(null);
          onRefresh?.();
        }}
        onOpenBooking={(booking) => {
          setSelectedMember(null);
          setDetailBooking(booking);
        }}
        onBookCourt={(member) => {
          setSelectedMember(null);
          setBookingFormMember(member);
        }}
      />

      <BookingForm
        open={Boolean(bookingFormMember)}
        onClose={() => setBookingFormMember(null)}
        clubId={clubId}
        courts={courts}
        initialValues={{
          date: todayIsoDate(),
          customerName: bookingFormMember?.name || "",
          customerPhone: bookingFormMember?.phone || "",
        }}
        onSaved={() => {
          setBookingFormMember(null);
          onRefresh?.();
        }}
      />

      <BookingDetail
        open={Boolean(detailBooking)}
        booking={detailBooking}
        clubId={clubId}
        courts={courts}
        onClose={() => setDetailBooking(null)}
        onUpdated={() => {
          setDetailBooking(null);
          onRefresh?.();
        }}
      />
    </Box>
  );
}
