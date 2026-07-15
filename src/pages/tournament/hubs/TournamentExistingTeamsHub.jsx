/**
 * S2-B — Hub “Đội có sẵn”: chọn giải đích rồi sao chép đội từ giải khác.
 */

import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import { useClub } from "../../../context/ClubContext.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { listTournaments } from "../../../domain/tournamentService.js";
import {
  isTeamTournament,
  teamTournamentPath,
  TEAM_TAB_QUERY,
} from "../../../config/tournamentRoutes.js";
import TournamentPageHeader from "../../../components/tournament/TournamentPageHeader.jsx";
import ExistingTeamClonePanel from "../../../components/tournament/ExistingTeamClonePanel.jsx";
import { getPermissionsForRole } from "../../../features/identity/matrix/rolePermissions.js";

export default function TournamentExistingTeamsHub() {
  const { activeClubId, revision, refreshClubs } = useClub();
  const { user } = useAuth();
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const permissions = useMemo(
    () => getPermissionsForRole(user?.role || ""),
    [user?.role]
  );

  const teamTournaments = useMemo(
    () => listTournaments(activeClubId).filter(isTeamTournament),
    [activeClubId, revision]
  );

  return (
    <Box>
      <TournamentPageHeader
        title="Đội có sẵn"
        description="Sao chép đội (roster + đội trưởng) từ giải đồng đội khác vào giải đích."
      />
      <Stack spacing={2} sx={{ mt: 2, maxWidth: 720 }}>
        {message ? (
          <Alert severity="success" onClose={() => setMessage(null)}>
            {message}
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        {teamTournaments.length === 0 ? (
          <Alert severity="info">Chưa có giải đồng đội. Tạo giải từ Loại giải → Đồng đội.</Alert>
        ) : (
          <>
            <FormControl fullWidth size="small">
              <InputLabel id="s2b-target-tournament">Giải đích</InputLabel>
              <Select
                labelId="s2b-target-tournament"
                label="Giải đích"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              >
                <MenuItem value="">
                  <em>— Chọn giải —</em>
                </MenuItem>
                {teamTournaments.map((tournament) => (
                  <MenuItem key={tournament.id} value={tournament.id}>
                    {tournament.name} ({tournament.status})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {targetId ? (
              <>
                <ExistingTeamClonePanel
                  clubId={activeClubId}
                  targetTournamentId={targetId}
                  permissions={permissions}
                  onUpdated={() => refreshClubs?.()}
                  onError={(text) => setError(text)}
                  onMessage={(text) => {
                    setError(null);
                    setMessage(text);
                  }}
                />
                <Button
                  component={RouterLink}
                  to={teamTournamentPath(targetId, TEAM_TAB_QUERY.teams)}
                  variant="outlined"
                  sx={{ alignSelf: "flex-start", minHeight: { xs: 44, md: 36 } }}
                >
                  Mở tab Đội của giải đích
                </Button>
              </>
            ) : (
              <Typography color="text.secondary">
                Chọn giải đích để hiện danh sách đội có thể sao chép.
              </Typography>
            )}
          </>
        )}
      </Stack>
    </Box>
  );
}
