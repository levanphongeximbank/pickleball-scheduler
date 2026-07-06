import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { normalizeTeamData } from "../../../features/team-tournament/models/index.js";
import { initializeTeamTournamentData } from "../../../features/team-tournament/engines/teamTournamentEngine.js";
import { MLP_REGULATIONS_BODY } from "../../../features/team-tournament/engines/mlpPresetEngine.js";
import TournamentConfigPageShell from "../../../components/tournament/TournamentConfigPageShell.jsx";

const TEMPLATES = [
  {
    id: "mlp_4",
    label: "MLP 4 người (Major League Pickleball)",
    body: MLP_REGULATIONS_BODY,
  },
  {
    id: "standard",
    label: "Điều lệ chuẩn CLB",
    body:
      "1. Đội đăng ký đủ roster trước hạn.\n2. BTC có quyền từ chối đội không đủ điều kiện.\n3. Kết quả trọng tài là quyết định cuối cùng.",
  },
  {
    id: "enterprise",
    label: "Giải doanh nghiệp",
    body:
      "1. Mỗi đội tối đa 12 VĐV.\n2. Trang phục thống nhất theo đội.\n3. Tuân thủ quy định an toàn sân.",
  },
];

function getRegulations(teamData) {
  return teamData?.settings?.regulations || { templateId: "standard", body: TEMPLATES[0].body };
}

function setRegulations(teamData, patch) {
  const current = getRegulations(teamData);
  const next = {
    templateId: patch.templateId ?? current.templateId,
    body: patch.body ?? current.body,
  };
  return normalizeTeamData({
    ...teamData,
    settings: { ...teamData.settings, regulations: next },
  });
}

export default function TournamentRegulationsPage() {
  const [teamData, setTeamData] = useState(() => initializeTeamTournamentData());
  const [message, setMessage] = useState(null);
  const regulations = getRegulations(teamData);

  const applyTemplate = (templateId) => {
    const template = TEMPLATES.find((item) => item.id === templateId);
    const next = setRegulations(teamData, {
      templateId,
      body: template?.body || "",
    });
    setTeamData(next);
    setMessage({ type: "success", text: "Đã áp dụng mẫu điều lệ." });
  };

  return (
    <TournamentConfigPageShell
      title="Mẫu điều lệ"
      description="Chọn mẫu và chỉnh sửa điều lệ giải đấu."
    >
      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        <TextField
          select
          label="Mẫu"
          value={regulations.templateId}
          onChange={(event) => applyTemplate(event.target.value)}
        >
          {TEMPLATES.map((template) => (
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
          onChange={(event) => {
            setTeamData(setRegulations(teamData, { body: event.target.value }));
          }}
        />
        <Button
          variant="contained"
          onClick={() => setMessage({ type: "success", text: "Đã lưu điều lệ." })}
        >
          Lưu
        </Button>
      </Stack>
    </TournamentConfigPageShell>
  );
}
