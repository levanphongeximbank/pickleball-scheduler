import { Box, Checkbox, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  getChecklistProgress,
  getChecklistState,
  setChecklistState,
} from "../../../features/ai-assistant/services/aiSuggestionStorage.js";
import { useEffect, useMemo, useState } from "react";

export default function AiSummaryCard({ summary, tenantId = "", tournamentId = "" }) {
  const checklistScope = useMemo(
    () => (tenantId && tournamentId ? { tenantId, tournamentId } : null),
    [tenantId, tournamentId]
  );
  const checklistItems = useMemo(() => summary?.workflowChecklist || [], [summary?.workflowChecklist]);
  const [checkedItems, setCheckedItems] = useState(() => {
    const initial = {};
    if (summary?.workflowChecklist?.length) {
      summary.workflowChecklist.forEach((item) => {
        initial[item.title] = getChecklistState(item.title, checklistScope);
      });
    }
    return initial;
  });

  const checklistProgress = useMemo(
    () => getChecklistProgress(checklistItems, checklistScope),
    [checklistItems, checkedItems, checklistScope]
  );

  useEffect(() => {
    const initial = {};
    checklistItems.forEach((item) => {
      const nextValue = Boolean(item.completed || getChecklistState(item.title, checklistScope));
      initial[item.title] = nextValue;
      if (nextValue && !getChecklistState(item.title, checklistScope)) {
        setChecklistState(item.title, true, checklistScope);
      }
    });
    setCheckedItems(initial);
  }, [checklistItems, checklistScope]);

  if (!summary) {
    return null;
  }

  const { overallScore, balanceScore, fairnessScore, timeRisk, scheduleRisk, issueCounts, bullets, explanation, nextActions } =
    summary;

  const handleChecklistToggle = (title) => {
    const nextValue = !checkedItems[title];
    setCheckedItems((prev) => ({ ...prev, [title]: nextValue }));
    setChecklistState(title, nextValue, checklistScope);
  };

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <SmartToyIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          AI đánh giá giải đấu hiện tại: {overallScore}/100
        </Typography>
      </Stack>

      <LinearProgress
        variant="determinate"
        value={overallScore}
        sx={{ mb: 2, height: 8, borderRadius: 1 }}
      />

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
        <Chip size="small" label={`Cân bằng: ${balanceScore}`} />
        <Chip size="small" label={`Công bằng: ${fairnessScore}`} />
        <Chip size="small" color={timeRisk > 0 ? "warning" : "default"} label={`Rủi ro thời gian: ${timeRisk}`} />
        <Chip size="small" color={scheduleRisk > 0 ? "warning" : "default"} label={`Rủi ro lịch: ${scheduleRisk}`} />
        {summary?.phaseLabel && (
          <Chip size="small" color={summary.phase === "live" ? "warning" : summary.phase === "review" ? "info" : "success"} label={summary.phaseLabel} />
        )}
        {issueCounts?.critical > 0 && (
          <Chip size="small" color="error" label={`${issueCounts.critical} critical`} />
        )}
        {issueCounts?.warning > 0 && (
          <Chip size="small" color="warning" label={`${issueCounts.warning} warning`} />
        )}
      </Stack>

      {summary?.phaseHint && (
        <Box sx={{ mb: 1.5, p: 1, borderRadius: 1.5, bgcolor: "grey.50", border: "1px solid", borderColor: "divider" }}>
          <Typography variant="body2" color="text.secondary">
            {summary.phaseHint}
          </Typography>
        </Box>
      )}

      {summary?.matchProgress && summary.matchProgress.totalMatches > 0 && (
        <Box sx={{ mb: 1.5, p: 1.25, borderRadius: 1.5, bgcolor: "info.50", border: "1px solid", borderColor: "info.100" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={700} color="info.dark">
              Tiến độ trận đang diễn ra
            </Typography>
            <Typography variant="body2" color="info.dark" fontWeight={700}>
              {summary.matchProgress.label}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={summary.matchProgress.percent}
            color="info"
            sx={{ height: 8, borderRadius: 1 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Hoàn thành {summary.matchProgress.completedMatches} / {summary.matchProgress.totalMatches} trận, đang có {summary.matchProgress.activeMatches} trận đang chạy.
          </Typography>
        </Box>
      )}

      {explanation && (
        <Box sx={{ mb: 1.5, p: 1.25, borderRadius: 1.5, bgcolor: "primary.50", border: "1px solid", borderColor: "primary.100" }}>
          <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{ mb: 0.5 }}>
            Vì sao AI đưa ra đánh giá này
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {explanation}
          </Typography>
        </Box>
      )}

      {nextActions?.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
            Hành động tiếp theo
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {nextActions.map((action) => (
              <Chip key={action} size="small" color="primary" variant="outlined" label={action} />
            ))}
          </Stack>
        </Box>
      )}

      {checklistItems.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Checklist vận hành giải
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {checklistProgress.completed}/{checklistProgress.total} hoàn thành
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={checklistProgress.percent}
            sx={{ mb: 1, height: 8, borderRadius: 1 }}
          />
          <Stack spacing={1}>
            {checklistItems.map((item) => {
              const checked = Boolean(item.completed || checkedItems[item.title]);
              return (
                <Box key={item.title} sx={{ p: 1, borderRadius: 1, bgcolor: checked ? "success.50" : "grey.50", border: "1px solid", borderColor: checked ? "success.100" : "divider" }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Checkbox checked={checked} onChange={() => handleChecklistToggle(item.title)} size="small" />
                    <Box sx={{ flexGrow: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25, flexWrap: "wrap" }}>
                        <Typography variant="body2" fontWeight={700} sx={{ textDecoration: checked ? "line-through" : "none" }}>
                          {item.title}
                        </Typography>
                        {item.status === "completed" ? (
                          <Chip size="small" color="success" label="Hoàn thành" />
                        ) : item.status === "active" ? (
                          <Chip size="small" color="warning" label="Đang chạy" />
                        ) : (
                          <Chip size="small" color="default" label="Chờ thực hiện" />
                        )}
                        {item.priority === "high" ? (
                          <Chip size="small" color="error" label="Ưu tiên cao" />
                        ) : item.priority === "medium" ? (
                          <Chip size="small" color="warning" label="Ưu tiên vừa" />
                        ) : (
                          <Chip size="small" color="default" label="Ưu tiên thấp" />
                        )}
                        {item.recommended && !checked && (
                          <Chip size="small" color="primary" label="Đề xuất tiếp theo" />
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ textDecoration: checked ? "line-through" : "none" }}>
                        {item.description}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}

      <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2 }}>
        {(bullets || []).map((line) => (
          <Typography key={line} component="li" variant="body2" color="text.secondary">
            {line}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}
