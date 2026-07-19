import { useEffect, useState } from "react";

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";

import { MEMBERSHIP_PLANS } from "../../models/customer.js";
import { createCustomer, updateCustomer } from "../../domain/customerService.js";

import { getLocalCivilDate } from "../../domain/civilTime.js";

function toDateInputValue(isoValue) {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  return getLocalCivilDate(date);
}

export default function MemberFormDialog({
  open,
  onClose,
  clubId,
  editingMember = null,
  onSaved,
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [membershipPlan, setMembershipPlan] = useState("monthly");
  const [membershipExpiresAt, setMembershipExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;

    setName(editingMember?.name || "");
    setPhone(editingMember?.phone || "");
    setMembershipPlan(editingMember?.membershipPlan || "monthly");
    setMembershipExpiresAt(toDateInputValue(editingMember?.membershipExpiresAt));
    setNote(editingMember?.note || "");
    setError(null);
  }, [open, editingMember]);

  const handleSubmit = () => {
    const payload = {
      name,
      phone,
      customerType: "member",
      membershipPlan,
      membershipExpiresAt: membershipExpiresAt
        ? new Date(`${membershipExpiresAt}T23:59:59`).toISOString()
        : "",
      note,
    };

    const result = editingMember
      ? updateCustomer(editingMember.id, payload, clubId)
      : createCustomer(payload, clubId);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onSaved?.(result.customer);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editingMember ? "Sửa hội viên" : "Thêm hội viên"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Tên hội viên"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
            required
          />

          <TextField
            label="Số điện thoại"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>Gói hội viên</InputLabel>
            <Select
              label="Gói hội viên"
              value={membershipPlan}
              onChange={(event) => setMembershipPlan(event.target.value)}
            >
              {MEMBERSHIP_PLANS.map((plan) => (
                <MenuItem key={plan.value} value={plan.value}>
                  {plan.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Ngày hết hạn"
            type="date"
            value={membershipExpiresAt}
            onChange={(event) => setMembershipExpiresAt(event.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Ghi chú"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Hủy</Button>
        <Button variant="contained" onClick={handleSubmit}>
          Lưu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
