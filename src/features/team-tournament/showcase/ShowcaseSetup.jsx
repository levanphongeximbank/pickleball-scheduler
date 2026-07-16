import { useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { listGroupDivisionOptions } from "../engines/teamGroupDivisionPolicy.js";
import {
  showcaseActionsSx,
  showcaseCardSx,
  showcaseMutedSx,
  showcaseTitleSx,
} from "./showcaseStyles.js";
import { SHOWCASE_COPY, SHOWCASE_DEFAULT_TEAM_COUNT } from "./showcaseConstants.js";

/**
 * Owner setup form before ceremony countdown.
 * Presentation only — does not run engines or write.
 */
export default function ShowcaseSetup({
  clubName = "—",
  clubOptions = [],
  players = [],
  selectedAthleteIds = [],
  teamCount = SHOWCASE_DEFAULT_TEAM_COUNT,
  groupCount = 2,
  preflight,
  onChange,
  onBack,
  onStart,
}) {
  const groupOptions = useMemo(
    () => listGroupDivisionOptions(Number(teamCount) || 0),
    [teamCount]
  );
  const selectedSet = useMemo(
    () => new Set((selectedAthleteIds || []).map(String)),
    [selectedAthleteIds]
  );
  const selectableIds = useMemo(
    () => players.map((player) => String(player?.id || "")).filter(Boolean),
    [players]
  );
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedSet.has(id));
  const someSelected = selectableIds.some((id) => selectedSet.has(id));
  const summary = preflight?.summary || {};

  const clubs =
    clubOptions.length > 0
      ? clubOptions
      : [{ id: "current", name: clubName || "—" }];

  function emit(patch) {
    onChange?.({
      teamCount,
      groupCount,
      selectedAthleteIds,
      ...patch,
    });
  }

  function toggleAthlete(athleteId, checked) {
    const next = new Set(selectedSet);
    if (checked) {
      next.add(String(athleteId));
    } else {
      next.delete(String(athleteId));
    }
    emit({ selectedAthleteIds: [...next] });
  }

  const canStart = preflight?.ok === true && Number(groupCount) >= 2;

  return (
    <Stack spacing={3} maxWidth={720} mx="auto" width="100%">
      <Typography component="h1" sx={showcaseTitleSx}>
        Thiết lập lễ bốc thăm
      </Typography>

      <Box sx={showcaseCardSx}>
        <Stack spacing={2.5}>
          <FormControl fullWidth>
            <FormLabel sx={{ color: "rgba(244,247,251,0.7)", mb: 0.75 }}>
              Câu lạc bộ
            </FormLabel>
            <Select
              value={clubs[0]?.id || "current"}
              disabled
              sx={{
                color: "#f4f7fb",
                ".MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(124,255,178,0.35)",
                },
                ".MuiSvgIcon-root": { color: "#f4f7fb" },
              }}
            >
              {clubs.map((club) => (
                <MenuItem key={club.id} value={club.id}>
                  {club.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <FormLabel sx={{ color: "rgba(244,247,251,0.7)" }}>Nguồn VĐV</FormLabel>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allSelected}
                  indeterminate={!allSelected && someSelected}
                  onChange={(event) => {
                    emit({
                      selectedAthleteIds: event.target.checked ? selectableIds : [],
                    });
                  }}
                  sx={{ color: "#7CFFB2", "&.Mui-checked": { color: "#7CFFB2" } }}
                />
              }
              label={`Chọn tất cả · đã chọn ${summary.athleteCount ?? 0}/${players.length} VĐV`}
              sx={{ color: "#f4f7fb", mt: 0.5 }}
            />
            <Box
              sx={{
                mt: 1,
                maxHeight: 230,
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 0.5,
                p: 1,
                borderRadius: 1,
                border: "1px solid rgba(255,255,255,0.1)",
                bgcolor: "rgba(255,255,255,0.025)",
              }}
            >
              {players.map((player, index) => {
                const athleteId = String(player?.id || "");
                const label =
                  player?.name ||
                  player?.displayName ||
                  (athleteId ? `VĐV ${athleteId}` : `VĐV thiếu ID #${index + 1}`);
                return (
                  <FormControlLabel
                    key={athleteId || `missing-${index}`}
                    control={
                      <Checkbox
                        size="small"
                        checked={athleteId ? selectedSet.has(athleteId) : true}
                        disabled={!athleteId}
                        onChange={(event) =>
                          toggleAthlete(athleteId, event.target.checked)
                        }
                        sx={{
                          color: "#7CFFB2",
                          "&.Mui-checked": { color: "#7CFFB2" },
                        }}
                      />
                    }
                    label={label}
                    sx={{
                      m: 0,
                      color: athleteId ? "#f4f7fb" : "#ff9d9d",
                      "& .MuiFormControlLabel-label": {
                        fontSize: "0.875rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      },
                    }}
                  />
                );
              })}
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 0.5, sm: 2 }}
              mt={1}
              sx={showcaseMutedSx}
            >
              <Box>Đã chọn: {summary.athleteCount ?? 0} VĐV</Box>
              <Box>Nam: {summary.maleCount ?? 0}</Box>
              <Box>Nữ: {summary.femaleCount ?? 0}</Box>
            </Stack>
          </Box>

          <TextField
            label="Số đội"
            type="number"
            value={teamCount}
            inputProps={{ min: 0, max: 16 }}
            onChange={(event) => {
              const next = Number(event.target.value);
              const options = listGroupDivisionOptions(next);
              const nextGroup =
                options.find((o) => o.groupCount === Number(groupCount))?.groupCount ||
                options[0]?.groupCount ||
                Number(groupCount) ||
                2;
              emit({ teamCount: next, groupCount: nextGroup });
            }}
            InputLabelProps={{ sx: { color: "rgba(244,247,251,0.7)" } }}
            sx={{
              input: { color: "#f4f7fb" },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(124,255,178,0.35)",
              },
            }}
          />

          <FormControl>
            <FormLabel sx={{ color: "rgba(244,247,251,0.7)", mb: 0.75 }}>
              Kiểu chia bảng
            </FormLabel>
            <RadioGroup
              value={String(groupCount)}
              onChange={(event) => {
                const next = Number(event.target.value);
                emit({ groupCount: next });
              }}
            >
              {groupOptions.map((option) => (
                <FormControlLabel
                  key={option.groupCount}
                  value={String(option.groupCount)}
                  control={
                    <Radio
                      sx={{ color: "#7CFFB2", "&.Mui-checked": { color: "#7CFFB2" } }}
                    />
                  }
                  label={option.label}
                  sx={{ color: "#f4f7fb" }}
                />
              ))}
            </RadioGroup>
          </FormControl>

          <Stack spacing={0.5} sx={showcaseMutedSx}>
            <Box>
              Đội dự kiến: {summary.expectedTeamCount ?? 0}/
              {summary.requestedTeamCount ?? teamCount}
            </Box>
            <Box>Danh sách chờ dự kiến: {summary.expectedWaitingListCount ?? 0}</Box>
            <Box>Rating coverage: {summary.ratingCoverage ?? 0}%</Box>
          </Stack>

          <Box sx={showcaseMutedSx}>
            Mỗi đội MLP: 2 nam + 2 nữ · Định dạng đã chọn sẽ dùng sau khi công bố đội.
          </Box>
        </Stack>
      </Box>

      {(preflight?.blockers || []).map((blocker) => (
        <Alert key={blocker} severity="error">
          {blocker}
        </Alert>
      ))}
      {(preflight?.warnings || []).map((warning) => (
        <Alert key={warning} severity="warning">
          {warning}
        </Alert>
      ))}

      <Box sx={showcaseActionsSx}>
        <Button variant="outlined" color="inherit" onClick={onBack}>
          Quay lại
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={!canStart}
          onClick={() => {
            onStart?.({
              teamCount,
              groupCount,
              selectedAthleteIds,
            });
          }}
        >
          {SHOWCASE_COPY.start}
        </Button>
      </Box>
    </Stack>
  );
}
