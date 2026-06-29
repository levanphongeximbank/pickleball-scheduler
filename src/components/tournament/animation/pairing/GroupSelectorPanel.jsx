import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { getGroupTheme } from "../animationConfig.js";
import { shuffleVisualOrder } from "../animationUtils.js";

export default function GroupSelectorPanel({
  groups = [],
  activeGroupId = null,
  activeGroupEntries = [],
  selectedEntryId = null,
  shuffling = false,
  onSelectGroup,
  mobile = false,
}) {
  const [entryOrder, setEntryOrder] = useState([]);

  const entryIds = useMemo(
    () => activeGroupEntries.map((entry) => String(entry.id)),
    [activeGroupEntries]
  );

  useEffect(() => {
    setEntryOrder(shuffleVisualOrder(entryIds));
  }, [entryIds, activeGroupId]);

  useEffect(() => {
    if (!shuffling) {
      return undefined;
    }

    const timer = setInterval(() => {
      setEntryOrder(shuffleVisualOrder(entryIds));
    }, 4800);

    return () => clearInterval(timer);
  }, [shuffling, entryIds]);

  const entryById = useMemo(
    () => Object.fromEntries(activeGroupEntries.map((entry) => [String(entry.id), entry])),
    [activeGroupEntries]
  );

  const displayEntries = entryOrder.map((id) => entryById[id]).filter(Boolean);

  return (
    <Stack spacing={1.25} sx={{ height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
          Các bảng
        </Typography>
        <Stack spacing={0.75}>
          {groups.map((group) => {
            const theme = getGroupTheme(group.label);
            const active = String(group.id) === String(activeGroupId);
            const teamCount = group.entryIds?.length || group.entries?.length || 0;
            const matchCount = group.matches?.length || group.matchCount || 0;

            return (
              <Box
                key={group.id}
                className={`pairing-group-tab${active ? " pairing-group-tab--active" : ""}`}
                onClick={() => onSelectGroup?.(group.id)}
                sx={{
                  p: 1,
                  borderRadius: 1.5,
                  border: "1px solid",
                  borderColor: active ? theme.main : "divider",
                  bgcolor: active ? theme.light : "background.paper",
                  cursor: onSelectGroup ? "pointer" : "default",
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={active ? 700 : 600}>
                    {group.name || `Bảng ${group.label}`}
                  </Typography>
                  <Chip
                    size="small"
                    label={`${teamCount} đội${matchCount ? ` • ${matchCount} trận` : ""}`}
                    sx={{ bgcolor: active ? "background.paper" : undefined }}
                  />
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Paper>

      {!mobile && (
        <Paper variant="outlined" sx={{ p: 1.25, flex: 1 }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5 }}>
            Đội trong bảng hiện tại
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {shuffling ? "Đang xáo trộn thứ tự hiển thị" : "Danh sách đội/VDV"}
          </Typography>
          <Stack spacing={0.75} sx={{ maxHeight: 280, overflow: "auto" }}>
            {displayEntries.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                Chưa có đội trong bảng
              </Typography>
            ) : (
              displayEntries.map((entry) => {
                const selected = String(entry.id) === String(selectedEntryId);

                return (
                  <Box
                    key={entry.id}
                    className={`pairing-entry-chip${selected ? " pairing-entry-chip--selected" : ""}`}
                    sx={{
                      p: 1,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: selected ? "#f9a825" : "divider",
                      bgcolor: selected ? "#fffde7" : "background.paper",
                    }}
                  >
                    <Typography variant="body2" fontWeight={selected ? 700 : 500} noWrap title={entry.name}>
                      {entry.name}
                    </Typography>
                    {entry.seed != null && entry.seed !== "" && (
                      <Typography variant="caption" color="text.secondary">
                        Seed {entry.seed}
                      </Typography>
                    )}
                  </Box>
                );
              })
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
