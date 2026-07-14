import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import {
  Alert,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { FORMAT_PRESET } from "../../../features/team-tournament/constants.js";
import TournamentSectionCard from "../TournamentSectionCard.jsx";
import { MLP_TIE_RESOLUTION_LEGEND } from "./teamTournamentLabels.js";
import TeamStandingsRankBadge from "./TeamStandingsRankBadge.jsx";
import {
  TEAM_STANDINGS_COLUMNS,
  buildTiebreakLegend,
  formatFormatPresetLabel,
  formatSubMatchDiff,
  getStandingsRowClassName,
  getSubMatchDiffClassName,
} from "./teamStandingsLabels.js";
import "./teamStandings.css";

function StandingsHeaderChips({ formatPreset, teamCount }) {
  const presetLabel = formatFormatPresetLabel(formatPreset);

  return (
    <Stack direction="row" spacing={1} className="team-standings__header-chips">
      {presetLabel ? (
        <Chip size="small" label={presetLabel} className="team-standings__chip--preset" />
      ) : null}
      {teamCount > 0 ? (
        <Chip
          size="small"
          label={`${teamCount} đội`}
          className="team-standings__chip--teams"
        />
      ) : null}
    </Stack>
  );
}

function StandingsEmptyState() {
  return (
    <div className="team-standings__empty">
      <Typography className="team-standings__empty-title" color="text.primary">
        Chưa có dữ liệu BXH
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Nhập kết quả trên portal trọng tài để cập nhật bảng xếp hạng.
      </Typography>
    </div>
  );
}

export default function TeamStandingsTable({
  standings = [],
  tournamentName = "",
  formatPreset = "",
  tiebreakOrder = [],
  matchupsDone = 0,
  matchupsTotal = 0,
  dreambreakerPending = 0,
  scheduleLabel = "Vòng tròn",
  title = "BXH giải đồng đội",
  compact = false,
}) {
  const subtitle = tournamentName
    ? `${tournamentName}${scheduleLabel ? ` — ${scheduleLabel}` : ""}`
    : "Trận = tie hoàn tất • HS trận con cập nhật sau xác nhận";
  const tiebreakLegend = buildTiebreakLegend(tiebreakOrder);

  return (
    <TournamentSectionCard
      title={title}
      subtitle={compact ? scheduleLabel || subtitle : subtitle}
      badge={
        <StandingsHeaderChips formatPreset={formatPreset} teamCount={standings.length} />
      }
      contentSx={{ pt: 1.5 }}
    >
      <div className="team-standings">
        {tournamentName ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
            Trận = tie hoàn tất • HS trận con cập nhật sau xác nhận
            {formatPreset === FORMAT_PRESET.MLP_4 ? ` • ${MLP_TIE_RESOLUTION_LEGEND}` : ""}
          </Typography>
        ) : null}
        {dreambreakerPending > 0 ? (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {dreambreakerPending} tie đang hòa 2–2 — cần bước{" "}
            <strong>Dreambreaker</strong> (trận quyết định, đấu đơn luân lưu) trước khi chốt kết
            quả.
          </Alert>
        ) : null}
        {standings.length === 0 ? (
          <StandingsEmptyState />
        ) : (
          <>
            <TableContainer className="team-standings__table-wrap">
              <Table size="small" className="team-standings__table">
                <TableHead>
                  <TableRow>
                    {TEAM_STANDINGS_COLUMNS.map((column) => (
                      <TableCell
                        key={column.id}
                        align={column.align}
                        title={column.title || undefined}
                        className={
                          column.sticky
                            ? column.id === "team"
                              ? "team-standings__sticky team-standings__sticky--team"
                              : "team-standings__sticky"
                            : undefined
                        }
                      >
                        {column.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {standings.map((row) => {
                    const rowClass = getStandingsRowClassName(row.rank);
                    const diffClass = getSubMatchDiffClassName(row.subMatchDiff);

                    return (
                      <TableRow key={row.teamId} hover className={rowClass}>
                        <TableCell align="center" className="team-standings__sticky">
                          <TeamStandingsRankBadge rank={row.rank} />
                        </TableCell>
                        <TableCell
                          className={`team-standings__sticky team-standings__sticky--team ${rowClass}`}
                        >
                          <Typography variant="body2" className="team-standings__team-name">
                            {row.teamName}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">{row.played}</TableCell>
                        <TableCell align="center">
                          <span className={row.wins > 0 ? "team-standings__wins" : undefined}>
                            {row.wins}
                          </span>
                          –{row.losses}
                        </TableCell>
                        <TableCell align="center">
                          {row.subMatchWins ?? 0}–{row.subMatchLosses ?? 0}
                        </TableCell>
                        <TableCell align="center">{row.pointsScored ?? 0}</TableCell>
                        <TableCell align="center">{row.pointsConceded ?? 0}</TableCell>
                        <TableCell align="center">
                          <span className={diffClass}>{formatSubMatchDiff(row.subMatchDiff)}</span>
                        </TableCell>
                        <TableCell align="right" className="team-standings__points">
                          {row.rankingPoints ?? row.wins}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <div className="team-standings__footer">
              {matchupsTotal > 0 ? (
                <div className="team-standings__footer-row">
                  <SportsTennisIcon sx={{ fontSize: 16, color: "var(--team-standings-accent)" }} />
                  <span>
                    {matchupsDone}/{matchupsTotal} tie đã có kết quả trận con
                  </span>
                </div>
              ) : null}
              {tiebreakLegend ? <span>{tiebreakLegend}</span> : null}
            </div>
          </>
        )}
      </div>
    </TournamentSectionCard>
  );
}
