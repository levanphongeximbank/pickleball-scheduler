import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";

import {
  GROUP_SUGGESTION_MODE,
  PAIRING_STRATEGY,
  applyAiSuggestion,
  dismissAiSuggestion,
  generateGroupSuggestion,
  generatePairingSuggestion,
  generateRuleSuggestions,
  generateSeedSuggestion,
  getAiTournamentSummary,
  predictTournamentTime,
  validateTournamentSchedule,
} from "../../../features/ai-assistant/index.js";
import AiSummaryCard from "./AiSummaryCard.jsx";
import AiSuggestionCard from "./AiSuggestionCard.jsx";

const GROUP_MODE_OPTIONS = [
  { value: GROUP_SUGGESTION_MODE.MANUAL_REVIEW, label: "Manual — chỉ cảnh báo" },
  { value: GROUP_SUGGESTION_MODE.LIGHT_RANDOM, label: "Random có điều kiện nhẹ" },
  { value: GROUP_SUGGESTION_MODE.COMPETITIVE_BALANCED, label: "Competitive Balanced" },
];

const PAIRING_OPTIONS = [
  { value: PAIRING_STRATEGY.BALANCED, label: "Cân bằng sức mạnh" },
  { value: PAIRING_STRATEGY.SAME_LEVEL, label: "Cùng trình độ" },
  { value: PAIRING_STRATEGY.MIXED_GENDER, label: "Nam + nữ" },
  { value: PAIRING_STRATEGY.AVOID_REPEAT, label: "Tránh lặp partner" },
  { value: PAIRING_STRATEGY.LIGHT_RANDOM, label: "Random có điều kiện" },
];

