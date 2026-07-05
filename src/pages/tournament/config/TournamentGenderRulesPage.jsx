import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Stack,
  Switch,
  Typography,
} from "@mui/material";

import {
  getEligibilityRules,
  updateEligibilityRules,
} from "../../../features/team-tournament/engines/eligibilityEngine.js";
import { initializeTeamTournamentData } from "../../../features/team-tournament/engines/teamTournamentEngine.js";

const GENDER_OPTIONS = [
  { key: "male", label: "Nam" },
  { key: "female", label: "Nữ" },
  { key: "other", label: "Khác" },
];

export default function TournamentGenderRulesPage() {
  const [teamData, setTeamData] = useState(() => initializeTeamTournamentData());
  const [message, setMessage] = useState(null);
  const rules = getEligibilityRules(teamData).gender;

  const toggleGender = (genderKey) => {
    const allowed = new Set(rules.allowedGenders);
    if (allowed.has(genderKey)) {
      allowed.delete(genderKey);
    } else {
      allowed.add(genderKey);
    }
    save({ allowedGenders: [...allowed] });
  };

  const save = (patch) => {
    const result = updateEligibilityRules(teamData, { gender: patch });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không lưu được." });
      return;
    }
    setTeamData(result.teamData);
    setMessage({ type: "success", text: "Đã cập nhật quy tắc giới tính." });
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Giới tính
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Chọn giới tính được phép đăng ký tham gia giải.
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
          label="Bật kiểm tra giới tính"
        />
        <FormGroup>
          {GENDER_OPTIONS.map((option) => (
            <FormControlLabel
              key={option.key}
              control={
                <Checkbox
                  checked={rules.allowedGenders.includes(option.key)}
                  onChange={() => toggleGender(option.key)}
                  disabled={!rules.enabled}
                />
              }
              label={option.label}
            />
          ))}
        </FormGroup>
        <Button variant="contained" onClick={() => save(rules)}>
          Lưu
        </Button>
      </Stack>
    </Box>
  );
}
