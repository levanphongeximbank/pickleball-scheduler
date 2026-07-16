import { useState } from "react";
import {
  Button,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditIcon from "@mui/icons-material/Edit";

import {
  addDisciplineToTournament,
  removeDisciplineFromTournament,
  updateDisciplineInTournament,
} from "../../../features/team-tournament/engines/teamTournamentEngine.js";
import TournamentActionBar from "../TournamentActionBar.jsx";
import TournamentSectionCard from "../TournamentSectionCard.jsx";
import { tournamentTableCellSx, tournamentTableHeadSx } from "../tournamentLayout.js";

export default function TeamDisciplinesPanel({
  teamData,
  canManage,
  onSave,
  onError,
}) {
  const [disciplineName, setDisciplineName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");

  async function handleAdd() {
    const trimmed = disciplineName.trim();
    if (!trimmed) {
      onError?.("Nhập tên nội dung.");
      return;
    }
    const next = addDisciplineToTournament(teamData, { name: trimmed, playerCount: 2 });
    const ok = await onSave?.(next);
    if (ok === false) {
      return;
    }
    setDisciplineName("");
  }

  async function handleDelete(disciplineId) {
    const next = removeDisciplineFromTournament(teamData, disciplineId);
    await onSave?.(next);
  }

  function startEdit(discipline) {
    setEditingId(discipline.id);
    setEditingName(discipline.name);
  }

  async function handleSaveEdit(disciplineId) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      onError?.("Tên nội dung không được trống.");
      return;
    }
    const next = updateDisciplineInTournament(teamData, disciplineId, { name: trimmed });
    const ok = await onSave?.(next);
    if (ok === false) {
      return;
    }
    setEditingId("");
    setEditingName("");
  }

  return (
    <TournamentSectionCard
      title="Nội dung thi đấu"
      subtitle="Mỗi nội dung tương ứng một trận con trong lượt đối đầu."
    >
      {canManage ? (
        <TournamentActionBar sx={{ mb: 2 }}>
          <TextField
            label="Tên nội dung"
            value={disciplineName}
            onChange={(event) => setDisciplineName(event.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleAdd();
              }
            }}
          />
          <Button variant="contained" onClick={handleAdd}>
            Thêm nội dung
          </Button>
        </TournamentActionBar>
      ) : null}

      {teamData.disciplines.length === 0 ? (
        <Typography color="text.secondary">Chưa có nội dung thi đấu.</Typography>
      ) : (
        <Table size="small">
          <TableHead sx={tournamentTableHeadSx}>
            <TableRow>
              <TableCell sx={tournamentTableCellSx}>#</TableCell>
              <TableCell sx={tournamentTableCellSx}>Tên</TableCell>
              <TableCell sx={tournamentTableCellSx}>Số VĐV</TableCell>
              {canManage ? <TableCell sx={tournamentTableCellSx} align="right" /> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {teamData.disciplines.map((discipline) => (
              <TableRow key={discipline.id} hover>
                <TableCell sx={tournamentTableCellSx}>{discipline.sortOrder}</TableCell>
                <TableCell sx={tournamentTableCellSx}>
                  {editingId === discipline.id ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        autoFocus
                      />
                      <Button size="small" onClick={() => handleSaveEdit(discipline.id)}>
                        Lưu
                      </Button>
                      <Button size="small" onClick={() => setEditingId("")}>
                        Huỷ
                      </Button>
                    </Stack>
                  ) : (
                    discipline.name
                  )}
                </TableCell>
                <TableCell sx={tournamentTableCellSx}>{discipline.playerCount}</TableCell>
                {canManage ? (
                  <TableCell sx={tournamentTableCellSx} align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <IconButton
                        size="small"
                        aria-label="Sửa"
                        onClick={() => startEdit(discipline)}
                        disabled={editingId === discipline.id}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Xoá"
                        color="error"
                        onClick={() => handleDelete(discipline.id)}
                      >
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TournamentSectionCard>
  );
}
