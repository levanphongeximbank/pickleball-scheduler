import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import { useClub } from "../context/ClubContext.jsx";
import { useSeasonLeague } from "../context/SeasonContext.jsx";
import { DEFAULT_CLUB } from "../data/club.js";
import { importFullClubData, updateClubMeta } from "../domain/clubService.js";
import {
  buildFullClubExport,
  CLUB_SCHEMA_VERSION,
} from "../domain/clubStorage.js";
import LeagueRoundManager from "../components/tournament/LeagueRoundManager.jsx";
import SeasonClosePanel from "../components/tournament/SeasonClosePanel.jsx";
import { deleteLeague } from "../domain/leagueService.js";
import { deleteSeason } from "../domain/seasonService.js";
import {
  buildClubManagementView,
  filterLeaguesBySeason,
} from "./clubManagement.logic.js";
import { stringifyClubDataExport } from "./clubData.logic.js";
import PermissionGate from "../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../auth/permissions.js";

function TabPanel({ children, value, index }) {
  if (value !== index) {
    return null;
  }

  return <Box sx={{ pt: 2 }}>{children}</Box>;
}

export default function ClubManagement() {
  const {
    clubs,
    activeClub,
    activeClubId,
    summary,
    createClub,
    renameClub,
    deleteClub,
    refreshClubs,
  } = useClub();
  const {
    seasons,
    leagues,
    activeSeasonId,
    createSeason,
    createLeague,
    setActiveSeason,
    setActiveLeague,
    updateSeason,
    updateLeague,
  } = useSeasonLeague();

  const [tab, setTab] = useState(0);
  const [message, setMessage] = useState(null);
  const [newClubName, setNewClubName] = useState("");
  const [renameValue, setRenameValue] = useState(activeClub?.name || "");
  const [noteValue, setNoteValue] = useState(activeClub?.note || "");
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newLeagueName, setNewLeagueName] = useState("");
  const [leagueSeasonId, setLeagueSeasonId] = useState(activeSeasonId || "");
  const [leagueFormat, setLeagueFormat] = useState("social");
  const [leagueCompetitionType, setLeagueCompetitionType] = useState("open");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [exportText, setExportText] = useState("");

  useEffect(() => {
    setRenameValue(activeClub?.name || "");
    setNoteValue(activeClub?.note || "");
  }, [activeClub]);

  const view = useMemo(
    () =>
      buildClubManagementView({
        clubs,
        activeClubId,
        summary,
        seasons,
        leagues,
      }),
    [clubs, activeClubId, summary, seasons, leagues]
  );

  const leaguesForSelectedSeason = useMemo(
    () => filterLeaguesBySeason(leagues, leagueSeasonId || activeSeasonId),
    [leagues, leagueSeasonId, activeSeasonId]
  );

  const handleCreateClub = () => {
    const result = createClub(newClubName);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setNewClubName("");
    setMessage({ type: "success", text: `Đã tạo CLB ${result.club.name}.` });
  };

  const handleSaveClubMeta = () => {
    const result = renameClub(activeClubId, renameValue);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    updateClubMeta(activeClubId, { note: noteValue });
    refreshClubs();
    setMessage({ type: "success", text: "Đã cập nhật thông tin CLB." });
  };

  const handleDeleteClub = () => {
    const result = deleteClub(activeClubId);

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setDeleteDialogOpen(false);
    setRenameValue("");
    setMessage({ type: "success", text: "Đã xóa CLB và dữ liệu liên quan." });
  };

  const handleCreateSeason = () => {
    const result = createSeason(newSeasonName, { makeActive: true });

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setNewSeasonName("");
    setMessage({ type: "success", text: `Đã tạo mùa ${result.season.name}.` });
  };

  const handleCreateLeague = () => {
    const result = createLeague(leagueSeasonId || activeSeasonId, newLeagueName, {
      format: leagueFormat,
      competitionType: leagueCompetitionType,
      makeActive: true,
    });

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setNewLeagueName("");
    setMessage({ type: "success", text: `Đã tạo giải ${result.league.name}.` });
  };

  const handleExportClub = () => {
    const payload = buildFullClubExport(activeClubId);
    const text = stringifyClubDataExport({
      ...payload,
      schemaVersion: CLUB_SCHEMA_VERSION,
      type: "club-full",
    });
    setExportText(text);
    setMessage({ type: "success", text: "Đã tạo bản export CLB." });
  };

  const handleImportClub = () => {
    try {
      const parsed = JSON.parse(importText);
      const result = importFullClubData(activeClubId, parsed);

      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        return;
      }

      refreshClubs();
      setImportText("");
      setMessage({ type: "success", text: "Import CLB thành công." });
    } catch {
      setMessage({ type: "error", text: "JSON import không hợp lệ." });
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
        CLB & Giải
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Quản lý CLB, mùa giải và league nội bộ cho {activeClub?.name}.
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Người chơi
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {view.totals.players}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Sân hoạt động
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {view.totals.activeCourts}/{view.totals.courts}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Mùa / Giải
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {view.totals.seasons} / {view.totals.leagues}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Phiên xếp sân
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {view.totals.sessions}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Tabs value={tab} onChange={(_event, value) => setTab(value)}>
            <Tab label="CLB" />
            <Tab label="Mùa giải" />
            <Tab label="Giải / League" />
            <Tab label="Vòng mùa" />
            <Tab label="Export / Import" />
          </Tabs>

          <TabPanel value={tab} index={0}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Tên CLB"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                />
                <TextField
                  fullWidth
                  label="Ghi chú"
                  value={noteValue}
                  onChange={(event) => setNoteValue(event.target.value)}
                />
                <PermissionGate permission={PERMISSIONS.CLUB_MANAGE}>
                  <Button variant="contained" onClick={handleSaveClubMeta}>
                    Lưu CLB
                  </Button>
                </PermissionGate>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Tạo CLB mới"
                  value={newClubName}
                  onChange={(event) => setNewClubName(event.target.value)}
                />
                <PermissionGate permission={PERMISSIONS.CLUB_MANAGE}>
                  <Button variant="outlined" onClick={handleCreateClub}>
                    Thêm CLB
                  </Button>
                </PermissionGate>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                {clubs.map((club) => (
                  <Chip
                    key={club.id}
                    label={club.name}
                    color={club.id === activeClubId ? "primary" : "default"}
                    variant={club.id === activeClubId ? "filled" : "outlined"}
                  />
                ))}
              </Stack>

              {view.canDeleteActiveClub && (
                <PermissionGate permission={PERMISSIONS.CLUB_DELETE}>
                  <Button color="error" onClick={() => setDeleteDialogOpen(true)}>
                    Xóa CLB hiện tại
                  </Button>
                </PermissionGate>
              )}
            </Stack>
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Tên mùa giải"
                  value={newSeasonName}
                  onChange={(event) => setNewSeasonName(event.target.value)}
                />
                <PermissionGate permission={PERMISSIONS.SEASONS_MANAGE}>
                  <Button variant="contained" onClick={handleCreateSeason}>
                    Thêm mùa
                  </Button>
                </PermissionGate>
              </Stack>

              <Stack spacing={1}>
                {seasons.map((season) => (
                  <Card key={season.id} variant="outlined">
                    <CardContent
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 2,
                        flexWrap: "wrap",
                      }}
                    >
                      <Box>
                        <Typography fontWeight="bold">{season.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {season.status}
                          {season.startDate ? ` • ${season.startDate}` : ""}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant={season.id === activeSeasonId ? "contained" : "outlined"}
                          onClick={() => setActiveSeason(season.id)}
                        >
                          Chọn active
                        </Button>
                        <PermissionGate permission={PERMISSIONS.SEASONS_MANAGE}>
                          <Button
                            size="small"
                            onClick={() =>
                              updateSeason(season.id, {
                                status:
                                  season.status === "archived" ? "active" : "archived",
                              })
                            }
                          >
                            {season.status === "archived" ? "Kích hoạt" : "Lưu trữ"}
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => {
                              const result = deleteSeason(activeClubId, season.id);
                              if (result.ok) {
                                refreshClubs();
                                setMessage({ type: "success", text: "Đã xử lý mùa giải." });
                              } else {
                                setMessage({ type: "error", text: result.error });
                              }
                            }}
                          >
                            Xóa
                          </Button>
                        </PermissionGate>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>

              <PermissionGate
                permissions={[PERMISSIONS.SEASONS_MANAGE, PERMISSIONS.STATISTICS_EXPORT]}
              >
                <SeasonClosePanel onMessage={setMessage} />
              </PermissionGate>
            </Stack>
          </TabPanel>

          <TabPanel value={tab} index={2}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel id="league-season-label">Mùa</InputLabel>
                  <Select
                    labelId="league-season-label"
                    value={leagueSeasonId || activeSeasonId || ""}
                    label="Mùa"
                    onChange={(event) => setLeagueSeasonId(event.target.value)}
                  >
                    {seasons.map((season) => (
                      <MenuItem key={season.id} value={season.id}>
                        {season.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Tên giải / league"
                  value={newLeagueName}
                  onChange={(event) => setNewLeagueName(event.target.value)}
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel id="league-format-label">Định dạng</InputLabel>
                  <Select
                    labelId="league-format-label"
                    value={leagueFormat}
                    label="Định dạng"
                    onChange={(event) => setLeagueFormat(event.target.value)}
                  >
                    {view.formatOptions.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="league-competition-label">Loại giải</InputLabel>
                  <Select
                    labelId="league-competition-label"
                    value={leagueCompetitionType}
                    label="Loại giải"
                    onChange={(event) => setLeagueCompetitionType(event.target.value)}
                  >
                    {view.competitionOptions.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <PermissionGate permission={PERMISSIONS.LEAGUES_MANAGE}>
                  <Button variant="contained" onClick={handleCreateLeague}>
                    Thêm giải
                  </Button>
                </PermissionGate>
              </Stack>

              <Stack spacing={1}>
                {leaguesForSelectedSeason.map((league) => (
                  <Card key={league.id} variant="outlined">
                    <CardContent
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 2,
                        flexWrap: "wrap",
                      }}
                    >
                      <Box>
                        <Typography fontWeight="bold">{league.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {league.format} • {league.competitionType} • {league.status}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setActiveLeague(league.id)}
                        >
                          Chọn active
                        </Button>
                        <PermissionGate permission={PERMISSIONS.LEAGUES_MANAGE}>
                          <Button
                            size="small"
                            onClick={() =>
                              updateLeague(league.id, {
                                status:
                                  league.status === "completed" ? "active" : "completed",
                              })
                            }
                          >
                            {league.status === "completed" ? "Mở lại" : "Hoàn tất"}
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => {
                              const result = deleteLeague(activeClubId, league.id);
                              if (result.ok) {
                                refreshClubs();
                                setMessage({ type: "success", text: "Đã xử lý giải." });
                              } else {
                                setMessage({ type: "error", text: result.error });
                              }
                            }}
                          >
                            Xóa
                          </Button>
                        </PermissionGate>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Stack>
          </TabPanel>

          <TabPanel value={tab} index={3}>
            <LeagueRoundManager onMessage={setMessage} />
          </TabPanel>

          <TabPanel value={tab} index={4}>
            <Stack spacing={2}>
              <PermissionGate permission={PERMISSIONS.SETTINGS_MANAGE}>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={handleExportClub}>
                    Export toàn CLB
                  </Button>
                </Stack>

                <TextField
                  multiline
                  minRows={6}
                  fullWidth
                  label="JSON import"
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                />

                <Button variant="outlined" onClick={handleImportClub}>
                  Import CLB
                </Button>
              </PermissionGate>

              <TextField
                multiline
                minRows={6}
                fullWidth
                label="JSON export"
                value={exportText}
                InputProps={{ readOnly: true }}
              />
            </Stack>
          </TabPanel>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Xóa CLB?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Thao tác này xóa toàn bộ dữ liệu scoped của CLB {activeClub?.name}. CLB mặc định (
            {DEFAULT_CLUB.name}) không thể xóa.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Hủy</Button>
          <Button color="error" onClick={handleDeleteClub}>
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
