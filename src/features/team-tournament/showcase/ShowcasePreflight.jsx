import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import {
  showcaseActionsSx,
  showcaseCardSx,
  showcaseMutedSx,
  showcaseSubtitleSx,
  showcaseTitleSx,
} from "./showcaseStyles.js";
import { SHOWCASE_COPY } from "./showcaseConstants.js";

export default function ShowcasePreflight({
  preflight,
  onBack,
  onStart,
  modeLabel,
}) {
  const summary = preflight?.summary || {};
  const rows = [
    ["Giải đấu", summary.tournamentName],
    ["Câu lạc bộ", summary.clubName],
    ["Tổng VĐV", summary.athleteCount],
    ["Nam", summary.maleCount],
    ["Nữ", summary.femaleCount],
    ["Số đội yêu cầu", summary.requestedTeamCount],
    ["Số đội dự kiến", summary.expectedTeamCount],
    ["Danh sách chờ dự kiến", summary.expectedWaitingListCount],
    ["engineVersion", summary.engineVersion],
    ["rulesVersion", summary.rulesVersion || "—"],
    ["Hard rules", summary.hardRuleResult],
    [
      "Soft rules",
      `áp dụng ${summary.softRuleSummary?.applied ?? 0} / thiếu ${summary.softRuleSummary?.missed ?? 0}`,
    ],
    [
      "Identity",
      `ok ${summary.identityDiagnostics?.withPairingIdentity ?? 0} / thiếu id ${summary.identityDiagnostics?.missingIdCount ?? 0}`,
    ],
    ["Rating coverage", `${summary.ratingCoverage ?? 0}%`],
  ];

  return (
    <Stack spacing={3}>
      <Typography component="h1" sx={showcaseTitleSx}>
        Kiểm tra trước lễ bốc thăm
      </Typography>
      {modeLabel ? (
        <Typography sx={showcaseSubtitleSx}>{modeLabel}</Typography>
      ) : null}

      <Box sx={showcaseCardSx}>
        <Stack spacing={1.25}>
          {rows.map(([label, value]) => (
            <Stack
              key={label}
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              spacing={0.5}
            >
              <Box sx={showcaseMutedSx}>{label}</Box>
              <Box fontWeight={700}>{value}</Box>
            </Stack>
          ))}
          <Box sx={{ ...showcaseMutedSx, pt: 1 }}>
            Định dạng bảng:{" "}
            {(summary.groupOptions || []).map((o) => o.label).join(" · ") || "—"}
          </Box>
          {summary.mlpCompositionOk ? (
            <Alert
              severity="success"
              sx={{ bgcolor: "rgba(46,204,113,0.12)", color: "#d7ffe8" }}
            >
              Mỗi đội MLP dự kiến gồm 2 nam + 2 nữ.
            </Alert>
          ) : null}
        </Stack>
      </Box>

      {(preflight?.warnings || []).map((warning) => (
        <Alert key={warning} severity="warning">
          {warning}
        </Alert>
      ))}
      {(preflight?.blockers || []).map((blocker) => (
        <Alert key={blocker} severity="error">
          {blocker}
        </Alert>
      ))}

      <Box sx={showcaseActionsSx}>
        <Button variant="outlined" color="inherit" onClick={onBack}>
          {SHOWCASE_COPY.backEdit}
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={!preflight?.ok}
          onClick={onStart}
        >
          {SHOWCASE_COPY.start}
        </Button>
      </Box>
    </Stack>
  );
}
