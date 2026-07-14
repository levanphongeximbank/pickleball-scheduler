import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";

import {
  getRegulations,
  getRegistrationPolicy,
  REGULATION_TEMPLATES,
  setRegistrationPolicy,
  setRegulations,
} from "../../../features/individual-tournament/engines/regulationsEngine.js";
import { useIndividualTournamentConfig } from "../../../features/individual-tournament/hooks/useIndividualTournamentConfig.js";
import TournamentConfigPageShell from "../../../components/tournament/TournamentConfigPageShell.jsx";
import IndividualTournamentSelector from "../../../components/tournament/IndividualTournamentSelector.jsx";

export default function TournamentRegulationsPage() {
  const {
    tournament,
    tournaments,
    tournamentId,
    selectTournament,
    persistTournament,
    message,
    setMessage,
  } = useIndividualTournamentConfig();

  const regulations = getRegulations(tournament);
  const policy = getRegistrationPolicy(tournament);

  const applyTemplate = (templateId) => {
    if (!tournament) return;
    const template = REGULATION_TEMPLATES.find((item) => item.id === templateId);
    const result = setRegulations(tournament, {
      templateId,
      body: template?.body || "",
    });
    if (persistTournament(result.tournament)) {
      setMessage({ type: "success", text: "Đã áp dụng mẫu điều lệ." });
    }
  };

  const saveBody = (body) => {
    if (!tournament) return;
    const result = setRegulations(tournament, { body });
    persistTournament(result.tournament);
  };

  const savePolicy = (patch) => {
    if (!tournament) return;
    const result = setRegistrationPolicy(tournament, patch);
    if (persistTournament(result.tournament)) {
      setMessage({ type: "success", text: "Đã lưu chính sách đăng ký." });
    }
  };

  return (
    <TournamentConfigPageShell
      title="Điều lệ & thông báo"
      description="Mẫu điều lệ và message xác nhận cho giải cá nhân."
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

      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        <TextField
          select
          label="Mẫu điều lệ"
          value={regulations.templateId}
          onChange={(event) => applyTemplate(event.target.value)}
          disabled={!tournament}
        >
          {REGULATION_TEMPLATES.map((template) => (
            <MenuItem key={template.id} value={template.id}>
              {template.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Nội dung điều lệ"
          multiline
          minRows={8}
          value={regulations.body}
          onChange={(event) => saveBody(event.target.value)}
          disabled={!tournament}
        />
        <TextField
          label="Message xác nhận đăng ký"
          value={policy.confirmationMessage}
          onChange={(event) => savePolicy({ confirmationMessage: event.target.value })}
          disabled={!tournament}
        />
        <TextField
          label="Message từ chối"
          value={policy.rejectionMessage}
          onChange={(event) => savePolicy({ rejectionMessage: event.target.value })}
          disabled={!tournament}
        />
        <TextField
          label="Message waitlist"
          value={policy.waitlistMessage}
          onChange={(event) => savePolicy({ waitlistMessage: event.target.value })}
          disabled={!tournament}
        />
        <TextField
          label="Message chưa thanh toán"
          value={policy.unpaidFeeMessage}
          onChange={(event) => savePolicy({ unpaidFeeMessage: event.target.value })}
          disabled={!tournament}
        />
        <TextField
          label="Message không đủ điều kiện"
          value={policy.eligibilityFailedMessage}
          onChange={(event) => savePolicy({ eligibilityFailedMessage: event.target.value })}
          disabled={!tournament}
        />
        <Button
          variant="contained"
          disabled={!tournament}
          onClick={() => {
            if (!tournament) return;
            const reg = setRegulations(tournament, regulations);
            const pol = setRegistrationPolicy(reg.tournament, policy);
            if (persistTournament(pol.tournament)) {
              setMessage({ type: "success", text: "Đã lưu điều lệ & thông báo." });
            }
          }}
        >
          Lưu
        </Button>
      </Stack>
    </TournamentConfigPageShell>
  );
}
