import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import {
  createCustomerGroup,
  deleteCustomerGroup,
  listCustomerGroups,
} from "../../features/customer-groups/services/customerGroupService.js";

export default function CustomerGroupsPage() {
  const { clubId, onRefresh } = useOutletContext();
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const groups = useMemo(() => listCustomerGroups(clubId), [clubId, revision]);

  const handleCreate = () => {
    if (!name.trim()) return;
    createCustomerGroup(clubId, { name, description });
    setName("");
    setDescription("");
    setOpen(false);
    setRevision((v) => v + 1);
    onRefresh?.();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          Nhóm khách hàng
        </Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setOpen(true)}>
          Tạo nhóm
        </Button>
      </Stack>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tên nhóm</TableCell>
              <TableCell>Mô tả</TableCell>
              <TableCell align="right">Thành viên</TableCell>
              <TableCell width={56} />
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary">Chưa có nhóm — tạo nhóm để phân khúc KH.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>{group.name}</TableCell>
                  <TableCell>{group.description || "—"}</TableCell>
                  <TableCell align="right">{group.memberIds?.length || 0}</TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => {
                        deleteCustomerGroup(clubId, group.id);
                        setRevision((v) => v + 1);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Tạo nhóm khách hàng</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Tên nhóm" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <TextField
              label="Mô tả"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleCreate}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
