import { useEffect, useState } from "react";

import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import { INTERNAL_NO_REFEREE_ROSTER_MESSAGE } from "../../../features/tournament/internal/internalMatchRefereeAssignment.js";

function currentRefereeId(match) {
  return String(match?.referee?.rosterId || match?.referee?.id || "");
}

export default function InternalMatchRefereeSelect({
  match,
  roster = [],
  pending = false,
  onAssign,
}) {
  const assignedId = currentRefereeId(match);
  const [draftId, setDraftId] = useState(assignedId);
  const eligible = (roster || []).filter((entry) => entry?.active !== false);

  useEffect(() => {
    setDraftId(assignedId);
  }, [assignedId, match?.id]);

  if (!eligible.length) {
    return (
      <Typography variant="caption" color="text.secondary">
        {INTERNAL_NO_REFEREE_ROSTER_MESSAGE}
      </Typography>
    );
  }

  const dirty = draftId !== assignedId;

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="stretch">
      <FormControl fullWidth size="small">
        <InputLabel>Trọng tài</InputLabel>
        <Select
          label="Trọng tài"
          value={draftId}
          disabled={pending}
          onChange={(event) => setDraftId(event.target.value)}
        >
          <MenuItem value="">
            <em>Chưa phân công</em>
          </MenuItem>
          {eligible.map((entry) => (
            <MenuItem key={entry.id} value={entry.id}>
              {entry.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        size="small"
        variant="outlined"
        disabled={pending || !dirty}
        onClick={() => onAssign?.(match.id, draftId)}
        sx={{ whiteSpace: "nowrap" }}
      >
        {pending ? "Đang lưu..." : "Lưu trọng tài"}
      </Button>
    </Stack>
  );
}
