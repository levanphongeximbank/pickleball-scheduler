import { useState } from "react";

import {
  Alert,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";

import {
  canCloseTournament,
  closeTournament,
  getTournamentSummary,
  isTournamentClosed,
} from "../../features/individual-tournament/engines/tournamentClosingEngine.js";

export default function CloseTournamentPanel({
  tournament,
  actor = null,
  onTournamentChange,
}) {
  const [message, setMessage] = useState(null);
  const closed = tournament ? isTournamentClosed(tournament) : false;
  const summary = tournament ? getTournamentSummary(tournament) : null;

  const handleClose = () => {
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
    onTournamentChange?.(result.tournament);
    setMessage({
      type: "success",
      text: "Đã đóng giải — kết quả khóa, BXH/bracket đóng băng, summary đã tạo.",
    });
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
        <Button
          variant="contained"
          color="error"
          startIcon={<LockIcon />}
          onClick={handleClose}
          disabled={closed}
        >
          {closed ? "Đã đóng giải" : "Đóng giải ngay"}
        </Button>
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
