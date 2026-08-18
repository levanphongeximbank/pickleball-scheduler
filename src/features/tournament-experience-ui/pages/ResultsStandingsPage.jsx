import { useState } from "react";
import { Button, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import {
  CompetitionContextHeader,
  GroupSelector,
  StageSelector,
  StandingsTable,
} from "../components/competitionSurfaces.jsx";
import { FixtureAuthorityNote, ReadinessPanel } from "../components/prototypeSurfaces.jsx";
import { OperatorCard } from "../components/prototypeCards.jsx";
import { TOURNAMENT_COLOR } from "../design/tournamentDesignTokens.js";
import { displayCompetitorLabel } from "../copy/uiDisplayLabels.js";
import {
  FIXTURE_GROUPS,
  FIXTURE_KO_RESULTS,
  FIXTURE_OVERALL_PREVIEW,
  FIXTURE_STANDINGS_BY_GROUP,
  FIXTURE_STANDINGS_READINESS,
} from "../fixtures/opsFixture.js";
import { FIXTURE_EVENTS, FIXTURE_TOURNAMENT_ID, getFixtureTournament } from "../fixtures/prototypeFixture.js";
import { tournamentPath } from "../navigation/tournamentNav.js";

export default function ResultsStandingsPage() {
  const tournament = getFixtureTournament();
  const [tab, setTab] = useState("group");
  const [eventId, setEventId] = useState("md-35");
  const [group, setGroup] = useState("A");
  const [locked, setLocked] = useState(false);
  const eventName = FIXTURE_EVENTS.find((item) => item.id === eventId)?.name || "Đôi nam 3.5";
  const standings = FIXTURE_STANDINGS_BY_GROUP[group] || [];
  const notReady = FIXTURE_STANDINGS_READINESS.some((item) => !item.ready);

  return (
    <TournamentExperienceShell
      title="Kết quả & Bảng xếp hạng"
      subtitle="Không phải màn giải thưởng"
      showEventContext
      actions={
        <Button
          variant="outlined"
          size="small"
          disabled={notReady || locked}
          onClick={() => setLocked(true)}
        >
          Khóa BXH
        </Button>
      }
    >
      <FixtureAuthorityNote>Khóa BXH chỉ là nguyên mẫu. Không tạo quyền khóa thật.</FixtureAuthorityNote>
      <CompetitionContextHeader
        tournament={tournament.name}
        event={eventName}
        stage={tab === "group" ? "Vòng bảng" : tab === "ko" ? "Loại trực tiếp" : "Chung cuộc"}
        group={tab === "group" ? group : null}
      />
      <StageSelector
        value={tab}
        onChange={setTab}
        items={[
          { id: "group", label: "Vòng bảng" },
          { id: "ko", label: "Loại trực tiếp" },
          { id: "final", label: "Chung cuộc" },
        ]}
      />
      <StageSelector
        value={eventId}
        onChange={setEventId}
        items={FIXTURE_EVENTS.map((item) => ({ id: item.id, label: item.name }))}
      />
      {tab === "group" ? (
        <GroupSelector value={group} onChange={setGroup} items={FIXTURE_GROUPS.map((item) => ({ id: item.id, label: item.name }))} />
      ) : null}
      <TournamentWorkspace
        rail={
          <>
            <ReadinessPanel
              title="MỨC SẴN SÀNG BXH"
              statusLabel={locked ? "ĐÃ KHÓA" : notReady ? "CHƯA SẴN SÀNG • 3" : "SẴN SÀNG"}
              statusTone={locked ? "success" : "warning"}
              items={FIXTURE_STANDINGS_READINESS}
              lockLabel="Khóa BXH"
              lockDisabled={notReady || locked}
              onLock={() => setLocked(true)}
            />
            <TournamentRightRailCard title="Ghi chú">
              <Typography sx={{ fontSize: 12.5 }}>LƯU ≠ KHÓA. Khóa BXH là bước riêng.</Typography>
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mt: 0.5 }}>
                Tab Chung cuộc là xem trước kết quả — màn giải thưởng là Kết quả chung cuộc & Giải thưởng.
              </Typography>
            </TournamentRightRailCard>
          </>
        }
      >
        {tab === "group" ? (
          <>
            <TournamentSectionTitle>Bảng xếp hạng bảng {group}</TournamentSectionTitle>
            <StandingsTable rows={standings} />
          </>
        ) : null}
        {tab === "ko" ? (
          <>
            <TournamentSectionTitle>Kết quả loại trực tiếp</TournamentSectionTitle>
            <Paper elevation={0} sx={{ overflow: "auto", border: `1px solid ${TOURNAMENT_COLOR.divider}` }}>
              <Table size="small" sx={{ minWidth: 520, "& .MuiTableCell-root": { py: 0.65 } }}>
                <TableHead>
                  <TableRow>
                    {["Vòng", "Trận", "Cặp", "Tỷ số", "Thắng"].map((h) => (
                      <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {FIXTURE_KO_RESULTS.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.round}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{row.id}</TableCell>
                      <TableCell>{row.a} vs {row.b}</TableCell>
                      <TableCell>{row.score}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{row.winner}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
            <Button component={RouterLink} to={tournamentPath(FIXTURE_TOURNAMENT_ID, "knockout")} size="small" sx={{ mt: 1 }}>
              Sang vòng loại trực tiếp
            </Button>
          </>
        ) : null}
        {tab === "final" ? (
          <>
            <TournamentSectionTitle>Chung cuộc — xem trước</TournamentSectionTitle>
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mb: 1 }}>
              Tab này không thay màn giải thưởng. Chỉ xem trước thứ hạng nội dung.
            </Typography>
            {FIXTURE_OVERALL_PREVIEW.map((row) => (
              <OperatorCard key={row.place} sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 800 }}>{row.place}</Typography>
                <Typography sx={{ fontSize: 14 }}>{displayCompetitorLabel(row.pair)}</Typography>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{row.note}</Typography>
              </OperatorCard>
            ))}
          </>
        ) : null}
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}
