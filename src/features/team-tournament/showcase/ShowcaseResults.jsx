import { Box, Button, Stack, Typography } from "@mui/material";
import {
  showcaseActionsSx,
  showcaseBadgeSx,
  showcaseCardSx,
  showcaseMutedSx,
  showcaseTitleSx,
} from "./showcaseStyles.js";
import { SHOWCASE_COPY } from "./showcaseConstants.js";

export default function ShowcaseResults({
  tournamentName,
  session,
  savedAt,
  draftStatus,
  onFullscreen,
  onReplay,
  onBackTournament,
  onContinueSetup,
  onExport,
  canExport,
}) {
  const teams = session?.teamCards || [];
  const groups = session?.groupSession?.groupCards || [];

  return (
    <Stack spacing={3}>
      <Typography component="h1" sx={showcaseTitleSx}>
        {SHOWCASE_COPY.complete}
      </Typography>
      <Box sx={showcaseBadgeSx}>{tournamentName || "Giải đấu đồng đội"}</Box>

      <Box sx={showcaseCardSx}>
        <Box sx={showcaseMutedSx} mb={1}>
          Đã lưu: {savedAt ? new Date(savedAt).toLocaleString("vi-VN") : "—"} · Trạng thái:{" "}
          {draftStatus || "đã lưu"}
        </Box>
        <Typography fontWeight={800} mb={1}>
          {teams.length} đội · {groups.length} bảng
        </Typography>
        {groups.map((group) => (
          <Box key={group.id} mb={1.5}>
            <strong>{group.name}</strong>
            <Box sx={showcaseMutedSx}>
              {(group.teams || [])
                .map((team) => {
                  const captain =
                    team.athletes?.find((a) => a.isCaptain)?.name ||
                    SHOWCASE_COPY.missingCaptain;
                  return `${team.name} (ĐT: ${captain}, TB ${Number(team.avgLevel || 0).toFixed(2)})`;
                })
                .join(" · ")}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={showcaseActionsSx}>
        <Button variant="contained" color="success" onClick={onFullscreen}>
          Toàn màn hình
        </Button>
        <Button variant="outlined" color="inherit" onClick={onReplay}>
          Chiếu lại
        </Button>
        <Button variant="outlined" color="inherit" onClick={onBackTournament}>
          Về trang giải đấu
        </Button>
        <Button variant="outlined" color="inherit" onClick={onContinueSetup}>
          Tiếp tục cấu hình giải
        </Button>
        {canExport && onExport ? (
          <Button variant="text" color="inherit" onClick={onExport}>
            In / Xuất kết quả
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}
