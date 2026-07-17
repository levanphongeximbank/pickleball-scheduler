import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { TEAM_GROUP_SEEDING } from "../../../features/team-tournament/constants.js";
import {
  GROUP_REDRAW_DESTRUCTIVE_MESSAGE,
  hasDependentMatchupsOrSchedule,
  isGroupDivisionEditable,
  listGroupDivisionOptions,
  MIN_TEAMS_FOR_EXPLICIT_GROUPS,
  recommendGroupSizes,
} from "../../../features/team-tournament/engines/teamGroupDivisionPolicy.js";
import { describeGroupSplit } from "../../../features/team-tournament/engines/teamRoundRobinScheduleEngine.js";
import { summarizeSeededGroupBalance } from "../../../features/team-tournament/engines/teamAutoDrawEngine.js";
import {
  AI_DRAW_ALGORITHM_VERSION,
  AI_DRAW_CHANGE_REASON,
  attachAiDrawPublishMetadata,
  createAiDrawRandomSeed,
  getPublishedAiDrawState,
  snapshotGroupDrawResult,
} from "../../../features/team-tournament/engines/aiDrawSeedAudit.js";
import { runTeamDrawWithCanonicalAdapter } from "../../../features/competition-core/draw/adapters/teamDrawAdapter.js";
import { clearTeamGroups } from "../../../features/team-tournament/engines/teamTournamentEngine.js";
import { buildGroupDivisionPreviewPackage } from "../../../features/team-tournament/setup/buildGroupDivisionPreview.js";
import {
  COMPETITION_CLASS,
  PRIVATE_PAIRING_OPERATION,
  prepareLivePrivatePairingOptions,
  createSeededRng,
} from "../../../features/private-pairing-rules/index.js";
import ShowcaseGroupReveal from "../../../features/team-tournament/showcase/ShowcaseGroupReveal.jsx";
import { buildReplayShowcaseSession } from "../../../features/team-tournament/showcase/showcaseDrawSession.js";
import { prefersReducedMotion } from "../../../features/team-tournament/showcase/showcaseStyles.js";

const GROUP_SEEDING_OPTIONS = [
  {
    value: TEAM_GROUP_SEEDING.OFF,
    label: "Tắt hạt giống",
    description: "Chia bảng ngẫu nhiên, không xếp hạng hạt giống.",
  },
  {
    value: TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL,
    label: "Ace + tổng điểm",
    description: "Ưu tiên VĐV mạnh nhất trong đội, tie-break theo tổng điểm đội.",
  },
  {
    value: TEAM_GROUP_SEEDING.AVG_LEVEL,
    label: "Trung bình đội",
    description: "Xếp hạt giống theo trung bình trình độ cả đội (chế độ cũ).",
  },
];

function getSeedingLabel(mode) {
  return GROUP_SEEDING_OPTIONS.find((option) => option.value === mode)?.label || mode;
}

