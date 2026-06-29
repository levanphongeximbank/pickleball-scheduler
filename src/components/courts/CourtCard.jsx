import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import BuildIcon from "@mui/icons-material/Build";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";

import { getCourtDisplayName } from "../../models/court.js";
import { formatCurrency } from "../../domain/courtBookingEngine.js";
import { getRemainingAmount } from "../../models/booking.js";
import { formatTimeRange } from "../../pages/courtManagement/courtManagement.constants.js";
import { formatElapsedTime } from "../../utils/courtHelpers.js";

function PlayerSlot({ label, name, filled }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        px: 1,
        py: 0.75,
        borderRadius: 1,
        textAlign: "center",
        bgcolor: filled ? "rgba(79, 70, 229, 0.08)" : "rgba(15, 23, 42, 0.04)",
        border: `1px dashed ${filled ? "rgba(79,70,229,0.25)" : "rgba(15,23,42,0.12)"}`,
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>
        {label}
      </Typography>
      <Typography variant="caption" fontWeight={700} noWrap title={name}>
        {name || "—"}
      </Typography>
    </Box>
  );
}

export default function CourtCard({
  courtData,
  onCreateBooking,
  onDetail,
  onQuickStatus,
  onLockToggle,
  onMaintenanceToggle,
}) {
  const {
    court,
    index,
    currentBooking,
    nextBooking,
    status,
    statusMeta,
    elapsedMinutes,
    progress,
  } = courtData;

  const remaining = currentBooking
    ? getRemainingAmount(currentBooking.totalAmount, currentBooking.paidAmount)
    : 0;

  const isPlaying = status === "playing";
  const teamA = currentBooking?.teamA || currentBooking?.playerNames?.slice(0, 2) || [];
  const teamB = currentBooking?.teamB || currentBooking?.playerNames?.slice(2, 4) || [];

  const slots = isPlaying || currentBooking
    ? [
        { label: "A1", name: teamA[0] || currentBooking?.customerName },
        { label: "A2", name: teamA[1] },
        { label: "B1", name: teamB[0] },
        { label: "B2", name: teamB[1] },
      ]
    : [
        { label: "Vị trí 1", name: null },
        { label: "Vị trí 2", name: null },
        { label: "Vị trí 3", name: null },
        { label: "Vị trí 4", name: null },
      ];

  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        border: `1px solid ${statusMeta.border}`,
        bgcolor: statusMeta.bg,
        backdropFilter: "blur(6px)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: "0 14px 32px rgba(15, 23, 42, 0.1)",
        },
      }}
    >
      <CardContent sx={{ flex: 1, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <SportsTennisIcon sx={{ fontSize: 20, color: statusMeta.color }} />
            <Typography variant="subtitle1" fontWeight={900}>
              {getCourtDisplayName(court, index)}
            </Typography>
          </Stack>
          <Chip
            size="small"
            label={statusMeta.label}
            sx={{
              fontWeight: 800,
              bgcolor: `${statusMeta.color}20`,
              color: statusMeta.color,
              ...(isPlaying && {
                animation: "pulse 2s ease-in-out infinite",
                "@keyframes pulse": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.75 },
                },
              }),
            }}
          />
        </Stack>

        {currentBooking ? (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="body2" fontWeight={800}>
              {currentBooking.customerName || "Đang có trận"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTimeRange(currentBooking.startTime, currentBooking.endTime)}
              {isPlaying && ` · ${formatElapsedTime(elapsedMinutes)}`}
            </Typography>
            {isPlaying && (
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  mt: 1,
                  height: 4,
                  borderRadius: 999,
                  bgcolor: "rgba(15,23,42,0.08)",
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 999,
                    bgcolor: statusMeta.color,
                    transition: "transform 0.5s linear",
                  },
                }}
              />
            )}
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              Team A vs Team B
              {remaining > 0 && ` · Còn nợ ${formatCurrency(remaining)} đ`}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Sân trống — sẵn sàng xếp trận
          </Typography>
        )}

        <Stack direction="row" spacing={0.5}>
          {slots.map((slot) => (
            <PlayerSlot
              key={slot.label}
              label={slot.label}
              name={slot.name}
              filled={Boolean(slot.name)}
            />
          ))}
        </Stack>

        {nextBooking && nextBooking.id !== currentBooking?.id && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Tiếp theo: {nextBooking.customerName} ({nextBooking.startTime})
          </Typography>
        )}
      </CardContent>

      <CardActions sx={{ flexWrap: "wrap", gap: 0.5, px: 1.5, pb: 1.5, pt: 0 }}>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => onCreateBooking(court)}
          sx={{ fontWeight: 700, fontSize: 12 }}
        >
          Xếp trận
        </Button>

        {currentBooking?.bookingStatus === "playing" && (
          <Button
            size="small"
            variant="outlined"
            color="success"
            onClick={() => onQuickStatus(currentBooking, "completed")}
            sx={{ fontWeight: 700, fontSize: 12 }}
          >
            Kết thúc trận
          </Button>
        )}

        {currentBooking?.bookingStatus === "confirmed" && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => onQuickStatus(currentBooking, "checked_in")}
            sx={{ fontSize: 12 }}
          >
            Check-in
          </Button>
        )}

        {(currentBooking?.bookingStatus === "confirmed" ||
          currentBooking?.bookingStatus === "checked_in") && (
          <Button
            size="small"
            variant="contained"
            color="success"
            onClick={() => onQuickStatus(currentBooking, "playing")}
            sx={{ fontSize: 12 }}
          >
            Bắt đầu
          </Button>
        )}

        <Button
          size="small"
          startIcon={court.status === "locked" ? <LockOpenIcon /> : <LockIcon />}
          onClick={() => onLockToggle(court)}
          sx={{ fontSize: 12 }}
        >
          {court.status === "locked" ? "Mở khóa" : "Khóa"}
        </Button>

        <Button
          size="small"
          startIcon={<BuildIcon />}
          color={court.status === "maintenance" ? "warning" : "inherit"}
          onClick={() => onMaintenanceToggle(court)}
          sx={{ fontSize: 12 }}
        >
          {court.status === "maintenance" ? "Hết BT" : "Bảo trì"}
        </Button>

        {currentBooking && (
          <Button size="small" onClick={() => onDetail(currentBooking)} sx={{ fontSize: 12 }}>
            Chi tiết
          </Button>
        )}
      </CardActions>
    </Card>
  );
}
