import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import {
  showcaseActionsSx,
  showcaseCardSx,
  showcaseMutedSx,
  showcaseTeamCardSx,
  showcaseTitleSx,
} from "./showcaseStyles.js";
import { SHOWCASE_COPY } from "./showcaseConstants.js";

export function ShowcaseGroupFormatSelect({
  options = [],
  engineVersion,
  rulesVersion,
  onSelect,
  onBack,
}) {
  return (
    <Stack spacing={3}>
      <Typography component="h1" sx={showcaseTitleSx}>
        {SHOWCASE_COPY.continueGroups}
      </Typography>
      <Box sx={showcaseCardSx}>
        <Box sx={showcaseMutedSx} mb={1}>
          engineVersion: {engineVersion || "—"} · rulesVersion: {rulesVersion || "—"}
        </Box>
        <Typography mb={2}>Chọn định dạng chia bảng cho 8 đội:</Typography>
        <Stack spacing={1.5}>
          {options.map((option) => (
            <Button
              key={option.groupCount}
              variant="contained"
              color="success"
              size="large"
              onClick={() => onSelect(option)}
            >
              {option.label}
            </Button>
          ))}
        </Stack>
      </Box>
      <Box sx={showcaseActionsSx}>
        <Button variant="outlined" color="inherit" onClick={onBack}>
          Quay lại xem đội
        </Button>
      </Box>
    </Stack>
  );
}

export default function ShowcaseGroupReveal({
  groupCards = [],
  groupIndex = 0,
  showAll = false,
  diagnostics,
  seedingMode,
  engineVersion,
  rulesVersion,
  paused,
  onPause,
  onResume,
  onPrev,
  onNext,
  onShowAll,
  onReselectFormat,
  onContinue,
}) {
  const visibleGroups = showAll
    ? groupCards
    : groupCards.slice(0, Math.min(groupIndex + 1, groupCards.length));

  return (
    <Stack spacing={3}>
      <Typography component="h1" sx={showcaseTitleSx}>
        Công bố bảng {Math.min(groupIndex + 1, groupCards.length)}/{groupCards.length}
      </Typography>

      <Box sx={showcaseMutedSx}>
        Phương pháp: {seedingMode || "auto-seeded"} · engineVersion: {engineVersion || "—"} ·
        rulesVersion: {rulesVersion || "—"}
      </Box>

      <Stack spacing={2}>
        {visibleGroups.map((group) => (
          <Box key={group.id} sx={showcaseTeamCardSx}>
            <Typography fontSize="1.5rem" fontWeight={800} mb={1}>
              {group.name}
            </Typography>
            <Box sx={showcaseMutedSx} mb={1}>
              {group.teamCount} đội · TB bảng {Number(group.avgRating || 0).toFixed(2)}
            </Box>
            <Stack spacing={1}>
              {(group.teams || []).map((team) => (
                <Box
                  key={team.id}
                  sx={{
                    p: 1.25,
                    borderRadius: 1,
                    bgcolor: "rgba(255,255,255,0.04)",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between">
                    <Box fontWeight={700}>{team.name}</Box>
                    <Box color="#7CFFB2">{Number(team.avgLevel || 0).toFixed(2)}</Box>
                  </Stack>
                  <Box sx={showcaseMutedSx}>
                    {(team.athletes || []).map((a) => a.name).join(" · ")}
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>

      {diagnostics && !diagnostics.complete ? (
        <Alert severity="warning">
          Chẩn đoán: thiếu {diagnostics.missingTeamIds?.length || 0}, trùng{" "}
          {diagnostics.duplicateTeamIds?.length || 0}
        </Alert>
      ) : null}

      <Box sx={showcaseActionsSx}>
        {paused ? (
          <Button variant="contained" color="success" onClick={onResume}>
            Tiếp tục
          </Button>
        ) : (
          <Button variant="outlined" color="inherit" onClick={onPause}>
            Tạm dừng
          </Button>
        )}
        <Button variant="outlined" color="inherit" onClick={onPrev} disabled={groupIndex <= 0}>
          Bảng trước
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onNext}
          disabled={groupIndex >= groupCards.length - 1}
        >
          Bảng tiếp theo
        </Button>
        <Button variant="text" color="inherit" onClick={onShowAll}>
          Hiện tất cả
        </Button>
        {onReselectFormat ? (
          <Button variant="text" color="inherit" onClick={onReselectFormat}>
            Chọn lại 2 bảng / 4 bảng
          </Button>
        ) : null}
        {(showAll || groupIndex >= groupCards.length - 1) && onContinue ? (
          <Button variant="contained" color="success" onClick={onContinue}>
            Xem lại trước khi lưu
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}
