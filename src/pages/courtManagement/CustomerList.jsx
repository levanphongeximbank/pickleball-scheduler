import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
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

import { loadCustomersForClub, loadBookingsForClub } from "../../domain/clubStorage.js";
import {
  buildCustomerCsv,
  mergeCustomersByPhone,
  recalculateAllCustomerStats,
} from "../../domain/customerService.js";
import { formatCurrency } from "../../domain/courtBookingEngine.js";
import { downloadTextFile } from "../../domain/courtManagementSettings.js";
import PermissionGate from "../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { usePlatformRuntime } from "../../core/platform/app/usePlatformRuntime.js";
import CustomerDetailDialog from "./CustomerDetailDialog.jsx";
import CustomerFormDialog from "./CustomerFormDialog.jsx";
import BookingForm from "./BookingForm.jsx";
import BookingDetail from "./BookingDetail.jsx";
import { todayIsoDate } from "./courtManagement.constants.js";

const CUSTOMER_TYPE_LABELS = {
  walk_in: "Khách lẻ",
  member: "Hội viên",
  club: "CLB",
  visitor: "Khách vãng lai",
};

export default function CustomerList({ clubId, courts = [], revision = 0, onRefresh }) {
  const runtime = usePlatformRuntime();
  const [searchParams] = useSearchParams();
  const typeFilter = searchParams.get("type") || "all";
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [search, setSearch] = useState("");
  const [debtFilter, setDebtFilter] = useState("all");
  const [message, setMessage] = useState(null);
  const [bookingFormCustomer, setBookingFormCustomer] = useState(null);
  const [accessAllowed, setAccessAllowed] = useState(true);

  useEffect(() => {
    const query = searchParams.get("q");

    if (query) {
      setSearch(query);
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const tenantId = clubId || "customer-list-preview";
      const decision = runtime.accessService.authorize(
        {
          user_id: "demo-admin",
          tenant_id: tenantId,
          role: "SUPER_ADMIN",
        },
        { tenant_id: tenantId },
        "customer.manage"
      );
      setAccessAllowed(Boolean(decision.allowed));
    } catch {
      setAccessAllowed(false);
    }
  }, [clubId, runtime]);

  const customers = useMemo(
    () =>
      [...loadCustomersForClub(clubId)].sort(
        (a, b) => (b.totalSpent || 0) - (a.totalSpent || 0)
      ),
    [clubId, revision]
  );

  const bookings = useMemo(() => loadBookingsForClub(clubId), [clubId, revision]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return customers.filter((customer) => {
      if (typeFilter === "member" && customer.type !== "member") {
        return false;
      }
      if (debtFilter === "debt" && (customer.debtAmount || 0) <= 0) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        customer.name.toLowerCase().includes(query) ||
        (customer.phone && customer.phone.includes(query))
      );
    });
  }, [customers, search, debtFilter, typeFilter]);

  const openCreateForm = () => {
    if (!accessAllowed) {
      setMessage("Runtime platform chặn thao tác quản lý khách.");
      return;
    }
    setEditingCustomer(null);
    setFormOpen(true);
  };

  const openEditForm = (customer) => {
    if (!accessAllowed) {
      setMessage("Runtime platform chặn thao tác quản lý khách.");
      return;
    }
    setEditingCustomer(customer);
    setFormOpen(true);
  };

  const handleRecalculate = () => {
    if (!accessAllowed) {
      setMessage("Runtime platform chặn thao tác quản lý khách.");
      return;
    }
    recalculateAllCustomerStats(clubId);
    setMessage("Đã cập nhật lại thống kê khách.");
    onRefresh?.();
  };

  const handleMerge = () => {
    if (!accessAllowed) {
      setMessage("Runtime platform chặn thao tác quản lý khách.");
      return;
    }
    const result = mergeCustomersByPhone(clubId);
    setMessage(result.message);
    onRefresh?.();
  };

  const handleExport = () => {
    downloadTextFile("khach-hang.csv", buildCustomerCsv(customers));
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
          Quản lý khách hàng: thêm, sửa, xóa và xem lịch sử booking.
        </Typography>
        <Chip
          size="small"
          label={`Runtime access: ${accessAllowed ? "allowed" : "denied"}`}
          color={accessAllowed ? "success" : "warning"}
        />
        <PermissionGate permission={PERMISSIONS.CUSTOMER_UPDATE}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateForm}>
            Thêm khách
          </Button>
        </PermissionGate>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <PermissionGate permission={PERMISSIONS.CUSTOMER_UPDATE}>
          <Button size="small" variant="outlined" onClick={handleRecalculate}>
            Cập nhật thống kê
          </Button>
          <Button size="small" variant="outlined" onClick={handleMerge}>
            Gộp trùng SĐT
          </Button>
        </PermissionGate>
        <Button size="small" variant="outlined" onClick={handleExport}>
          Xuất CSV
        </Button>
      </Stack>

      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Tìm theo tên hoặc SĐT"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          fullWidth
        />
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel>Lọc công nợ</InputLabel>
          <Select
            label="Lọc công nợ"
            value={debtFilter}
            onChange={(event) => setDebtFilter(event.target.value)}
          >
            <MenuItem value="all">Tất cả khách</MenuItem>
            <MenuItem value="debt">Còn nợ</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tên</TableCell>
              <TableCell>Điện thoại</TableCell>
              <TableCell>Loại</TableCell>
              <TableCell>Booking</TableCell>
              <TableCell>Đã chi</TableCell>
              <TableCell>Công nợ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCustomers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                    {search ? "Không tìm thấy khách phù hợp." : "Chưa có khách. Thêm mới hoặc tạo booking."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {filteredCustomers.map((customer) => (
              <TableRow
                key={customer.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => setSelectedCustomer(customer)}
              >
                <TableCell>{customer.name}</TableCell>
                <TableCell>{customer.phone || "—"}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={CUSTOMER_TYPE_LABELS[customer.customerType] || customer.customerType}
                  />
                </TableCell>
                <TableCell>{customer.totalBookings || 0}</TableCell>
                <TableCell>{formatCurrency(customer.totalSpent || 0)} đ</TableCell>
                <TableCell>
                  {(customer.debtAmount || 0) > 0 ? (
                    <Typography color="error.main" fontWeight="medium">
                      {formatCurrency(customer.debtAmount)} đ
                    </Typography>
                  ) : (
                    "0 đ"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <CustomerFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        clubId={clubId}
        editingCustomer={editingCustomer}
        onSaved={() => onRefresh?.()}
      />

      <CustomerDetailDialog
        open={Boolean(selectedCustomer)}
        customer={selectedCustomer}
        bookings={bookings}
        clubId={clubId}
        onClose={() => setSelectedCustomer(null)}
        onEdit={(customer) => {
          setSelectedCustomer(null);
          openEditForm(customer);
        }}
        onDeleted={() => {
          setSelectedCustomer(null);
          onRefresh?.();
        }}
        onOpenBooking={(booking) => {
          setSelectedCustomer(null);
          setDetailBooking(booking);
        }}
        onBookCourt={(customer) => {
          setSelectedCustomer(null);
          setBookingFormCustomer(customer);
        }}
      />

      <BookingForm
        open={Boolean(bookingFormCustomer)}
        onClose={() => setBookingFormCustomer(null)}
        clubId={clubId}
        courts={courts}
        initialValues={{
          date: todayIsoDate(),
          customerName: bookingFormCustomer?.name || "",
          customerPhone: bookingFormCustomer?.phone || "",
        }}
        onSaved={() => {
          setBookingFormCustomer(null);
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
