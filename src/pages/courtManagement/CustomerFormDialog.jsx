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

import { CUSTOMER_TYPES } from "../../models/customer.js";
import { createCustomer, updateCustomer } from "../../domain/customerService.js";

const CUSTOMER_TYPE_LABELS = {
  walk_in: "Khách lẻ",
  member: "Hội viên",
  club: "CLB",
  visitor: "Khách vãng lai",
};

export default function CustomerFormDialog({
  open,
  onClose,
  clubId,
  editingCustomer = null,
  onSaved,
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customerType, setCustomerType] = useState("walk_in");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(editingCustomer?.name || "");
    setPhone(editingCustomer?.phone || "");
    setCustomerType(editingCustomer?.customerType || "walk_in");
    setNote(editingCustomer?.note || "");
    setError(null);
  }, [open, editingCustomer]);

  const handleSubmit = () => {
    const payload = {
      name,
      phone,
      customerType,
      note,
    };

    const result = editingCustomer
      ? updateCustomer(editingCustomer.id, payload, clubId)
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
      <DialogTitle>{editingCustomer ? "Sửa khách hàng" : "Thêm khách hàng"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Tên khách"
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
            <InputLabel>Loại khách</InputLabel>
            <Select
              label="Loại khách"
              value={customerType}
              onChange={(event) => setCustomerType(event.target.value)}
            >
              {CUSTOMER_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {CUSTOMER_TYPE_LABELS[type] || type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

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
