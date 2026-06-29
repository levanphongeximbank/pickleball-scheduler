import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";

import { useClub } from "../../context/ClubContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { ROLE_LABELS } from "../../auth/roles.js";
import PermissionGate from "../auth/PermissionGate.jsx";
import {
  activateVenueStaff,
  getInvitableRoles,
  inviteVenueStaff,
  listVenueStaff,
  removeVenueStaff,
  syncStaffInviteToSupabase,
} from "../../domain/staffService.js";
import { getVenueSummaryForClub } from "../../domain/venueService.js";
import { USER_STATUS } from "../../models/user.js";

const STATUS_LABELS = {
  [USER_STATUS.ACTIVE]: "Đang hoạt động",
  [USER_STATUS.INVITED]: "Đã mời",
  [USER_STATUS.SUSPENDED]: "Tạm khóa",
};

export default function VenueStaffPanel() {
  const { activeClubId } = useClub();
  const { supabaseAvailable } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState(getInvitableRoles()[0]);
  const [message, setMessage] = useState(null);
  const [revision, setRevision] = useState(0);

  const summary = useMemo(
    () => getVenueSummaryForClub(activeClubId),
    [activeClubId, revision]
  );

  const staff = useMemo(() => {
    if (!summary.venue?.id) {
      return [];
    }
    return listVenueStaff(summary.venue.id);
  }, [summary.venue?.id, revision]);

  const handleInvite = async () => {
    if (!summary.venue?.id) {
      setMessage({ type: "error", text: "CLB chưa gắn venue." });
      return;
    }

    const result = inviteVenueStaff(summary.venue.id, {
      email,
      displayName,
      role,
      clubId: role === "CLUB_OWNER" ? activeClubId : null,
    });

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    if (supabaseAvailable) {
      const synced = await syncStaffInviteToSupabase(result.member);
      if (!synced.ok && synced.code !== "NO_SUPABASE") {
        setMessage({
          type: "warning",
          text: `Đã lưu local. Supabase: ${synced.error || "chưa sync profile"}`,
        });
      }
    }

    setEmail("");
    setDisplayName("");
    setRevision((value) => value + 1);
    setMessage({ type: "success", text: `Đã mời ${result.member.email}.` });
  };

  const handleActivate = (memberId) => {
    const result = activateVenueStaff(summary.venue.id, memberId);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setRevision((value) => value + 1);
    setMessage({ type: "success", text: "Đã kích hoạt nhân sự." });
  };

  const handleRemove = (memberId) => {
    const result = removeVenueStaff(summary.venue.id, memberId);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setRevision((value) => value + 1);
    setMessage({ type: "info", text: "Đã xóa khỏi danh sách." });
  };

  if (!summary.venue) {
    return null;
  }

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <GroupIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            Nhân sự venue
          </Typography>
          <Chip size="small" variant="outlined" label={`${staff.length} user`} />
        </Stack>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <PermissionGate permission={PERMISSIONS.VENUE_STAFF_MANAGE} scope={{ venueId: summary.venue.id }}>
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                size="small"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
              />
              <TextField
                size="small"
                label="Tên hiển thị"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                fullWidth
              />
              <TextField
                select
                size="small"
                label="Vai trò"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                {getInvitableRoles().map((item) => (
                  <MenuItem key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="contained" onClick={handleInvite} disabled={!email.trim()}>
                Mời
              </Button>
            </Stack>
          </Stack>
        </PermissionGate>

        {staff.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chưa có nhân sự. Mời quản lý, thu ngân hoặc kế toán cho venue này.
          </Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tên</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Vai trò</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.displayName}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{ROLE_LABELS[member.role] || member.role}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={STATUS_LABELS[member.status] || member.status}
                        color={member.status === USER_STATUS.ACTIVE ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <PermissionGate permission={PERMISSIONS.VENUE_STAFF_MANAGE} scope={{ venueId: summary.venue.id }}>
                        {member.status === USER_STATUS.INVITED && (
                          <IconButton size="small" onClick={() => handleActivate(member.id)} title="Kích hoạt">
                            <CheckCircleOutlinedIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton size="small" onClick={() => handleRemove(member.id)} title="Xóa">
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </PermissionGate>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
