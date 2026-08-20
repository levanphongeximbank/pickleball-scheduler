import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SearchIcon from "@mui/icons-material/Search";
import {
  Button,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import PermissionGate from "../../../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../../../auth/permissions.js";
import {
  individualPlayerRegistrationPath,
  isIndividualTournament,
} from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import {
  isOfficialTournamentExperience,
  resolveTournamentExperienceAdapter,
} from "../experienceModeResolver.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import { deriveParticipantsModel, filterParticipantRows } from "../batchB/deriveParticipants.js";
import {
  BatchBError,
  BatchBEventPicker,
  BatchBLoading,
  BatchBMissingTournament,
  BatchBSiblingNav,
  BatchBWrongFamily,
  ExperienceBatchBFrame,
} from "../batchB/ExperienceBatchBFrame.jsx";
import {
  individualOverviewPath,
  individualParticipantsPath,
  individualPairsPath,
  individualRegistrationPublicationPath,
} from "../routes.js";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceMobileRecordCard from "../visual/ExperienceMobileRecordCard.jsx";
import ExperienceReadinessPanel from "../visual/ExperienceReadinessPanel.jsx";
import ExperienceStatusChip from "../visual/ExperienceStatusChip.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";
import { Alert } from "@mui/material";

const TITLE = "Người tham dự / Chốt danh sách";
const SUBTITLE = "Tách biệt Đăng ký & Công bố";
const TEST_ID = "tournament-participants-page";
const LOCK_LABEL = "Chốt danh sách";

export default function IndividualParticipantsPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isTable = useMediaQuery(theme.breakpoints.up("md"));
  const { activeClub, revision, refreshClubs } = useClub();
  const { tournament, loading, error, update } = useCanonicalTournament(activeClub, tournamentId, revision);
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState("all");
  const [profile, setProfile] = useState("all");
  const [checkin, setCheckin] = useState("all");
  const [eligibility, setEligibility] = useState("all");
  const [issue, setIssue] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const selectedEventId = searchParams.get("eventId") || "";

  if (loading) {
    return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải người tham dự…" />;
  }
  if (error) {
    return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  }
  if (!tournament) {
    return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  }
  if (!isIndividualTournament(tournament)) {
    return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  }

  const model = deriveParticipantsModel(tournament, { selectedEventId });
  const rows = filterParticipantRows(model.rows, { query, payment, profile, checkin, eligibility, issue });
  const registerTo = individualPlayerRegistrationPath(tournamentId);
  const officialAdapter = isOfficialTournamentExperience(tournament)
    ? resolveTournamentExperienceAdapter(tournament, { selectedEventId })
    : null;
  const selectEvent = (eventId) => {
    const next = new URLSearchParams(searchParams);
    if (eventId) next.set("eventId", eventId);
    else next.delete("eventId");
    setSearchParams(next);
  };
  const contextLine = [model.tournamentName, model.eventName].filter(Boolean).join(" • ");

  const handleLock = async () => {
    if (!model.official || !model.lockEnabled || !officialAdapter) return;
    setBusy(true);
    const built = officialAdapter.commands.closeRegistration(tournament);
    if (!built.ok) {
      setBusy(false);
      setMessage({ type: "error", text: built.error || "Không chốt được." });
      return;
    }
    const result = await update(built.patch);
    setBusy(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không lưu được." });
      return;
    }
    refreshClubs();
    setMessage({ type: "success", text: "Đã chốt danh sách (lockRegistration)." });
  };

  const handleRemove = async (entryId) => {
    if (!model.official || !model.eventId || !officialAdapter) {
      setMessage({ type: "error", text: "Chọn nội dung trước khi xóa." });
      return;
    }
    setBusy(true);
    const built = officialAdapter.commands.removeEntry(tournament, model.eventId, entryId);
    if (!built.ok) {
      setBusy(false);
      setMessage({ type: "error", text: built.error || "Không xóa được." });
      return;
    }
    const result = await update(built.patch);
    setBusy(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không lưu được." });
      return;
    }
    refreshClubs();
    setMessage({ type: "success", text: "Đã xóa hồ sơ khỏi nội dung." });
  };

  return (
    <ExperienceBatchBFrame
      testId={TEST_ID}
      title={TITLE}
      subtitle={SUBTITLE}
      contextLine={contextLine}
      actions={
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
            Tổng quan
          </Button>
          <span title={model.lockHint}>
            <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<LockOutlinedIcon />}
                disabled={!model.lockEnabled || busy}
                onClick={handleLock}
                sx={outlinedActionSx}
              >
                {LOCK_LABEL}
              </Button>
            </PermissionGate>
          </span>
        </Stack>
      }
    >
      <BatchBSiblingNav
        items={[
          { id: "registration", label: "Đăng ký", to: individualRegistrationPublicationPath(tournamentId, model.eventId), current: false },
          { id: "participants", label: "Người tham dự", to: individualParticipantsPath(tournamentId, model.eventId), current: true },
          { id: "pairs", label: "Cặp / đội", to: individualPairsPath(tournamentId, model.eventId), current: false },
        ]}
      />
      <BatchBEventPicker events={model.events} selectedEventId={selectedEventId || model.eventId} onSelect={selectEvent} />
      {model.needsEventChoice ? (
        <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 1.5 }}>
          Chọn nội dung để xem người tham dự. Không lấy nội dung mặc định.
        </Typography>
      ) : null}
      {message ? (
        <Alert severity={message.type} sx={{ mb: 1.25 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, md: true }}>
          <CenterKpiCard label={model.official ? "Tổng hồ sơ" : "Tổng cặp"} value={model.kpis.total} icon={<GroupsOutlinedIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: true }}>
          <CenterKpiCard label="Đã thanh toán" value={model.kpis.paid} tone="success" />
        </Grid>
        <Grid size={{ xs: 6, md: true }}>
          <CenterKpiCard label="Đã check-in" value={model.kpis.checkedIn} />
        </Grid>
        <Grid size={{ xs: 6, md: true }}>
          <CenterKpiCard label="Đủ hồ sơ" value={model.kpis.complete} tone="success" />
        </Grid>
        <Grid size={{ xs: 6, md: true }}>
          <CenterKpiCard label="Bị chặn / Cần xử lý" value={model.kpis.blocked} tone="warning" />
        </Grid>
      </Grid>
      <TextField
        size="small"
        fullWidth
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Tìm cặp, mã, sự cố…"
        sx={{ mb: 1.25, maxWidth: 480 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: TOURNAMENT_COLOR.textMuted }} />
              </InputAdornment>
            ),
          },
        }}
      />
      <ExperienceChipRow
        value={payment}
        onChange={setPayment}
        items={[
          { id: "all", label: "Thanh toán: tất cả" },
          { id: "paid", label: "Đã thanh toán" },
          { id: "unpaid", label: "Chưa thanh toán" },
        ]}
      />
      <ExperienceChipRow
        value={profile}
        onChange={setProfile}
        items={[
          { id: "all", label: "Hồ sơ: tất cả" },
          { id: "complete", label: "Đủ hồ sơ" },
          { id: "incomplete", label: "Thiếu hồ sơ" },
        ]}
      />
      <ExperienceChipRow
        value={checkin}
        onChange={setCheckin}
        items={[
          { id: "all", label: "Check-in: tất cả" },
          { id: "yes", label: "Đã check-in" },
          { id: "no", label: "Chưa check-in" },
        ]}
      />
      <ExperienceChipRow
        value={eligibility}
        onChange={setEligibility}
        items={[
          { id: "all", label: "Điều kiện: tất cả" },
          { id: "ready", label: "Đủ điều kiện" },
          { id: "blocked", label: "Bị chặn" },
        ]}
      />
      <ExperienceChipRow
        value={issue}
        onChange={setIssue}
        items={[
          { id: "all", label: "Sự cố: tất cả" },
          { id: "has", label: "Có sự cố" },
          { id: "none", label: "Không sự cố" },
        ]}
      />
      <TournamentExperienceWorkspace
        rail={
          <>
            <ExperienceReadinessPanel
              title={model.notReady ? "Chưa sẵn sàng chốt" : "Chưa thể chốt danh sách"}
              statusLabel={model.notReady ? `CHƯA SẴN SÀNG • ${model.blockers.length}` : "CHƯA SẴN SÀNG"}
              statusTone="warning"
              items={model.readyItems}
              lockLabel={LOCK_LABEL}
              lockDisabled
              lockHint={model.lockHint}
            />
            <CenterRightRailCard title="Tác động sau khi chốt">
              <Typography sx={{ fontSize: 12.5, mb: 0.75 }}>{model.impactOpen}</Typography>
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>{model.lockHint}</Typography>
            </CenterRightRailCard>
          </>
        }
      >
        {rows.length === 0 ? (
          <Paper elevation={0} sx={{ p: 2, border: `1px dashed ${TOURNAMENT_COLOR.divider}` }}>
            <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
              {model.needsEventChoice ? "Chọn nội dung để xem người tham dự." : "Không có cặp khớp bộ lọc."}
            </Typography>
          </Paper>
        ) : isTable ? (
          <Paper elevation={0} sx={{ border: `1px solid ${TOURNAMENT_COLOR.divider}`, overflow: "auto" }}>
            <Table size="small" sx={{ minWidth: 720, "& .MuiTableCell-root": { py: 0.7 } }}>
              <TableHead>
                <TableRow>
                  {["Hồ sơ / ID", "Thanh toán", "Hồ sơ", "Check-in", "Điều kiện", "Sự cố", "Thao tác"].map((header) => (
                    <TableCell key={header} sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted }}>
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{row.names}</Typography>
                      <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>
                        entryId={row.id}
                        {row.unitLabel ? ` • ${row.unitLabel}` : ""}
                      </Typography>
                      {row.playerIds?.length ? (
                        <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>
                          playerIds: {row.playerIds.join(", ")}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <ExperienceStatusChip
                        tone={row.payment === "unpaid" ? "warning" : "success"}
                        label={row.paymentLabel}
                      />
                    </TableCell>
                    <TableCell>
                      <ExperienceStatusChip
                        tone={row.profile === "complete" ? "success" : "warning"}
                        label={row.profileLabel}
                      />
                    </TableCell>
                    <TableCell>{row.checkinLabel}</TableCell>
                    <TableCell>
                      <ExperienceStatusChip tone="draft" label={row.eligibilityLabel} />
                    </TableCell>
                    <TableCell sx={{ color: row.issue ? TOURNAMENT_COLOR.warning : TOURNAMENT_COLOR.textMuted }}>
                      {row.issue || "—"}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Button size="small" component={RouterLink} to={registerTo}>
                          Xem
                        </Button>
                        {row.removeEnabled ? (
                          <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
                            <Button size="small" color="warning" disabled={busy} onClick={() => handleRemove(row.id)}>
                              Xóa
                            </Button>
                          </PermissionGate>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ) : (
          rows.map((row) => (
            <ExperienceMobileRecordCard
              key={row.id}
              title={row.names}
              status={<ExperienceStatusChip tone="draft" label={row.eligibilityLabel} />}
              meta={
                <Stack spacing={0.35}>
                  <Typography sx={{ fontSize: 12, color: row.issue ? TOURNAMENT_COLOR.warning : TOURNAMENT_COLOR.text }}>
                    {row.issue || "Không sự cố chặn"}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                    {row.paymentLabel} • {row.profileLabel}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                    entryId={row.id} • {row.unitLabel || "—"} • {row.checkinLabel}
                  </Typography>
                  {row.playerIds?.length ? (
                    <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                      playerIds: {row.playerIds.join(", ")}
                    </Typography>
                  ) : null}
                </Stack>
              }
              action={
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" component={RouterLink} to={registerTo}>
                    Xem
                  </Button>
                  {row.removeEnabled ? (
                    <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
                      <Button size="small" color="warning" disabled={busy} onClick={() => handleRemove(row.id)}>
                        Xóa
                      </Button>
                    </PermissionGate>
                  ) : null}
                </Stack>
              }
            />
          ))
        )}
      </TournamentExperienceWorkspace>
    </ExperienceBatchBFrame>
  );
}
