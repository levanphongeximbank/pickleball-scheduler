import { useState } from "react";
import {
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
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
import {
  buildSideOutScoringFormat,
  buildUsap2026RallyDoublesScoringFormat,
  isTtRefereeV5RallyEnabled,
} from "../../../features/team-tournament/engines/teamRefereeV5FormatMapper.js";
import { SCORING_SYSTEM } from "../../../features/team-tournament/constants.js";
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
  const rallyFlagOn = isTtRefereeV5RallyEnabled();

  function handleAdd() {
    const trimmed = disciplineName.trim();
    if (!trimmed) {
      onError?.("Nhập tên nội dung.");
      return;
    }
    const next = addDisciplineToTournament(teamData, { name: trimmed, playerCount: 2 });
    onSave?.(next);
    setDisciplineName("");
  }

  function handleDelete(disciplineId) {
    const next = removeDisciplineFromTournament(teamData, disciplineId);
    onSave?.(next);
  }

  function startEdit(discipline) {
    setEditingId(discipline.id);
    setEditingName(discipline.name);
  }

  function handleSaveEdit(disciplineId) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      onError?.("Tên nội dung không được trống.");
      return;
    }
    const next = updateDisciplineInTournament(teamData, disciplineId, { name: trimmed });
    onSave?.(next);
    setEditingId("");
    setEditingName("");
  }

  function handleScoringSystemChange(discipline, scoringSystem) {
    if (!canManage || !rallyFlagOn) {
      return;
    }
    if (discipline.playerCount === 1 && scoringSystem === SCORING_SYSTEM.RALLY) {
      onError?.("USAP 2026 Provisional Rally chỉ hỗ trợ doubles.");
      return;
    }
    const scoringFormat =
      scoringSystem === SCORING_SYSTEM.RALLY
        ? buildUsap2026RallyDoublesScoringFormat({
            matchFormat: discipline.scoringFormat?.matchFormat,
            winPoints: discipline.scoringFormat?.winPoints,
          })
        : buildSideOutScoringFormat({
            matchFormat: discipline.scoringFormat?.matchFormat,
            winPoints: discipline.scoringFormat?.winPoints,
            targetScore: discipline.scoringFormat?.targetScore || 21,
          });
    const next = updateDisciplineInTournament(teamData, discipline.id, { scoringFormat });
    onSave?.(next);
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

      {rallyFlagOn ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Rally Scoring (staging): USAP 2026 Provisional Rally Doubles — 11 / win by 2 / Freeze
          None. Feature flag VITE_TT5_REFEREE_V5_RALLY_ENABLED.
        </Typography>
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
              {rallyFlagOn ? (
                <TableCell sx={tournamentTableCellSx}>Hệ thống tính điểm</TableCell>
              ) : null}
              {canManage ? <TableCell sx={tournamentTableCellSx} align="right" /> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {teamData.disciplines.map((discipline) => {
              const system =
                discipline.scoringFormat?.scoringSystem === SCORING_SYSTEM.RALLY
                  ? SCORING_SYSTEM.RALLY
                  : SCORING_SYSTEM.SIDE_OUT;
              return (
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
                  {rallyFlagOn ? (
                    <TableCell sx={tournamentTableCellSx}>
                      {canManage ? (
                        <FormControl size="small" sx={{ minWidth: 160 }}>
                          <InputLabel id={`scoring-${discipline.id}`}>Scoring</InputLabel>
                          <Select
                            labelId={`scoring-${discipline.id}`}
                            label="Scoring"
                            value={system}
                            onChange={(event) =>
                              handleScoringSystemChange(discipline, event.target.value)
                            }
                          >
                            <MenuItem value={SCORING_SYSTEM.SIDE_OUT}>Side-Out</MenuItem>
                            <MenuItem value={SCORING_SYSTEM.RALLY}>Rally Scoring</MenuItem>
                          </Select>
                        </FormControl>
                      ) : (
                        <Typography variant="body2">
                          {system === SCORING_SYSTEM.RALLY
                            ? "Rally (USAP 2026)"
                            : "Side-Out"}
                        </Typography>
                      )}
                      {system === SCORING_SYSTEM.RALLY ? (
                        <Typography variant="caption" display="block" color="text.secondary">
                          USAP 2026 · 11 · win by 2 · Freeze None
                        </Typography>
                      ) : null}
                    </TableCell>
                  ) : null}
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
              );
            })}
          </TableBody>
        </Table>
      )}
    </TournamentSectionCard>
  );
}
