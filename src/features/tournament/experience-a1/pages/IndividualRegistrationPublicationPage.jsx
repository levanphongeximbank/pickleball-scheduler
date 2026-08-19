import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import SearchIcon from "@mui/icons-material/Search";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Box,
  Button,
  Divider,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import {
  individualPlayerRegistrationPath,
  individualPublicTournamentPath,
  isIndividualTournament,
} from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import {
  deriveRegistrationModel,
  filterRegistrationRows,
} from "../batchB/deriveRegistration.js";
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
import ExperienceMobileRecordCard from "../visual/ExperienceMobileRecordCard.jsx";
import ExperienceStatusChip from "../visual/ExperienceStatusChip.jsx";
import {
  outlinedActionSx,
  primaryActionSx,
  TOURNAMENT_COLOR,
  TOURNAMENT_RADIUS,
} from "../visual/tournamentExperienceTokens.js";

const TITLE = "Đăng ký & Công bố";
const SUBTITLE = "Hồ sơ đăng ký theo nội dung";
const TEST_ID = "tournament-registration-page";

function RegistrationRecord({ row, registerTo }) {
  return (
    <ExperienceMobileRecordCard
      title={row.names}
      status={<ExperienceStatusChip tone={row.statusTone} label={row.statusLabel} />}
      meta={
        <>
          <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
            {row.id} • {row.phone}
          </Typography>
          <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
            {row.source} • {row.time}
          </Typography>
        </>
      }
      action={
        <span title={row.actionHint}>
          <Button
            size="small"
            variant="outlined"
            disabled={!row.actionEnabled}
            component={row.actionEnabled ? RouterLink : "button"}
            to={row.actionEnabled ? registerTo : undefined}
            sx={{ mt: 0.75 }}
          >
            {row.actionLabel}
          </Button>
        </span>
      }
    />
  );
}

export default function IndividualRegistrationPublicationPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isTable = useMediaQuery(theme.breakpoints.up("md"));
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedEventId = searchParams.get("eventId") || "";

  if (loading) {
    return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải đăng ký…" />;
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

  const publicHref = `${typeof window !== "undefined" ? window.location.origin : ""}${individualPublicTournamentPath(tournamentId)}`;
  const model = deriveRegistrationModel(tournament, { selectedEventId, publicHref });
  const rows = filterRegistrationRows(model.rows, { tab, query });
  const registerTo = individualPlayerRegistrationPath(tournamentId);
  const selectEvent = (eventId) => {
    const next = new URLSearchParams(searchParams);
    if (eventId) next.set("eventId", eventId);
    else next.delete("eventId");
    setSearchParams(next);
  };
  const contextLine = [model.tournamentName, model.eventName].filter(Boolean).join(" • ");

  const copyPublic = async () => {
    try {
      await navigator.clipboard.writeText(model.publicHref);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const headerActions = (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
        Tổng quan
      </Button>
      <Button
        variant="outlined"
        size="small"
        startIcon={<VisibilityOutlinedIcon />}
        component={RouterLink}
        to={individualPublicTournamentPath(tournamentId)}
        sx={outlinedActionSx}
      >
        Xem trước
      </Button>
      <span title={model.publicationHint}>
        <Button variant="contained" size="small" disabled sx={primaryActionSx}>
          {model.publicationActionLabel}
        </Button>
      </span>
      <Button
        variant="outlined"
        size="small"
        startIcon={<PersonAddIcon />}
        component={RouterLink}
        to={registerTo}
        sx={outlinedActionSx}
      >
        Thêm VĐV
      </Button>
    </Stack>
  );

  return (
    <ExperienceBatchBFrame
      testId={TEST_ID}
      title={TITLE}
      subtitle={SUBTITLE}
      contextLine={contextLine}
      contextChip={<ExperienceStatusChip tone="draft" label={model.publicationStatusLabel} />}
      actions={headerActions}
    >
      <BatchBSiblingNav
        items={[
          { id: "registration", label: "Đăng ký", to: individualRegistrationPublicationPath(tournamentId, model.eventId), current: true },
          { id: "participants", label: "Người tham dự", to: individualParticipantsPath(tournamentId, model.eventId), current: false },
          { id: "pairs", label: "Cặp / đội", to: individualPairsPath(tournamentId, model.eventId), current: false },
        ]}
      />
      <BatchBEventPicker events={model.events} selectedEventId={selectedEventId || model.eventId} onSelect={selectEvent} />
      {model.needsEventChoice ? (
        <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 1.5 }}>
          Chọn nội dung để xem đăng ký. Không lấy nội dung mặc định.
        </Typography>
      ) : null}

      <Grid container spacing={1.25} sx={{ mb: 1.5, alignItems: "stretch" }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <CenterKpiCard label="Tổng suất" value={model.kpis.maxSlots} hint={model.kpis.maxHint} icon={<GroupsOutlinedIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <CenterKpiCard label="Đã xác nhận" value={model.kpis.confirmed} hint={model.kpis.confirmedHint} tone="success" icon={<CheckCircleOutlineIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <CenterKpiCard label="Chờ duyệt" value={model.kpis.pending} hint={model.kpis.pendingHint} tone="warning" icon={<HourglassEmptyIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <CenterKpiCard label="Danh sách chờ" value={model.kpis.waitlist} hint={model.kpis.waitlistHint} tone="info" icon={<WarningAmberIcon />} />
        </Grid>
      </Grid>

      <TournamentExperienceWorkspace
        rail={
          <CenterRightRailCard title="Công bố & phân phối" icon={<ShareOutlinedIcon sx={{ fontSize: 16 }} />}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted, mb: 0.6 }}>
              Kênh phân phối
            </Typography>
            <Stack spacing={0.5} sx={{ mb: 1.25 }}>
              {model.channels.map((item) => (
                <Stack key={item.label} direction="row" spacing={0.75} sx={{ alignItems: "flex-start" }}>
                  {item.ready ? (
                    <CheckCircleOutlineIcon sx={{ fontSize: 14, mt: "2px", color: TOURNAMENT_COLOR.success }} />
                  ) : (
                    <ErrorOutlineIcon sx={{ fontSize: 14, mt: "2px", color: TOURNAMENT_COLOR.warning }} />
                  )}
                  <Box>
                    <Typography sx={{ fontSize: 12.5 }}>{item.label}</Typography>
                    <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>{item.note}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
            <Divider sx={{ mb: 1.25 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted, mb: 0.6 }}>
              Thời hạn đăng ký
            </Typography>
            <Typography sx={{ fontSize: 12.5 }}>Mở: {model.window.opensAt}</Typography>
            <Typography sx={{ fontSize: 12.5 }}>Đóng: {model.window.closesAt}</Typography>
            <Typography sx={{ fontSize: 12.5, mb: 1.25 }}>Suất tối đa: {model.window.maxEntries}</Typography>
            <Divider sx={{ mb: 1.25 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted, mb: 0.6 }}>
              Liên kết công khai
            </Typography>
            <TextField size="small" fullWidth value={model.publicHref} slotProps={{ input: { readOnly: true } }} />
            <Button startIcon={<ContentCopyIcon />} sx={{ mt: 0.75, mb: 1.25 }} size="small" onClick={copyPublic}>
              {copied ? "Đã sao chép" : "Sao chép"}
            </Button>
            <Divider sx={{ mb: 1.25 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted, mb: 0.6 }}>
              QR đăng ký
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1.25, alignItems: "center" }}>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  border: `1px dashed ${TOURNAMENT_COLOR.divider}`,
                  borderRadius: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <QrCode2Icon sx={{ fontSize: 36, color: TOURNAMENT_COLOR.textMuted }} />
              </Box>
              <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted }}>
                Chưa phát hành QR đăng ký
              </Typography>
            </Stack>
            <Divider sx={{ mb: 1.25 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted, mb: 0.6 }}>
              Nút kêu gọi công khai
            </Typography>
            <Paper
              elevation={0}
              sx={{
                p: 1.1,
                mb: 1.25,
                bgcolor: TOURNAMENT_COLOR.primarySurface,
                borderRadius: `${TOURNAMENT_RADIUS.card}px`,
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: 13, mb: 0.75 }}>{model.tournamentName}</Typography>
              <Button variant="contained" fullWidth size="small" component={RouterLink} to={individualPublicTournamentPath(tournamentId)} sx={primaryActionSx}>
                Đăng ký ngay
              </Button>
            </Paper>
            <Divider sx={{ mb: 1.25 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted, mb: 0.6 }}>
              Sẵn sàng đóng đăng ký
            </Typography>
            <Stack spacing={0.5} sx={{ mb: 1 }}>
              {model.closeReadiness.map((item) => (
                <Stack key={item.label} direction="row" spacing={0.75} sx={{ alignItems: "flex-start" }}>
                  {item.ready ? (
                    <CheckCircleOutlineIcon sx={{ fontSize: 14, mt: "2px", color: TOURNAMENT_COLOR.success }} />
                  ) : (
                    <ErrorOutlineIcon sx={{ fontSize: 14, mt: "2px", color: TOURNAMENT_COLOR.warning }} />
                  )}
                  <Typography sx={{ fontSize: 12.5, color: item.ready ? TOURNAMENT_COLOR.text : TOURNAMENT_COLOR.warning }}>
                    {item.label}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            <span title={model.closeHint}>
              <Button
                variant="outlined"
                startIcon={<LockOutlinedIcon />}
                fullWidth
                size="small"
                disabled
                sx={outlinedActionSx}
              >
                Đóng đăng ký
              </Button>
            </span>
            <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, mt: 0.75 }}>
              {model.closeHint} Cần xác nhận khi đóng. Không xóa hồ sơ.
            </Typography>
          </CenterRightRailCard>
        }
      >
        <TextField
          size="small"
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm theo tên, SĐT, email, mã..."
          sx={{ mb: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Tabs
          value={tab}
          onChange={(_e, value) => setTab(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mb: 1, minHeight: 36, "& .MuiTab-root": { textTransform: "none", minHeight: 36, py: 0.5 } }}
        >
          {model.tabs.map((item) => (
            <Tab key={item.id} value={item.id} label={item.label} />
          ))}
        </Tabs>

        {rows.length === 0 ? (
          <Paper elevation={0} sx={{ p: 2, border: `1px dashed ${TOURNAMENT_COLOR.divider}` }}>
            <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
              {model.needsEventChoice ? "Chọn nội dung để xem đăng ký." : "Chưa có hồ sơ đăng ký trên nội dung này."}
            </Typography>
          </Paper>
        ) : isTable ? (
          <Paper
            elevation={0}
            sx={{
              border: `1px solid ${TOURNAMENT_COLOR.divider}`,
              borderRadius: `${TOURNAMENT_RADIUS.card}px`,
              overflow: "auto",
              maxWidth: "100%",
            }}
          >
            <Table size="small" sx={{ minWidth: 640, "& .MuiTableCell-root": { py: 0.7 } }}>
              <TableHead>
                <TableRow>
                  {["Mã", "Người đăng ký / Cặp", "Nguồn", "Trạng thái", "Thanh toán", "Check-in", "Thao tác"].map(
                    (header) => (
                      <TableCell key={header} sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.textMuted }}>
                        {header}
                      </TableCell>
                    )
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontSize: 12.5 }}>{row.id}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{row.names}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted }}>{row.phone}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{row.source}</TableCell>
                    <TableCell>
                      <ExperienceStatusChip tone={row.statusTone} label={row.statusLabel} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{row.paymentLabel}</TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{row.checkinLabel}</TableCell>
                    <TableCell>
                      <span title={row.actionHint}>
                        <Button
                          size="small"
                          disabled={!row.actionEnabled}
                          component={row.actionEnabled ? RouterLink : "button"}
                          to={row.actionEnabled ? registerTo : undefined}
                        >
                          {row.actionLabel}
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ) : (
          <Box>
            {rows.map((row) => (
              <RegistrationRecord key={row.id} row={row} registerTo={registerTo} />
            ))}
          </Box>
        )}
      </TournamentExperienceWorkspace>
    </ExperienceBatchBFrame>
  );
}
