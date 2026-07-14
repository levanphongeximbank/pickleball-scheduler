import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Stack,
  Switch,
  TextField,
} from "@mui/material";

import {
  getEligibilityRules,
  updateEligibilityRules,
} from "../../../features/individual-tournament/engines/eligibilityEngine.js";
import { useIndividualTournamentConfig } from "../../../features/individual-tournament/hooks/useIndividualTournamentConfig.js";
import TournamentConfigPageShell from "../../../components/tournament/TournamentConfigPageShell.jsx";
import IndividualTournamentSelector from "../../../components/tournament/IndividualTournamentSelector.jsx";

const GENDER_OPTIONS = [
  { key: "male", label: "Nam" },
  { key: "female", label: "Nữ" },
  { key: "other", label: "Khác" },
];

export default function TournamentGenderRulesPage() {
  const {
    tournament,
    tournaments,
    tournamentId,
    selectTournament,
    persistTournament,
    message,
    setMessage,
  } = useIndividualTournamentConfig();

  const rules = getEligibilityRules(tournament).gender;
  const full = getEligibilityRules(tournament);

  const save = (patch) => {
    if (!tournament) {
      setMessage({ type: "error", text: "Chưa chọn giải." });
      return;
    }
    const result = updateEligibilityRules(tournament, { gender: patch });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không lưu được." });
      return;
    }
    if (!persistTournament(result.tournament)) return;
    setMessage({ type: "success", text: "Đã lưu quy tắc giới tính." });
  };

  const saveExtra = (section, patch) => {
    if (!tournament) return;
    const result = updateEligibilityRules(tournament, { [section]: patch });
    if (result.ok && persistTournament(result.tournament)) {
      setMessage({ type: "success", text: "Đã lưu quy tắc điều kiện." });
    }
  };

  const toggleGender = (genderKey) => {
    const allowed = new Set(rules.allowedGenders);
    if (allowed.has(genderKey)) allowed.delete(genderKey);
    else allowed.add(genderKey);
    save({ allowedGenders: [...allowed] });
  };

  return (
    <TournamentConfigPageShell
      title="Giới tính & điều kiện"
      description="Giới tính, whitelist, invite-only, membership, rating (lưu trên giải cá nhân)."
    >
      <IndividualTournamentSelector
        tournaments={tournaments}
        tournamentId={tournamentId}
        onSelect={selectTournament}
      />

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Stack spacing={2} sx={{ maxWidth: 480 }}>
        <FormControlLabel
          control={
            <Switch
              checked={rules.enabled}
              onChange={(event) => save({ enabled: event.target.checked })}
              disabled={!tournament}
            />
          }
          label="Bật kiểm tra giới tính (eligibility)"
        />
        <FormGroup>
          {GENDER_OPTIONS.map((option) => (
            <FormControlLabel
              key={option.key}
              control={
                <Checkbox
                  checked={rules.allowedGenders.includes(option.key)}
                  onChange={() => toggleGender(option.key)}
                  disabled={!tournament || !rules.enabled}
                />
              }
              label={option.label}
            />
          ))}
        </FormGroup>

        <FormControlLabel
          control={
            <Switch
              checked={full.inviteOnly.enabled}
              onChange={(event) => saveExtra("inviteOnly", { enabled: event.target.checked })}
              disabled={!tournament}
            />
          }
          label="Chỉ nhận đăng ký theo lời mời / whitelist"
        />
        <FormControlLabel
          control={
            <Switch
              checked={full.whitelist.enabled}
              onChange={(event) =>
                saveExtra("whitelist", {
                  enabled: event.target.checked,
                  playerIds: full.whitelist.playerIds,
                })
              }
              disabled={!tournament}
            />
          }
          label="Bật whitelist VĐV"
        />
        <TextField
          label="Whitelist player IDs (phẩy)"
          value={full.whitelist.playerIds.join(",")}
          onChange={(event) =>
            saveExtra("whitelist", {
              enabled: full.whitelist.enabled,
              playerIds: event.target.value
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            })
          }
          disabled={!tournament}
          helperText="Ví dụ: p1,p2,p3"
        />
        <FormControlLabel
          control={
            <Switch
              checked={full.clubMembership.enabled}
              onChange={(event) =>
                saveExtra("clubMembership", { enabled: event.target.checked })
              }
              disabled={!tournament}
            />
          }
          label="Yêu cầu thành viên CLB"
        />
        <FormControlLabel
          control={
            <Switch
              checked={full.rating.enabled}
              onChange={(event) => saveExtra("rating", { enabled: event.target.checked })}
              disabled={!tournament}
            />
          }
          label="Bật khoảng rating"
        />
        <TextField
          label="Rating tối thiểu"
          type="number"
          value={full.rating.minRating ?? ""}
          onChange={(event) =>
            saveExtra("rating", {
              minRating: event.target.value === "" ? null : Number(event.target.value),
            })
          }
          disabled={!tournament || !full.rating.enabled}
        />
        <TextField
          label="Rating tối đa"
          type="number"
          value={full.rating.maxRating ?? ""}
          onChange={(event) =>
            saveExtra("rating", {
              maxRating: event.target.value === "" ? null : Number(event.target.value),
            })
          }
          disabled={!tournament || !full.rating.enabled}
        />
        <FormControlLabel
          control={
            <Switch
              checked={full.maxRegistrationsPerPlayer.enabled}
              onChange={(event) =>
                saveExtra("maxRegistrationsPerPlayer", { enabled: event.target.checked })
              }
              disabled={!tournament}
            />
          }
          label="Giới hạn số nội dung / VĐV"
        />
        <TextField
          label="Số nội dung tối đa / VĐV"
          type="number"
          value={full.maxRegistrationsPerPlayer.max}
          onChange={(event) =>
            saveExtra("maxRegistrationsPerPlayer", { max: Number(event.target.value) || 1 })
          }
          disabled={!tournament || !full.maxRegistrationsPerPlayer.enabled}
        />
        <Button variant="contained" onClick={() => save(rules)} disabled={!tournament}>
          Lưu
        </Button>
      </Stack>
    </TournamentConfigPageShell>
  );
}
