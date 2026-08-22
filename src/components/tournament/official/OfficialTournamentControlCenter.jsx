import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import {
  OFFICIAL_STAGE_STATE,
} from "../../../features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";

const STATE_COLOR = {
  [OFFICIAL_STAGE_STATE.COMPLETED]: "success",
  [OFFICIAL_STAGE_STATE.CURRENT]: "primary",
  [OFFICIAL_STAGE_STATE.READY]: "info",
  [OFFICIAL_STAGE_STATE.BLOCKED]: "warning",
  [OFFICIAL_STAGE_STATE.PENDING]: "default",
};

const STATE_LABEL = {
  [OFFICIAL_STAGE_STATE.COMPLETED]: "Hoàn tất",
  [OFFICIAL_STAGE_STATE.CURRENT]: "Đang làm",
  [OFFICIAL_STAGE_STATE.READY]: "Sẵn sàng",
  [OFFICIAL_STAGE_STATE.BLOCKED]: "Bị chặn",
  [OFFICIAL_STAGE_STATE.PENDING]: "Chờ",
};

export function OfficialTournamentStageRail({
  stages = [],
  activeStageId,
  onSelectStage,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  if (!stages.length) return null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: 1,
        overflowX: isMobile ? "visible" : "auto",
        pb: 0.5,
      }}
    >
      {stages.map((stage, index) => {
        const selected = stage.id === activeStageId;
        return (
          <Paper
            key={stage.id}
            variant="outlined"
            onClick={() => onSelectStage?.(stage.id)}
            sx={{
              p: 1.25,
              minWidth: isMobile ? "100%" : 148,
              cursor: "pointer",
              borderColor: selected ? "primary.main" : "divider",
              bgcolor: selected ? "action.selected" : "background.paper",
              flexShrink: 0,
            }}
          >
            <Stack spacing={0.75}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Typography variant="caption" color="text.secondary">
                  {index + 1}. {stage.label}
                </Typography>
                <Chip
                  size="small"
                  label={STATE_LABEL[stage.state] || stage.state}
                  color={STATE_COLOR[stage.state] || "default"}
                  variant={selected ? "filled" : "outlined"}
                />
              </Stack>
              <Typography variant="body2" sx={{ lineHeight: 1.35 }}>
                {stage.summary}
              </Typography>
            </Stack>
          </Paper>
        );
      })}
    </Box>
  );
}

export function OfficialTournamentOperationsSummary({
  tournament,
  facts,
  nextAction,
  canManage = true,
  onPrimaryAction,
}) {
  if (!facts) return null;

  const progress =
    facts.matches.total > 0
      ? Math.round((facts.matches.completed / facts.matches.total) * 100)
      : 0;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, mb: 2 }}>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "flex-start" }}
          gap={1.5}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
              {facts.tournamentName || tournament?.name || "Giải Official"}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
              <Chip size="small" label={facts.officialMode || "Official"} />
              <Chip size="small" color="primary" variant="outlined" label={facts.status} />
              <Chip
                size="small"
                label={
                  facts.registration.locked
                    ? "Đăng ký: đã chốt"
                    : `Đăng ký: ${facts.entries.approvedOrActive} duyệt / ${facts.entries.pending} chờ`
                }
              />
            </Stack>
          </Box>
          <Button
            variant="contained"
            size="large"
            disabled={!canManage || !nextAction?.actionId}
            onClick={() => onPrimaryAction?.(nextAction)}
            sx={{ whiteSpace: "nowrap", alignSelf: { xs: "stretch", md: "center" } }}
          >
            Việc tiếp theo: {nextAction?.label || "—"}
          </Button>
        </Stack>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          flexWrap="wrap"
          useFlexGap
        >
          <Chip
            size="small"
            variant="outlined"
            label={`VĐV đủ ĐK: ${facts.entries.drawEligibleCount}`}
          />
          <Chip size="small" variant="outlined" label={`Bảng: ${facts.draw.groupCount}`} />
          <Chip
            size="small"
            variant="outlined"
            label={`Trận: ${facts.matches.completed}/${facts.matches.total}`}
          />
          <Chip
            size="small"
            variant="outlined"
            label={`Trọng tài: ${facts.referees.assignedCount}/${facts.referees.matchCount || 0}`}
          />
          <Chip
            size="small"
            variant="outlined"
            label={`Sân: ${facts.schedule.courtCount || 0}`}
          />
        </Stack>

        {facts.matches.total > 0 ? (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Tiến độ trận đấu
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ mt: 0.5, height: 8, borderRadius: 1 }}
            />
          </Box>
        ) : null}

        {nextAction?.blocker ? (
          <Alert severity="warning">{nextAction.blocker}</Alert>
        ) : (
          <Alert severity="info" icon={false}>
            {nextAction?.summary || "Theo dõi vòng đời giải trên thanh giai đoạn bên dưới."}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}

export function OfficialTournamentStageCard({
  stage,
  children,
  secondaryAction = null,
}) {
  if (!stage) return null;
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, mb: 2 }}>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          gap={1}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {stage.label}
              </Typography>
              <Chip
                size="small"
                label={STATE_LABEL[stage.state] || stage.state}
                color={STATE_COLOR[stage.state] || "default"}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {stage.summary}
            </Typography>
          </Box>
          {secondaryAction}
        </Stack>
        {stage.blocker ? <Alert severity="warning">{stage.blocker}</Alert> : null}
        {children}
      </Stack>
    </Paper>
  );
}

export default function OfficialTournamentControlCenter({
  tournament,
  stages,
  facts,
  nextAction,
  activeStageId,
  onSelectStage,
  onPrimaryAction,
  canManage = true,
  children,
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <OfficialTournamentOperationsSummary
        tournament={tournament}
        facts={facts}
        nextAction={nextAction}
        canManage={canManage}
        onPrimaryAction={onPrimaryAction}
      />
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
        Vòng đời vận hành
      </Typography>
      <OfficialTournamentStageRail
        stages={stages}
        activeStageId={activeStageId}
        onSelectStage={onSelectStage}
      />
      {children}
    </Box>
  );
}
