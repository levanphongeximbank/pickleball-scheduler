import {
  Alert,
  Button,
  FormControlLabel,
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

export default function TournamentAgeRulesPage() {
  const {
    tournament,
    tournaments,
    tournamentId,
    selectTournament,
    persistTournament,
    message,
    setMessage,
  } = useIndividualTournamentConfig();

  const rules = getEligibilityRules(tournament).age;

  const save = (patch) => {
    if (!tournament) {
      setMessage({ type: "error", text: "Chưa chọn giải." });
      return;
    }
    const result = updateEligibilityRules(tournament, { age: patch });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không lưu được." });
      return;
    }
    if (!persistTournament(result.tournament)) return;
    setMessage({ type: "success", text: "Đã lưu quy tắc độ tuổi." });
  };

  return (
    <TournamentConfigPageShell
      title="Độ tuổi"
      description="Giới hạn tuổi tham gia giải cá nhân (lưu trên blob giải)."
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

      <Stack spacing={2} sx={{ maxWidth: 420 }}>
        <FormControlLabel
          control={
            <Switch
              checked={rules.enabled}
              onChange={(event) => save({ enabled: event.target.checked })}
              disabled={!tournament}
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
          disabled={!tournament || !rules.enabled}
        />
        <TextField
          label="Tuổi tối đa"
          type="number"
          value={rules.maxAge ?? ""}
          onChange={(event) =>
            save({ maxAge: event.target.value === "" ? null : Number(event.target.value) })
          }
          disabled={!tournament || !rules.enabled}
        />
        <TextField
          label="Tính tuổi đến ngày"
          type="date"
          InputLabelProps={{ shrink: true }}
          value={rules.asOfDate ? rules.asOfDate.slice(0, 10) : ""}
          onChange={(event) => save({ asOfDate: event.target.value || null })}
          disabled={!tournament || !rules.enabled}
        />
        <Button variant="contained" onClick={() => save(rules)} disabled={!tournament}>
          Lưu
        </Button>
      </Stack>
    </TournamentConfigPageShell>
  );
}
