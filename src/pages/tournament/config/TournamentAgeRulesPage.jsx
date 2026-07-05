import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import {
  getEligibilityRules,
  updateEligibilityRules,
} from "../../../features/team-tournament/engines/eligibilityEngine.js";
import { initializeTeamTournamentData } from "../../../features/team-tournament/engines/teamTournamentEngine.js";

export default function TournamentAgeRulesPage() {
  const [teamData, setTeamData] = useState(() => initializeTeamTournamentData());
  const [message, setMessage] = useState(null);
  const rules = getEligibilityRules(teamData).age;

  const save = (patch) => {
    const result = updateEligibilityRules(teamData, { age: patch });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không lưu được." });
      return;
    }
    setTeamData(result.teamData);
    setMessage({ type: "success", text: "Đã cập nhật quy tắc độ tuổi." });
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Độ tuổi
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Thiết lập giới hạn tuổi tham gia giải đồng đội.
      </Typography>

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Stack spacing={2} sx={{ maxWidth: 420 }}>
        <FormControlLabel
          control={
            <Switch
              checked={rules.enabled}
              onChange={(event) => save({ enabled: event.target.checked })}
            />
          }
          label="Bật kiểm tra độ tuổi"
        />
        <TextField
          label="Tuổi tối thiểu"
          type="number"
          value={rules.minAge ?? ""}
          onChange={(event) =>
            save({ minAge: event.target.value === "" ? null : Number(event.target.value) })
          }
          disabled={!rules.enabled}
        />
        <TextField
          label="Tuổi tối đa"
          type="number"
          value={rules.maxAge ?? ""}
          onChange={(event) =>
            save({ maxAge: event.target.value === "" ? null : Number(event.target.value) })
          }
          disabled={!rules.enabled}
        />
        <TextField
          label="Tính tuổi đến ngày"
          type="date"
          InputLabelProps={{ shrink: true }}
          value={rules.asOfDate ? rules.asOfDate.slice(0, 10) : ""}
          onChange={(event) => save({ asOfDate: event.target.value || null })}
          disabled={!rules.enabled}
        />
        <Button variant="contained" onClick={() => save(rules)}>
          Lưu
        </Button>
      </Stack>
    </Box>
  );
}
