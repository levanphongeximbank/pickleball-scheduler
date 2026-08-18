import { useMemo, useState } from "react";
import { Box, Button, Grid, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { AwardCard, LifecycleStepper, PresentationStatusChip } from "../components/closureSurfaces.jsx";
import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import { ChipRow, FixtureAuthorityNote, ReadinessPanel } from "../components/prototypeSurfaces.jsx";
import { TOURNAMENT_COLOR, TOURNAMENT_ELEVATION, TOURNAMENT_RADIUS } from "../design/tournamentDesignTokens.js";
import {
  FIXTURE_EVENT_COMPLETION,
  FIXTURE_PODIUM_BY_EVENT,
  FIXTURE_SPECIAL_AWARDS,
} from "../fixtures/opsFixture.js";
import { FIXTURE_EVENTS, FIXTURE_TOURNAMENT_ID, getFixtureTournament } from "../fixtures/prototypeFixture.js";
import { publicTournamentPath, tournamentPath } from "../navigation/tournamentNav.js";

export default function AwardsPage() {
  const tournament = getFixtureTournament();
  const [eventId, setEventId] = useState("md-35");
  const event = FIXTURE_EVENTS.find((item) => item.id === eventId);
  const completion = FIXTURE_EVENT_COMPLETION.find((item) => item.id === eventId);
  const podium = FIXTURE_PODIUM_BY_EVENT[eventId] || FIXTURE_PODIUM_BY_EVENT["md-35"];
  const champion = podium.find((item) => item.rank === 1);
  const others = podium.filter((item) => item.rank !== 1);
  const finalResultReady = Boolean(completion?.officialResult && champion?.pair !== "TBD");
  const awardsAssigned = Boolean(completion?.awards);
  const publicationReady = Boolean(completion?.eventComplete && awardsAssigned);
  const readinessItems = useMemo(
    () => [
      { label: "Trận chung kết đã kết thúc", ready: Boolean(completion?.matchesTerminal), note: completion?.matchesTerminal ? `${completion.done}/${completion.total} trận` : `${completion?.done}/${completion?.total} • còn lại` },
      { label: "Kết quả chính thức đã xác nhận", ready: Boolean(completion?.officialResult), note: completion?.officialResult ? "Đã xác nhận" : "Vô địch chưa xác định / chưa xác nhận" },
      { label: "Đã xác định vô địch", ready: champion?.pair !== "TBD", note: champion?.pair === "TBD" ? "VÔ ĐỊCH chưa xác định" : champion?.pair },
      { label: "Đã gán giải thưởng", ready: awardsAssigned, note: awardsAssigned ? "MVP / Giải Fair Play / Trận đấu ấn tượng" : "Chưa gán đủ giải phụ" },
      { label: "Sẵn sàng công bố", ready: publicationReady, note: publicationReady ? "Có thể công bố" : "Kết quả cuối chưa sẵn sàng" },
    ],
    [awardsAssigned, champion, completion, publicationReady],
  );

  const actions = (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      <Button variant="outlined" size="small" disabled={!finalResultReady}>
        Xác nhận kết quả cuối
      </Button>
      <Button variant="contained" size="small" disabled={!publicationReady}>
        Công bố giải thưởng
      </Button>
      <Button variant="outlined" size="small">
        Xem trước
      </Button>
    </Stack>
  );

  return (
    <TournamentExperienceShell
      title="Kết quả chung cuộc & Giải thưởng"
      subtitle="Không phải màn BXH • Không phải Hoàn tất giải đấu"
      showEventContext
      actions={actions}
    >
      <FixtureAuthorityNote>Công bố giải thưởng chỉ là nguyên mẫu.</FixtureAuthorityNote>
      <LifecycleStepper current={finalResultReady ? "Giải thưởng" : "Kết quả cuối"} />
      <ChipRow value={eventId} onChange={setEventId} items={FIXTURE_EVENTS.map((item) => ({ id: item.id, label: item.name }))} />
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 300px" },
          gridTemplateAreas: {
            xs: `"podium" "awards" "rail" "actions"`,
            lg: `"podium rail" "awards rail" "actions rail"`,
          },
        }}
      >
        <Box sx={{ gridArea: "podium", minWidth: 0 }}>
          <TournamentSectionTitle action={<PresentationStatusChip status={completion?.status || "NOT_READY"} />}>
            Bục trao giải — {event?.name}
          </TournamentSectionTitle>
          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12 }}>
              <AwardCard
                featured
                rank={1}
                title={champion.place}
                pair={champion.pair}
                event={event?.name}
                status={champion.status}
              />
            </Grid>
            {others.map((item) => (
              <Grid key={item.place} size={{ xs: 12, sm: 6 }}>
                <AwardCard rank={item.rank} title={item.place} pair={item.pair} event={event?.name} status={item.status} />
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box sx={{ gridArea: "awards", minWidth: 0 }}>
          <TournamentSectionTitle>Giải phụ</TournamentSectionTitle>
          <Grid container spacing={1.25}>
            {FIXTURE_SPECIAL_AWARDS.map((item) => (
              <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <AwardCard title={item.place} pair={item.pair} event={item.event} status={publicationReady && item.assigned ? "ASSIGNED" : "DRAFT"} />
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box sx={{ gridArea: "rail", minWidth: 0 }}>
          <ReadinessPanel
            title="Mức sẵn sàng công bố giải thưởng"
            statusLabel={publicationReady ? "SẴN SÀNG" : "CHƯA SẴN SÀNG"}
            items={readinessItems}
          />
          <Box sx={{ mt: 1.25 }}>
            <TournamentRightRailCard title="Xem trước trang công khai">
            <Paper
              elevation={0}
              sx={{
                p: 1.25,
                borderRadius: `${TOURNAMENT_RADIUS.card}px`,
                border: `1px dashed ${TOURNAMENT_COLOR.divider}`,
                bgcolor: TOURNAMENT_COLOR.pageBg,
                boxShadow: TOURNAMENT_ELEVATION.none,
              }}
            >
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: TOURNAMENT_COLOR.primary }}>TRANG GIẢI ĐẤU CÔNG KHAI</Typography>
              <Typography sx={{ fontWeight: 800 }}>{tournament.name}</Typography>
              <Typography sx={{ fontSize: 12.5 }}>{event?.name} — Kết quả chung cuộc</Typography>
              <Typography sx={{ fontSize: 13, mt: 0.75 }}><b>VÔ ĐỊCH:</b> {champion.pair}</Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                {publicationReady ? "Sẽ hiện sau Công bố giải thưởng." : "Chưa công bố — Vô địch: Chưa xác định / nội dung đang thi đấu."}
              </Typography>
            </Paper>
            </TournamentRightRailCard>
          </Box>
          <Button
            component={RouterLink}
            to={tournamentPath(FIXTURE_TOURNAMENT_ID, "complete")}
            size="small"
            sx={{ mt: 0.5 }}
          >
            Sang Hoàn tất giải đấu
          </Button>
          <Button component={RouterLink} to={publicTournamentPath()} size="small">
            Xem trang công khai (mẫu)
          </Button>
        </Box>

        <Box sx={{ gridArea: "actions", minWidth: 0 }}>
          {actions}
        </Box>
      </Box>
    </TournamentExperienceShell>
  );
}
