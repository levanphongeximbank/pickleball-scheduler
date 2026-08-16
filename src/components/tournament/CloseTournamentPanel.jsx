import { useState } from "react";

import {
  Alert,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";

import {
  canCloseTournament,
  closeTournament,
  getTournamentSummary,
  isTournamentClosed,
  reopenClosedTournament,
} from "../../features/individual-tournament/engines/tournamentClosingEngine.js";

export default function CloseTournamentPanel({
  tournament,
  actor = null,
  onTournamentChange,
}) {
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const closed = tournament ? isTournamentClosed(tournament) : false;
  const summary = tournament ? getTournamentSummary(tournament) : null;

  const handleClose = async () => {
    const check = canCloseTournament(tournament);
    if (!check.ok) {
      setMessage({ type: "error", text: check.error });
      return;
    }
    const result = closeTournament(tournament, { actor, autoAwards: true });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setBusy(true);
    try {
      const persisted = await onTournamentChange?.(result.tournament, {
        forceStatusReopen: false,
      });
      if (persisted === false) {
        setMessage({ type: "error", text: "Không lưu được trạng thái đóng giải." });
        return;
      }
      setMessage({
        type: "success",
        text: "Đã đóng giải — kết quả khóa, BXH/bracket đóng băng, summary đã tạo.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReopen = async () => {
    if (
      !window.confirm(
        "Mở lại giải đã hoàn tất? Kết quả sẽ được mở khóa để chỉnh sửa (force reopen)."
      )
    ) {
      return;
    }
    const result = reopenClosedTournament(tournament, { force: true, actor });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setBusy(true);
    try {
      const persisted = await onTournamentChange?.(result.tournament, {
        forceStatusReopen: true,
      });
      if (persisted === false) {
        setMessage({ type: "error", text: "Không mở lại được giải trên máy chủ." });
        return;
      }
      setMessage({
        type: "success",
        text: "Đã mở lại giải (completed → active) với force reopen + CAS.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!tournament) {
    return <Alert severity="info">Chọn giải để đóng giải.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {message ? (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Đóng giải đấu
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Khóa mọi kết quả trận, đóng băng bảng xếp hạng & nhánh, gán giải tự động (nếu chưa), tạo
          tóm tắt giải.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            color="error"
            startIcon={<LockIcon />}
            onClick={() => void handleClose()}
            disabled={closed || busy}
          >
            {closed ? "Đã đóng giải" : "Đóng giải ngay"}
          </Button>
          {closed ? (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<LockOpenIcon />}
              onClick={() => void handleReopen()}
              disabled={busy}
            >
              Mở lại giải
            </Button>
          ) : null}
        </Stack>
      </Paper>

      {summary ? (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Tóm tắt giải
          </Typography>
          <Typography variant="body2">Trận hoàn thành: {summary.completedMatchCount}/{summary.matchCount}</Typography>
          <Typography variant="body2">Walkover: {summary.walkoverCount}</Typography>
          <Typography variant="body2">Rút lui đã duyệt: {summary.withdrawalCount}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Vô địch: {summary.champion?.entryName || summary.champion?.entryId || "—"}
          </Typography>
          {summary.closedAt ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Đóng lúc {new Date(summary.closedAt).toLocaleString("vi-VN")}
            </Typography>
          ) : null}
        </Paper>
      ) : null}
    </Stack>
  );
}