export default function TeamGroupDivisionPanel({
  teamData,
  clubPlayers = [],
  canManage = false,
  clubId = "",
  tournamentId = "",
  tournament = null,
  tenantId = null,
  clubFromQuery = null,
  activeClubId = null,
  competitionClass = COMPETITION_CLASS.INTERNAL,
  onSave,
  onError,
  onMessage,
  onContinueSetup,
}) {
  const teams = teamData?.teams || [];
  const groups = teamData?.groups || [];
  const seedingMode = teamData?.settings?.groupSeeding || TEAM_GROUP_SEEDING.AVG_LEVEL;
  const seedingEnabled = seedingMode !== TEAM_GROUP_SEEDING.OFF;
  const useTopPlayerMode = seedingMode === TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL;
  const divisionOptions = useMemo(() => listGroupDivisionOptions(teams.length), [teams.length]);
  const defaultGroupCount =
    divisionOptions[0]?.groupCount || Math.max(2, groups.length || 2);
  const [groupCount, setGroupCount] = useState(defaultGroupCount);
  const [preview, setPreview] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [groupRevealOpen, setGroupRevealOpen] = useState(false);
  const [groupRevealSession, setGroupRevealSession] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const recommendedSizes = recommendGroupSizes(teams.length);
  const recommendedLabel = describeGroupSplit(teams.length);
  const balance = groups.length
    ? summarizeSeededGroupBalance(groups, teams, { seedingMode })
    : null;
  const selectedSeedingOption =
    GROUP_SEEDING_OPTIONS.find((option) => option.value === seedingMode) ||
    GROUP_SEEDING_OPTIONS[2];
  const editable = isGroupDivisionEditable(teamData, { canManage });
  const teamsInsufficient = teams.length < MIN_TEAMS_FOR_EXPLICIT_GROUPS;

  if (teamsInsufficient && !canManage) {
    return null;
  }

  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const teamById = new Map(teams.map((team) => [team.id, team]));

  async function persistTeamData(nextTeamData, message, options = {}) {
    const ok = await onSave?.(nextTeamData, options);
    if (ok === false) {
      return false;
    }
    if (message) {
      onMessage?.(message);
    }
    return true;
  }

  async function handleSeedingModeChange(event) {
    if (!editable) {
      return;
    }

    const nextMode = event.target.value;
    const nextTeamData = {
      ...teamData,
      settings: {
        ...teamData.settings,
        groupSeeding: nextMode,
      },
    };

    const ok = await persistTeamData(nextTeamData);
    if (!ok) {
      return;
    }

    if (groups.length > 0 && nextMode !== seedingMode) {
      onMessage?.(
        `Đã đổi chế độ hạt giống sang "${getSeedingLabel(nextMode)}". Chia lại bảng để áp dụng.`
      );
    }
  }

  async function resolveCanonicalPairing() {
    return prepareLivePrivatePairingOptions({
      tournament: tournament || null,
      clubId: clubId || tournament?.clubId || null,
      clubFromQuery,
      activeClubId,
      tournamentId: tournamentId || tournament?.id || null,
      tenantId:
        tenantId ||
        tournament?.tenantId ||
        teamData?.settings?.tenantId ||
        null,
      eventId: tournamentId ? `event-${tournamentId}` : null,
      competitionClass,
      allowedByPublishedRules: competitionClass === COMPETITION_CLASS.OFFICIAL ? false : undefined,
    });
  }

  async function runGroupAssignment(options = {}) {
    const prepared = await resolveCanonicalPairing();

    if (!prepared.ok) {
      onError?.(prepared.error?.message || "Không chia được bảng theo quy tắc riêng.");
      return null;
    }

    const rulesVersion = prepared.rulesVersion || prepared.pairingOptions?.rulesVersion || "";
    const published = getPublishedAiDrawState(teamData, PRIVATE_PAIRING_OPERATION.GROUP_DRAW);
    const randomSeed =
      options.randomSeed || createAiDrawRandomSeed(published?.randomSeed);
    const seededRng = createSeededRng(randomSeed);

    const {
      ok,
      teamData: next,
      balance: nextBalance,
      warnings = [],
      privatePairingError,
      scoreBreakdown,
    } = runTeamDrawWithCanonicalAdapter({
      teamData,
      players: clubPlayers,
      seedingMode,
      groupCount: options.groupCount,
      randomFn: seededRng,
      seed: randomSeed,
      privatePairingRules: prepared.pairingOptions?.privatePairingRules || [],
      competitionClass:
        prepared.pairingOptions?.competitionClass || competitionClass,
      clubId: clubId || null,
      tournamentId: tournamentId || null,
      eventId: tournamentId ? `event-${tournamentId}` : null,
    });

    if (ok === false || privatePairingError) {
      onError?.(
        privatePairingError?.message || "Không chia được bảng theo quy tắc riêng."
      );
      return null;
    }

    if (!next?.groups?.length) {
      onError?.("Không chia được bảng.");
      return null;
    }

    if (warnings.length) {
      onMessage?.(warnings.join(" "));
    }

    return {
      next,
      nextBalance,
      rulesVersion,
      randomSeed,
      algorithmVersion: AI_DRAW_ALGORITHM_VERSION,
      scoreBreakdown: scoreBreakdown || null,
    };
  }

  async function buildPreviewPackage(nextTeamData, nextBalance, modeLabel, rulesVersion, extra = {}) {
    return buildGroupDivisionPreviewPackage({
      nextTeamData,
      nextBalance,
      seedingMode,
      modeLabel,
      rulesVersion,
      randomSeed: extra.randomSeed,
      algorithmVersion: extra.algorithmVersion,
      scoreBreakdown: extra.scoreBreakdown,
    });
  }

  async function handlePreview(options = {}) {
    if (!editable || teamsInsufficient) {
      return;
    }
    const resolvedCount = Number(options.groupCount) || groupCount;
    if (resolvedCount < 2) {
      onError?.("Cần ít nhất 2 bảng.");
      return;
    }
    if (resolvedCount > teams.length) {
      onError?.("Số bảng không được lớn hơn số đội.");
      return;
    }

    setPreviewBusy(true);
    try {
      const result = await runGroupAssignment({ groupCount: resolvedCount });
      if (!result) {
        return;
      }
      const modeLabel = options.auto
        ? seedingEnabled
          ? "auto-seeded"
          : "auto-random"
        : "manual";
      const packagePreview = await buildPreviewPackage(
        result.next,
        result.nextBalance,
        modeLabel,
        result.rulesVersion,
        {
          randomSeed: result.randomSeed,
          algorithmVersion: result.algorithmVersion,
          scoreBreakdown: result.scoreBreakdown,
        }
      );
      setPreview(packagePreview);

      const revealSession = buildReplayShowcaseSession({
        teamData: result.next,
        players: clubPlayers,
        rulesVersion: result.rulesVersion,
        seedingMode,
        engineVersion: packagePreview.engineVersion,
      });
      setGroupRevealSession(revealSession);
      setReducedMotion(prefersReducedMotion());
      setGroupRevealOpen(true);
      onMessage?.("Xem trước chia bảng — chưa ghi database. Bấm Xác nhận lưu để lưu.");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function commitPreview(forceDestructive = false) {
    if (!preview?.nextTeamData || !editable) {
      return;
    }

    const dependent = hasDependentMatchupsOrSchedule(teamData);
    if (dependent && !forceDestructive) {
      setPendingConfirm({ type: "replace" });
      setDestructiveOpen(true);
      return;
    }

    // Preview and confirmed save must use the same canonical rules version.
    const rulesVersion = String(preview.rulesVersion || "").trim();
    if (!rulesVersion) {
      onError?.(
        "Thiếu rulesVersion cho lệnh pairing. Xem trước lại để lấy phiên bản quy tắc canonical trước khi lưu."
      );
      return;
    }

    setConfirmBusy(true);
    try {
      let next = {
        ...preview.nextTeamData,
      };

      if (dependent) {
        // Clear dependent matchups/schedule locally; persist cascade as:
        // 1) matchups.replace (empty) when needed, then 2) groups.replace.
        next = {
          ...next,
          matchups: [],
          schedule: undefined,
        };

        if ((teamData.matchups || []).length > 0) {
          const cleared = {
            ...teamData,
            matchups: [],
            schedule: undefined,
            groups: teamData.groups || [],
          };
          const clearedOk = await persistTeamData(cleared, null, {
            confirmDestructive: true,
            rulesVersion,
          });
          if (!clearedOk) {
            // Keep preview visible — no fake success, no clear.
            return;
          }
        }
      }

      const published = getPublishedAiDrawState(
        teamData,
        PRIVATE_PAIRING_OPERATION.GROUP_DRAW
      );
      const randomSeed =
        preview.randomSeed || createAiDrawRandomSeed(published?.randomSeed);
      const nextWithMeta = attachAiDrawPublishMetadata(next, {
        operation: PRIVATE_PAIRING_OPERATION.GROUP_DRAW,
        reason: published?.randomSeed
          ? AI_DRAW_CHANGE_REASON.USER_REARRANGE
          : AI_DRAW_CHANGE_REASON.INITIAL_DRAW,
        randomSeed,
        previousResult: snapshotGroupDrawResult(teamData?.groups || []),
        nextResult: snapshotGroupDrawResult(next?.groups || []),
        scoreBreakdown: preview.scoreBreakdown || null,
        algorithmVersion: preview.algorithmVersion || AI_DRAW_ALGORITHM_VERSION,
        rulesVersion,
      });

      const ok = await persistTeamData(
        {
          ...nextWithMeta,
          // Keep matchups empty after cascade clear.
          matchups: dependent ? [] : nextWithMeta.matchups || teamData.matchups || [],
        },
        `Đã lưu chia bảng (${preview.rows.length} bảng).`,
        { confirmDestructive: dependent, rulesVersion }
      );
      if (!ok) {
        // Keep preview visible on RPC/read-back failure.
        return;
      }
      setPreview(null);
      setDestructiveOpen(false);
      setPendingConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handleClearGroups() {
    if (!editable) {
      return;
    }
    if (hasDependentMatchupsOrSchedule(teamData)) {
      setPendingConfirm({ type: "clear" });
      setDestructiveOpen(true);
      return;
    }
    const prepared = await resolveCanonicalPairing();
    if (!prepared.ok) {
      onError?.(prepared.error?.message || "Không xóa được chia bảng theo quy tắc riêng.");
      return;
    }
    const rulesVersion = prepared.rulesVersion || prepared.pairingOptions?.rulesVersion || "";
    setPreview(null);
    await persistTeamData(clearTeamGroups(teamData), "Đã xóa chia bảng.", { rulesVersion });
  }

  async function handleDestructiveConfirm() {
    if (pendingConfirm?.type === "clear") {
      setDestructiveOpen(false);
      const prepared = await resolveCanonicalPairing();
      if (!prepared.ok) {
        onError?.(prepared.error?.message || "Không xóa được chia bảng theo quy tắc riêng.");
        setPendingConfirm(null);
        return;
      }
      const rulesVersion = prepared.rulesVersion || prepared.pairingOptions?.rulesVersion || "";
      setConfirmBusy(true);
      try {
        if ((teamData.matchups || []).length > 0) {
          const clearedMatchups = {
            ...teamData,
            matchups: [],
            schedule: undefined,
          };
          const okClear = await persistTeamData(clearedMatchups, null, {
            confirmDestructive: true,
            rulesVersion,
          });
          if (!okClear) {
            return;
          }
        }
        await persistTeamData(clearTeamGroups({ ...teamData, matchups: [] }), "Đã xóa chia bảng.", {
          rulesVersion,
        });
        setPreview(null);
      } finally {
        setConfirmBusy(false);
        setPendingConfirm(null);
      }
      return;
    }
    await commitPreview(true);
  }

  function handleDestructiveCancel() {
    setDestructiveOpen(false);
    setPendingConfirm(null);
  }

  function formatTeamSeedLine(teamId) {
    const team = teamById.get(teamId);
    if (!team || !seedingEnabled || !team.seed) {
      return teamNameById.get(teamId) || teamId;
    }

    if (useTopPlayerMode && team.topPlayerRating > 0) {
      return `${teamNameById.get(teamId) || teamId} (Seed ${team.seed} · Ace ${team.topPlayerRating} · Tổng ${team.totalRating || "—"})`;
    }

    return `${teamNameById.get(teamId) || teamId} (Seed ${team.seed} · TB ${team.avgLevel || "—"})`;
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <Typography variant="h6" fontWeight={700}>
            Chia bảng đấu
          </Typography>
          <Chip size="small" label={`${teams.length} đội`} />
          {groups.length > 0 ? (
            <Chip size="small" color="success" label={`${groups.length} bảng`} />
          ) : null}
        </Stack>

        {teamsInsufficient ? (
          <Alert severity="warning">
            Cần ít nhất {MIN_TEAMS_FOR_EXPLICIT_GROUPS} đội để chia bảng. Hiện có {teams.length} đội.
          </Alert>
        ) : (
          <Alert severity="info">
            Chia bảng là bước bắt buộc trước khi tạo lịch (không tự chia khi tạo lịch).
            {recommendedLabel ? ` Gợi ý mặc định: ${recommendedLabel}.` : ""}
            {" "}
            Với 8 đội có thể chọn 2 bảng × 4 hoặc 4 bảng × 2.
            {" "}
            {selectedSeedingOption.description}
          </Alert>
        )}

        {canManage ? (
          <FormControl fullWidth size="small" sx={{ maxWidth: 420 }} disabled={!editable || teamsInsufficient}>
            <InputLabel>Chế độ hạt giống</InputLabel>
            <Select
              label="Chế độ hạt giống"
              value={seedingMode}
              onChange={handleSeedingModeChange}
            >
              {GROUP_SEEDING_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Chip size="small" variant="outlined" label={`Hạt giống: ${getSeedingLabel(seedingMode)}`} />
        )}

        {canManage ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              select
              label="Số bảng"
              value={groupCount}
              disabled={!editable || teamsInsufficient}
              onChange={(event) => setGroupCount(Number(event.target.value) || 2)}
              sx={{ width: { xs: "100%", sm: 180 } }}
            >
              {(divisionOptions.length
                ? divisionOptions
                : [{ groupCount: 2, label: "2 bảng" }, { groupCount: 4, label: "4 bảng" }]
              ).map((option) => (
                <MenuItem key={option.groupCount} value={option.groupCount}>
                  {option.label}
                </MenuItem>
              ))}
              {!divisionOptions.some((option) => option.groupCount === groupCount) ? (
                <MenuItem value={groupCount}>{groupCount} bảng</MenuItem>
              ) : null}
            </TextField>
            <Button
              variant="contained"
              disabled={!editable || teamsInsufficient || previewBusy}
              onClick={() => handlePreview({ auto: true, groupCount: recommendedSizes?.length || groupCount })}
            >
              Chia bảng tự động
            </Button>
            <Button
              variant="outlined"
              disabled={!editable || teamsInsufficient || previewBusy}
              onClick={() => handlePreview({ auto: false, groupCount })}
            >
              Chia bảng thủ công
            </Button>
            <Button
              variant="outlined"
              disabled={!editable || teamsInsufficient || previewBusy}
              onClick={() => handlePreview({ auto: false, groupCount })}
            >
              Xem trước
            </Button>
            {preview ? (
              <Button
                variant="contained"
                color="success"
                disabled={!editable || confirmBusy}
                onClick={() => commitPreview(false)}
              >
                Xác nhận lưu
              </Button>
            ) : null}
            {groups.length > 0 ? (
              <>
                <Button
                  variant="outlined"
                  disabled={!editable || previewBusy}
                  onClick={() => handlePreview({ auto: true, groupCount })}
                >
                  Chia lại bảng
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  disabled={!editable}
                  onClick={handleClearGroups}
                >
                  Xóa chia bảng
                </Button>
              </>
            ) : null}
            {onContinueSetup ? (
              <Button variant="text" onClick={onContinueSetup}>
                Tiếp tục thiết lập
              </Button>
            ) : null}
          </Stack>
        ) : null}

        {preview ? (
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover" }}>
            <Stack spacing={1.25}>
              <Typography fontWeight={700}>Xem trước chia bảng (chưa ghi DB)</Typography>
              {preview.rows.map((row) => (
                <Paper key={row.id || row.name} variant="outlined" sx={{ p: 1 }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography fontWeight={600}>{row.name}</Typography>
                    <Chip size="small" label={`${row.teamCount} đội · TB ${row.avgRating || "—"}`} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {row.teamNames.join(" · ") || "Chưa có đội"}
                  </Typography>
                </Paper>
              ))}
              <Alert severity={preview.diagnostics.complete ? "success" : "warning"}>
                {preview.diagnostics.complete
                  ? "Không thiếu / trùng đội."
                  : `Thiếu: ${preview.diagnostics.missingTeamIds.length}, trùng: ${preview.diagnostics.duplicateTeamIds.length}.`}
                {" "}
                {preview.balancingExplanation}
              </Alert>
              <Typography variant="caption" color="text.secondary" component="div">
                engineVersion: {preview.engineVersion}
                <br />
                rulesVersion: {preview.rulesVersion || "—"}
                <br />
                engineInputHash: {preview.engineInputHash}
                <br />
                engineOutputHash: {preview.engineOutputHash}
              </Typography>
            </Stack>
          </Paper>
        ) : null}

        {balance?.groups?.length && !preview ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {balance.groups.map((group) => (
              <Chip
                key={group.groupId}
                size="small"
                variant="outlined"
                label={
                  useTopPlayerMode
                    ? `${group.groupName}: Ace TB ${group.topAvg}`
                    : `${group.groupName}: TB ${group.avgLevel}`
                }
              />
            ))}
            <Chip
              size="small"
              color={balance.balanced ? "success" : "warning"}
              label={balance.balanced ? "Cân bằng" : `Lệch ${balance.spread}`}
            />
          </Stack>
        ) : null}

        {groups.length === 0 && !preview ? (
          <Typography variant="body2" color="text.secondary">
            Chưa chia bảng. Chọn số bảng, xem trước, rồi xác nhận lưu.
          </Typography>
        ) : null}

        {groups.length > 0 && !preview ? (
          <Stack spacing={1}>
            {groups.map((group) => (
              <Paper key={group.id} variant="outlined" sx={{ p: 1.25 }}>
                <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
                  <Typography fontWeight="bold">{group.name}</Typography>
                  <Chip size="small" label={`${group.teamIds.length} đội`} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {group.teamIds.map((teamId) => formatTeamSeedLine(teamId)).join(" · ") ||
                    "Chưa có đội"}
                </Typography>
              </Paper>
            ))}
          </Stack>
        ) : null}
      </Stack>

      <Dialog open={destructiveOpen} onClose={handleDestructiveCancel} fullWidth maxWidth="xs">
        <DialogTitle>Xác nhận chia lại bảng</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            {GROUP_REDRAW_DESTRUCTIVE_MESSAGE}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDestructiveCancel} disabled={confirmBusy}>
            Huỷ
          </Button>
          <Button
            color="warning"
            variant="contained"
            onClick={handleDestructiveConfirm}
            disabled={confirmBusy}
          >
            Tiếp tục
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={groupRevealOpen && Boolean(groupRevealSession)}
        fullScreen
        disableEscapeKeyDown
        onClose={() => {}}
        PaperProps={{
          sx: {
            bgcolor: "#07111f",
            color: "#f4f7fb",
            backgroundImage:
              "radial-gradient(ellipse at top, rgba(46, 204, 113, 0.12), transparent 55%), linear-gradient(180deg, #0a1628 0%, #07111f 45%, #050b14 100%)",
          },
        }}
      >
        <DialogContent
          sx={{
            maxWidth: 1200,
            mx: "auto",
            width: "100%",
            py: { xs: 3, md: 5 },
            px: { xs: 2, md: 4 },
          }}
        >
          <ShowcaseGroupReveal
            session={groupRevealSession}
            seedingMode={groupRevealSession?.groupSession?.seedingMode || seedingMode}
            engineVersion={groupRevealSession?.engineVersion}
            rulesVersion={groupRevealSession?.rulesVersion}
            reducedMotion={reducedMotion}
            continueLabel="Xác nhận lưu"
            closeLabel="Đóng xem trước"
            onContinue={() => {
              setGroupRevealOpen(false);
              commitPreview(false);
            }}
            onClose={() => setGroupRevealOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Paper>
  );
}