export default function TournamentAiAssistantPanel({
  tournamentId,
  clubId,
  tenantId,
  players = [],
  courts = [],
  userId = "",
  onApplied,
}) {
  const [summary, setSummary] = useState(null);
  const [canApply, setCanApply] = useState(true);
  const [viewOnly, setViewOnly] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [seedResult, setSeedResult] = useState(null);
  const [pairingResult, setPairingResult] = useState(null);
  const [groupResult, setGroupResult] = useState(null);
  const [timeResult, setTimeResult] = useState(null);
  const [scheduleResult, setScheduleResult] = useState(null);
  const [ruleResult, setRuleResult] = useState(null);

  const [groupMode, setGroupMode] = useState(GROUP_SUGGESTION_MODE.COMPETITIVE_BALANCED);
  const [pairingStrategy, setPairingStrategy] = useState(PAIRING_STRATEGY.BALANCED);

  const baseOptions = { clubId, players, courts };

  const refreshSummary = useCallback(async () => {
    const result = await getAiTournamentSummary(tournamentId, tenantId, baseOptions);
    if (!result.ok) {
      setError(result.error || "Không thể tải tổng quan AI.");
      return;
    }
    setSummary(result.summary);
    setCanApply(result.canApply);
    setViewOnly(result.viewOnly);
    setError("");
  }, [tournamentId, tenantId, clubId, players, courts]);

  useEffect(() => {
    void refreshSummary();
  }, [refreshSummary]);

  const runAction = async (fn, setter) => {
    setLoading(true);
    setError("");
    const result = await fn();
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "Lỗi AI.");
      return;
    }
    setter(result);
  };

  const handleApply = async (suggestionId) => {
    setLoading(true);
    const result = await applyAiSuggestion(suggestionId, tenantId, userId, {
      ...baseOptions,
      tournamentId,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "Không thể áp dụng đề xuất.");
      return;
    }
    onApplied?.(result.tournament);
    refreshSummary();
  };

  const handleDismiss = async (suggestionId) => {
    setLoading(true);
    const result = await dismissAiSuggestion(suggestionId, tenantId, userId, {
      ...baseOptions,
      tournamentId,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "Không thể bỏ qua đề xuất.");
    }
  };

  if (viewOnly) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Chế độ trọng tài — chỉ xem cảnh báo, không được Apply đề xuất.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <SmartToyIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          AI Assistant
        </Typography>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <AiSummaryCard summary={summary} />

      <Section title="Đề xuất hạt giống">
        <AiSuggestionCard
          title="Xếp hạt giống"
          impact={seedResult?.confidence}
          reasons={
            seedResult?.data?.seeds?.slice(0, 3).map(
              (s) => `#${s.seedRank} — điểm ${s.aiScore} (${s.confidence}): ${s.reasons?.[0] || ""}`
            ) || ["Phân tích ELO, trình độ và lịch sử để đề xuất hạt giống."]
          }
          warnings={seedResult?.warnings}
          explanation={seedResult?.data?.explanation}
          actionPlan={seedResult?.data?.seeds?.[0]?.actionPlan}
          canApply={canApply}
          loading={loading}
          previewContent={
            seedResult?.data?.seeds?.length ? (
              <Stack spacing={0.5}>
                {seedResult.data.seeds.map((s) => (
                  <Typography key={s.playerId} variant="body2">
                    #{s.seedRank} — {s.playerId} — {s.aiScore} pts ({s.confidence})
                  </Typography>
                ))}
              </Stack>
            ) : null
          }
          onPreview={() =>
            runAction(
              () => generateSeedSuggestion(tournamentId, tenantId, baseOptions),
              setSeedResult
            )
          }
          onApply={() => seedResult?.suggestionId && handleApply(seedResult.suggestionId)}
          onDismiss={() => seedResult?.suggestionId && handleDismiss(seedResult.suggestionId)}
        />
      </Section>

      <Section title="Đề xuất ghép cặp">
        <FormControl size="small" sx={{ mb: 1, minWidth: 220 }}>
          <InputLabel>Chiến lược</InputLabel>
          <Select
            value={pairingStrategy}
            label="Chiến lược"
            onChange={(e) => setPairingStrategy(e.target.value)}
          >
            {PAIRING_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <AiSuggestionCard
          title="Ghép cặp / đội"
          impact={pairingResult?.data?.fairnessScore ? `Fairness ${pairingResult.data.fairnessScore}` : null}
          reasons={[pairingResult?.data?.explanation || "Đề xuất ghép cặp theo chiến lược đã chọn."]}
          warnings={pairingResult?.warnings}
          explanation={pairingResult?.data?.explanation}
          actionPlan={pairingResult?.data?.teams?.[0]?.actionPlan}
          canApply={canApply}
          loading={loading}
          previewContent={
            pairingResult?.data?.teams?.length ? (
              <Stack spacing={0.5}>
                {pairingResult.data.teams.map((team) => (
                  <Typography key={team.playerIds.join("-")} variant="body2">
                    {team.playerIds.join(" + ")} — {Math.round(team.combinedScore)}
                  </Typography>
                ))}
              </Stack>
            ) : null
          }
          onPreview={() =>
            runAction(
              () =>
                generatePairingSuggestion(
                  tournamentId,
                  tenantId,
                  pairingStrategy,
                  baseOptions
                ),
              setPairingResult
            )
          }
          onApply={() => pairingResult?.suggestionId && handleApply(pairingResult.suggestionId)}
          onDismiss={() => pairingResult?.suggestionId && handleDismiss(pairingResult.suggestionId)}
        />
      </Section>

      <Section title="Đề xuất chia bảng">
        <FormControl size="small" sx={{ mb: 1, minWidth: 220 }}>
          <InputLabel>Chế độ</InputLabel>
          <Select value={groupMode} label="Chế độ" onChange={(e) => setGroupMode(e.target.value)}>
            {GROUP_MODE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <AiSuggestionCard
          title="Chia bảng"
          impact={groupResult?.data?.overallBalanceScore ? `Balance ${groupResult.data.overallBalanceScore}` : null}
          reasons={[groupResult?.data?.explanation || "Phân tích cân bằng sức mạnh giữa các bảng."]}
          warnings={groupResult?.warnings}
          explanation={groupResult?.data?.explanation}
          actionPlan={groupResult?.data?.groups?.[0]?.actionPlan}
          canApply={canApply && groupMode !== GROUP_SUGGESTION_MODE.MANUAL_REVIEW}
          loading={loading}
          previewContent={
            groupResult?.data?.groups?.length ? (
              <Stack spacing={0.5}>
                {groupResult.data.groups.map((g) => (
                  <Typography key={g.groupName} variant="body2">
                    {g.groupName}: {g.teamIds.length} đội — TB {g.averageElo}
                  </Typography>
                ))}
              </Stack>
            ) : null
          }
          onPreview={() =>
            runAction(
              () => generateGroupSuggestion(tournamentId, tenantId, groupMode, baseOptions),
              setGroupResult
            )
          }
          onApply={() => groupResult?.suggestionId && handleApply(groupResult.suggestionId)}
          onDismiss={() => groupResult?.suggestionId && handleDismiss(groupResult.suggestionId)}
        />
      </Section>

      <Section title="Dự đoán thời gian">
        <AiSuggestionCard
          title="Thời gian giải"
          impact={timeResult?.data?.reasonableTotalMinutes ? `${timeResult.data.reasonableTotalMinutes} phút` : null}
          reasons={[timeResult?.data?.explanation || "Ước tính dựa trên số trận, sân và luật điểm."]}
          warnings={timeResult?.warnings}
          explanation={timeResult?.data?.explanation}
          actionPlan={timeResult?.data?.actionPlan}
          canApply={false}
          loading={loading}
          previewContent={
            timeResult?.data ? (
              <Stack spacing={0.5}>
                <Typography variant="body2">Trận: {timeResult.data.totalMatches}</Typography>
                <Typography variant="body2">TB/trận: {timeResult.data.averageMatchMinutes} phút</Typography>
                <Typography variant="body2">Tối thiểu: {timeResult.data.minTotalMinutes} phút</Typography>
                <Typography variant="body2">Hợp lý: {timeResult.data.reasonableTotalMinutes} phút</Typography>
                <Typography variant="body2">Rủi ro trễ: {timeResult.data.riskTotalMinutes} phút</Typography>
                <Typography variant="body2">Kết thúc dự kiến: {timeResult.data.estimatedFinishTime}</Typography>
              </Stack>
            ) : null
          }
          onPreview={() =>
            runAction(
              () => predictTournamentTime(tournamentId, tenantId, baseOptions),
              setTimeResult
            )
          }
        />
      </Section>

      <Section title="Kiểm tra lịch thi đấu">
        <AiSuggestionCard
          title="Validator lịch"
          impact={
            scheduleResult?.data?.summary
              ? `${scheduleResult.data.summary.critical} critical / ${scheduleResult.data.summary.warning} warning`
              : null
          }
          reasons={
            scheduleResult?.data?.issues?.slice(0, 5).map((i) => i.message) || [
              "Phát hiện xung đột đội, sân, nghỉ ngắn, kết thúc muộn.",
            ]
          }
          explanation={scheduleResult?.data?.summary ? `Có ${scheduleResult.data.summary.critical} lỗi nghiêm trọng và ${scheduleResult.data.summary.warning} cảnh báo.` : ""}
          canApply={false}
          loading={loading}
          previewContent={
            scheduleResult?.data?.issues?.length ? (
              <Stack spacing={0.5}>
                {scheduleResult.data.issues.map((issue) => (
                  <Typography key={issue.issueId} variant="body2">
                    [{issue.severity}] {issue.message}
                  </Typography>
                ))}
              </Stack>
            ) : null
          }
          onPreview={() =>
            runAction(
              () => validateTournamentSchedule(tournamentId, tenantId, baseOptions),
              setScheduleResult
            )
          }
        />
      </Section>

      <Section title="Gợi ý thay đổi luật">
        <AiSuggestionCard
          title="Đề xuất luật"
          reasons={
            ruleResult?.data?.suggestions?.map((s) => `${s.title}: ${s.recommendation}`) || [
              "Gợi ý điều chỉnh luật khi giải quá dài hoặc chưa cân bằng.",
            ]
          }
          explanation={ruleResult?.data?.suggestions?.length ? "Các đề xuất luật được sinh ra từ dữ liệu thời gian, số sân và độ dài giải hiện tại." : ""}
          canApply={false}
          loading={loading}
          previewContent={
            ruleResult?.data?.suggestions?.length ? (
              <Stack spacing={1}>
                {ruleResult.data.suggestions.map((s) => (
                  <Box key={s.suggestionId}>
                    <Typography variant="body2" fontWeight={600}>
                      {s.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.reason}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : null
          }
          onPreview={() =>
            runAction(
              () => generateRuleSuggestions(tournamentId, tenantId, baseOptions),
              setRuleResult
            )
          }
        />
      </Section>
    </Stack>
  );
}

function Section({ title, children }) {
  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}
