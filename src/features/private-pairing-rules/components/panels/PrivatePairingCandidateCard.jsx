import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

function playerName(player) {
  if (!player) return "—";
  if (typeof player === "string") return player;
  return player.displayName || player.name || player.playerId || player.id || "—";
}

/**
 * Read-only candidate visual card (no Apply).
 */
export default function PrivatePairingCandidateCard({ candidate, onCopyKey }) {
  if (!candidate) return null;
  const scores = candidate.scores || {};
  const matches = candidate.matches || [];
  const explanation = candidate.explanation || {};

  return (
    <Box
      component="article"
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        p: 1.5,
        mb: 1.5,
      }}
      aria-label={`Phương án xếp hạng ${candidate.rank}`}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap">
        <Typography variant="subtitle1" fontWeight={700}>
          Phương án #{candidate.rank}
        </Typography>
        <Chip size="small" label={`Tổng ${Math.round(scores.finalScore ?? candidate.finalScore ?? 0)}`} />
        <Chip size="small" color="info" variant="outlined" label="Mô phỏng — chưa áp dụng" />
        {candidate.differenceFromTop != null && candidate.rank > 1 && (
          <Typography variant="caption" color="text.secondary">
            lệch top: {Math.round(candidate.differenceFromTop)}
          </Typography>
        )}
      </Stack>

      {matches.length > 0 ? (
        matches.map((match, index) => (
          <Box key={index} sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Sân {index + 1}
            </Typography>
            <Typography variant="body2">
              {(match.teamA || []).map(playerName).join(" + ")}
              {"  vs  "}
              {(match.teamB || []).map(playerName).join(" + ")}
            </Typography>
          </Box>
        ))
      ) : (
        (candidate.teams || []).map((team, index) => (
          <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
            Đội {index + 1}:{" "}
            {(team.members || team.playerIds || []).map(playerName).join(" + ")}
          </Typography>
        ))
      )}

      {(candidate.benchPlayers || []).length > 0 && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Ngồi ngoài: {(candidate.benchPlayers || []).map(playerName).join(", ")}
        </Typography>
      )}

      <Divider sx={{ my: 1 }} />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={`Cân bằng ${Math.round(scores.balanceScore || 0)}`} />
        <Chip size="small" label={`Công bằng ${Math.round(scores.fairnessScore || 0)}`} />
        <Chip size="small" label={`Lịch sử ${Math.round(scores.historyScore || 0)}`} />
        <Chip size="small" label={`Quy tắc ${Math.round(scores.constraintScore || 0)}`} />
        <Chip size="small" label={`Đa dạng ${Math.round(scores.diversityScore || 0)}`} />
      </Stack>

      <Accordion disableGutters elevation={0} sx={{ mt: 1, bgcolor: "transparent" }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2">Tại sao AI ghép như vậy?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" display="block">
            Confidence: {explanation.confidence ?? "—"}
          </Typography>
          <Typography variant="caption" display="block">
            Satisfied: {(explanation.satisfiedRules || []).join(", ") || "—"}
          </Typography>
          <Typography variant="caption" display="block">
            Missed soft: {(explanation.missedSoftRules || []).join(", ") || "—"}
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {(explanation.reasons || []).map((reason, idx) => (
              <Typography key={`${reason.code}-${idx}`} variant="caption" component="div">
                [{reason.code}] impact={reason.impact}
              </Typography>
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {typeof onCopyKey === "function" && candidate.deterministicKey && (
        <Button
          size="small"
          sx={{ mt: 1 }}
          onClick={() => onCopyKey(candidate.deterministicKey)}
          aria-label="Sao chép mã phương án"
        >
          Sao chép mã phương án
        </Button>
      )}
    </Box>
  );
}
