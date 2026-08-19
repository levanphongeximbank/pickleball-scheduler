import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import ClubAssignmentBanner from "../../../../components/auth/ClubAssignmentBanner.jsx";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceOperatorCard from "../visual/ExperienceOperatorCard.jsx";
import ExperiencePageHeader from "../visual/ExperiencePageHeader.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";
import { eventDisplayName } from "./eventScope.js";

export function ExperienceBatchBFrame({ testId, title, subtitle, contextLine, contextChip, actions, children }) {
  return (
    <Box
      data-testid={testId}
      sx={{ width: "100%", minWidth: 0, overflowX: "hidden", bgcolor: TOURNAMENT_COLOR.pageBg }}
    >
      <ExperiencePageHeader
        title={title}
        subtitle={subtitle}
        contextLine={contextLine}
        actions={
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
            {contextChip}
            {actions}
          </Stack>
        }
      />
      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>{children}</Box>
    </Box>
  );
}

export function ExperienceEventContextCard({ eyebrow, tournamentName, eventName, extra }) {
  return (
    <ExperienceOperatorCard sx={{ mb: 1.5, bgcolor: TOURNAMENT_COLOR.primarySurface, borderColor: TOURNAMENT_COLOR.primary }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.primary }}>{eyebrow}</Typography>
      <Typography sx={{ fontWeight: 800 }}>{tournamentName}</Typography>
      <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
        Nội dung: {eventName || "Chưa chọn"} {extra ? `• ${extra}` : ""}
      </Typography>
    </ExperienceOperatorCard>
  );
}

export function BatchBLoading({ title, subtitle, testId, message }) {
  return (
    <ExperienceBatchBFrame testId={testId} title={title} subtitle={subtitle}>
      <Alert severity="info">{message}</Alert>
    </ExperienceBatchBFrame>
  );
}

export function BatchBError({ title, subtitle, testId, error }) {
  return (
    <ExperienceBatchBFrame testId={testId} title={title} subtitle={subtitle}>
      <Alert severity="error">{error}</Alert>
    </ExperienceBatchBFrame>
  );
}

export function BatchBMissingTournament({ title, subtitle, testId }) {
  return (
    <ExperienceBatchBFrame testId={testId} title={title} subtitle={subtitle}>
      <ClubAssignmentBanner />
      <Alert severity="warning">Không tìm thấy giải. Chọn CLB trên thanh công cụ rồi mở lại giải.</Alert>
    </ExperienceBatchBFrame>
  );
}

export function BatchBWrongFamily({ title, subtitle, testId }) {
  return (
    <ExperienceBatchBFrame testId={testId} title={title} subtitle={subtitle}>
      <Alert severity="info">
        Màn này dành cho giải cá nhân / chính thức.{" "}
        <Button component={RouterLink} to="/tournament" size="small">
          Quay lại
        </Button>
      </Alert>
    </ExperienceBatchBFrame>
  );
}

export function BatchBEventPicker({ events, selectedEventId, onSelect }) {
  if (!events?.length) {
    return (
      <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mb: 1 }}>
        Chưa có nội dung trên hồ sơ.
      </Typography>
    );
  }
  if (events.length === 1) return null;
  return (
    <Box sx={{ mb: 1 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>Chọn nội dung</Typography>
      <ExperienceChipRow
        value={selectedEventId || ""}
        onChange={onSelect}
        items={events.map((event) => ({
          id: event.id,
          label: eventDisplayName(event),
        }))}
      />
    </Box>
  );
}

export function BatchBSiblingNav({ items }) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 1.5, flexWrap: "wrap" }}>
      {items.map((item) => (
        <Button
          key={item.id}
          size="small"
          component={RouterLink}
          to={item.to}
          variant={item.current ? "contained" : "outlined"}
          sx={item.current ? undefined : outlinedActionSx}
        >
          {item.label}
        </Button>
      ))}
    </Stack>
  );
}
