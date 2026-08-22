/**
 * Official Content → Thiết kế thể thức — exact approved mockup adoption (UI only).
 * 3-column desktop: left 7-group nav · center workspace · right summary.
 * Draft editing only. Persistence via parent Save → event.competitionRules.
 */

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Grid,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_OPTIONS,
  OFFICIAL_MODE,
} from "../../../../models/tournament/constants.js";
import {
  OFFICIAL_MATCH_FORMAT,
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_SCORING_METHOD,
  BEST_OF_3_OPERATIONAL,
  SIDEOUT_OPERATIONAL,
} from "../../../individual-tournament/engines/officialTournamentSettingsEngine.js";
import PermissionGate from "../../../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../../../auth/permissions.js";
import {
  TOURNAMENT_COLOR,
  TOURNAMENT_ELEVATION,
  outlinedActionSx,
  primaryActionSx,
} from "../visual/tournamentExperienceTokens.js";
import {
  applyFormatSettingsSectionSearchParams,
  readFormatSettingsSectionQuery,
  resolveFormatSettingsSection,
} from "./formatSettingsSectionNavigation.js";

const STAGE_ROWS = [
  { key: "GROUP", label: "Vòng bảng" },
  { key: "ROUND_OF_16", label: "Vòng 16" },
  { key: "QUARTERFINAL", label: "Tứ kết" },
  { key: "SEMIFINAL", label: "Bán kết" },
  { key: "FINAL", label: "Chung kết" },
];

const NAV_GROUPS = [
  {
    id: "content-registration",
    number: 1,
    title: "Nội dung & đăng ký",
    description: "Tên, loại, sức chứa, trình độ, seeding",
  },
  {
    id: "structure",
    number: 2,
    title: "Cấu trúc thi đấu",
    description: "Vòng bảng, suất đi tiếp, knockout",
  },
  {
    id: "match-rules",
    number: 3,
    title: "Luật trận đấu & đổi bên",
    description: "Tính điểm, thể thức trận, đổi bên theo giai đoạn",
  },
  {
    id: "ranking",
    number: 4,
    title: "Xếp hạng & đi tiếp",
    description: "Tie-break trong bảng và wildcard liên bảng",
  },
  {
    id: "ops",
    number: 5,
    title: "Vận hành trận",
    description: "WO, RET, đến trễ, rút lui, thay VĐV, check-in",
  },
  {
    id: "ops-infra",
    number: 6,
    title: "Sân, trọng tài, lịch & công bố",
    description: "Yêu cầu sân, trọng tài, lịch, công bố",
  },
];

const cardSx = {
  bgcolor: TOURNAMENT_COLOR.cardBg,
  border: `1px solid ${TOURNAMENT_COLOR.divider}`,
  borderRadius: "8px",
  boxShadow: TOURNAMENT_ELEVATION.card,
  p: 1.5,
};

function StatusBadge({ label, tone = "muted" }) {
  const color =
    tone === "ok"
      ? TOURNAMENT_COLOR.success
      : tone === "warn"
        ? TOURNAMENT_COLOR.warning
        : tone === "primary"
          ? TOURNAMENT_COLOR.primary
          : TOURNAMENT_COLOR.textMuted;
  const bg =
    tone === "ok"
      ? TOURNAMENT_COLOR.successSurface
      : tone === "warn"
        ? TOURNAMENT_COLOR.warningSurface
        : tone === "primary"
          ? TOURNAMENT_COLOR.primarySurface
          : "#F1F5F9";
  return (
    <Chip
      size="small"
      label={label}
      sx={{
        height: 22,
        fontSize: 11,
        fontWeight: 700,
        bgcolor: bg,
        color,
        border: `1px solid ${color}33`,
      }}
    />
  );
}

function WorkspaceCard({ title, children, action }) {
  return (
    <Box sx={{ ...cardSx, mb: 1.25 }} data-testid={title ? undefined : undefined}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 14, color: TOURNAMENT_COLOR.text }}>
          {title}
        </Typography>
        {action || null}
      </Stack>
      {children}
    </Box>
  );
}

function CompactField({ label, children, sx }) {
  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: TOURNAMENT_COLOR.textMuted, mb: 0.35 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function InfoRow({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ py: 0.35 }}>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: TOURNAMENT_COLOR.text, textAlign: "right" }}>
        {value}
      </Typography>
    </Stack>
  );
}

function ReadinessRing({ percent }) {
  const size = 72;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, percent)) / 100) * c;
  const color =
    percent >= 100
      ? TOURNAMENT_COLOR.success
      : percent >= 60
        ? TOURNAMENT_COLOR.primary
        : TOURNAMENT_COLOR.warning;
  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TOURNAMENT_COLOR.divider}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <Typography
        sx={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: 16,
          color: TOURNAMENT_COLOR.text,
        }}
      >
        {percent}%
      </Typography>
    </Box>
  );
}

function deriveEventKind(eventType) {
  const raw = String(eventType || "");
  if (raw.includes("single")) return "Đơn";
  if (raw.includes("double") || raw.includes("mixed") || raw.includes("open")) return "Đôi";
  return "—";
}

function deriveGender(eventType) {
  const raw = String(eventType || "");
  if (raw.startsWith("men")) return "Nam";
  if (raw.startsWith("women")) return "Nữ";
  if (raw.includes("mixed")) return "Nam nữ";
  if (raw.includes("open")) return "Mở";
  return "—";
}

function formatLevelRange(eligibility) {
  const min = eligibility?.minLevel;
  const max = eligibility?.maxLevel;
  if (min == null && max == null) return "Chưa đặt";
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `≥ ${min}`;
  return `≤ ${max}`;
}

function formatRatingRange(eligibility) {
  const min = eligibility?.minRating;
  const max = eligibility?.maxRating;
  if (min == null && max == null) return "Chưa đặt";
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `≥ ${min}`;
  return `≤ ${max}`;
}

function seedingLabel(policy) {
  const map = {
    NONE: "Không seed",
    MANUAL: "Thủ công (chưa sẵn sàng)",
    RANKING: "Theo xếp hạng (chưa sẵn sàng)",
    RATING: "Theo rating (chưa sẵn sàng)",
  };
  return map[policy] || policy || "Không seed";
}

function registrationLabel(mode) {
  return mode === OFFICIAL_REGISTRATION_MODE.PAIR ? "Cặp cố định" : "Cá nhân";
}

function effectiveStagePoints(draft, stageKey) {
  const stage = draft?.stageOverrides?.[stageKey];
  if (stage && stage.inheritBase === false && stage.targetPoints != null) {
    return Number(stage.targetPoints);
  }
  return Number(draft?.matchScoring?.targetPoints) || 11;
}

function stageUsesBase(draft, stageKey) {
  const stage = draft?.stageOverrides?.[stageKey];
  return !stage || stage.inheritBase !== false;
}

function computeUiReadiness(draft, scoringCaps) {
  const checks = [];
  checks.push(Boolean(draft?.registrationMode));
  checks.push(Number(draft?.groupStage?.groupCount) >= 1);
  checks.push(Number(draft?.qualification?.directQualifiersPerGroup) >= 1);
  checks.push(Boolean(draft?.matchScoring?.scoringMethod));
  checks.push(Boolean(draft?.matchScoring?.matchFormat));
  checks.push(Number(draft?.matchScoring?.targetPoints) > 0);
  checks.push(draft?.matchScoring?.winCondition?.winByEnabled !== undefined);
  checks.push(Boolean(draft?.knockout?.pairingPolicy));
  checks.push(Boolean(draft?.refereeRequirement?.byStage?.FINAL));
  checks.push(Boolean(draft?.publication?.resultsPublicationPolicy));
  // Deferred / unavailable capabilities count as incomplete in presentation only
  if (!BEST_OF_3_OPERATIONAL || scoringCaps?.bestOf3 !== true) {
    checks.push(false);
  } else {
    checks.push(true);
  }
  if (Number(draft?.qualification?.wildcardSlots) > 0) {
    checks.push(false); // wildcard execution fail-closed
  } else {
    checks.push(true);
  }
  const done = checks.filter(Boolean).length;
  const percent = Math.round((done / checks.length) * 100);
  return { percent, incomplete: percent < 100, missingCount: checks.length - done };
}

const inactiveControlSx = {
  "& .MuiInputBase-root": {
    bgcolor: "#F1F5F9",
  },
  "& .MuiInputBase-input.Mui-disabled": {
    WebkitTextFillColor: TOURNAMENT_COLOR.disabled,
  },
  "& .MuiSelect-select.Mui-disabled": {
    WebkitTextFillColor: TOURNAMENT_COLOR.disabled,
  },
};

function StageRuleTable({ draft, disabled, updateStage, resetAllStages, scoringCaps }) {
  const base = draft?.matchScoring || {};
  const win = base.winCondition || {};
  const baseChange = base.changeEnd || {};
  const pointCapUnsupported = scoringCaps.pointCap !== true;
  const changeUnsupported = scoringCaps.changeEnd !== true;

  const cellSelectSx = {
    width: "100%",
    "& .MuiInputBase-root": { fontSize: 11.5, bgcolor: "#fff" },
    "& .MuiSelect-select": { py: 0.4, pr: "24px !important" },
    "& .MuiInputBase-input": { py: 0.4, px: 0.5 },
  };

  return (
    <Box>
      <Box
        sx={{
          // 10 columns: controlled scroll below xl; prefer fit at 1920 (xl).
          overflowX: { xs: "auto", xl: "visible" },
          border: `1px solid ${TOURNAMENT_COLOR.divider}`,
          borderRadius: "8px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Box
          component="table"
          sx={{
            width: "100%",
            minWidth: { xs: 860, xl: 0 },
            tableLayout: "fixed",
            borderCollapse: "collapse",
            "& th, & td": {
              borderBottom: `1px solid ${TOURNAMENT_COLOR.divider}`,
              px: { xs: 0.4, xl: 0.35 },
              py: 0.55,
              textAlign: "left",
              verticalAlign: "middle",
              fontSize: 11.5,
            },
            "& th": {
              bgcolor: "#F8FAFC",
              fontWeight: 700,
              color: TOURNAMENT_COLOR.textMuted,
              whiteSpace: "normal",
              lineHeight: 1.15,
              fontSize: 10.5,
            },
          }}
        >
          <colgroup>
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "16%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Giai đoạn</th>
              <th>Cách tính điểm</th>
              <th>Thể thức</th>
              <th>Điểm thắng</th>
              <th>Win-by</th>
              <th>Cách biệt</th>
              <th>Điểm trần</th>
              <th>Đổi bên</th>
              <th>Điểm đổi bên</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {STAGE_ROWS.map((row) => {
              const inherit = stageUsesBase(draft, row.key);
              const stage = draft?.stageOverrides?.[row.key] || {};
              if (inherit) {
                return (
                  <tr key={row.key}>
                    <td>
                      <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{row.label}</Typography>
                    </td>
                    <td colSpan={8}>
                      <StatusBadge label="Dùng rule cơ sở" tone="ok" />
                    </td>
                    <td>
                      <Button
                        size="small"
                        disabled={disabled}
                        onClick={() => updateStage(row.key, "inheritBase", false)}
                        sx={{ fontSize: 11, textTransform: "none", minWidth: 0, px: 0.5 }}
                      >
                        Ghi đè
                      </Button>
                    </td>
                  </tr>
                );
              }
              const winByOn =
                (stage.winCondition?.winByEnabled ?? win.winByEnabled) !== false;
              const pointCapOn =
                (stage.winCondition?.pointCapEnabled ?? win.pointCapEnabled) === true;
              const changeOn =
                (stage.changeEnd?.changeEndsEnabled ?? baseChange.changeEndsEnabled) === true;
              return (
                <tr key={row.key}>
                  <td>
                    <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{row.label}</Typography>
                  </td>
                  <td>
                    <TextField
                      size="small"
                      select
                      fullWidth
                      value={stage.scoringMethod || base.scoringMethod || OFFICIAL_SCORING_METHOD.RALLY}
                      disabled={disabled}
                      onChange={(e) => updateStage(row.key, "scoringMethod", e.target.value)}
                      sx={cellSelectSx}
                    >
                      <MenuItem value={OFFICIAL_SCORING_METHOD.RALLY}>Rally</MenuItem>
                      <MenuItem
                        value={OFFICIAL_SCORING_METHOD.SIDE_OUT}
                        disabled={!SIDEOUT_OPERATIONAL || scoringCaps.sideOut !== true}
                      >
                        Side-out
                      </MenuItem>
                    </TextField>
                  </td>
                  <td>
                    <TextField
                      size="small"
                      select
                      fullWidth
                      value={stage.matchFormat || base.matchFormat || OFFICIAL_MATCH_FORMAT.BEST_OF_1}
                      disabled={disabled}
                      onChange={(e) => updateStage(row.key, "matchFormat", e.target.value)}
                      sx={cellSelectSx}
                    >
                      <MenuItem value={OFFICIAL_MATCH_FORMAT.BEST_OF_1}>BO1</MenuItem>
                      <MenuItem
                        value={OFFICIAL_MATCH_FORMAT.BEST_OF_3}
                        disabled={!BEST_OF_3_OPERATIONAL || scoringCaps.bestOf3 !== true}
                      >
                        BO3
                      </MenuItem>
                    </TextField>
                  </td>
                  <td>
                    <TextField
                      size="small"
                      type="number"
                      fullWidth
                      value={stage.targetPoints ?? base.targetPoints ?? 11}
                      disabled={disabled}
                      onChange={(e) =>
                        updateStage(row.key, "targetPoints", Number(e.target.value) || 11)
                      }
                      sx={cellSelectSx}
                      inputProps={{ min: 1 }}
                    />
                  </td>
                  <td>
                    <TextField
                      size="small"
                      select
                      fullWidth
                      value={winByOn ? "on" : "off"}
                      disabled={disabled}
                      onChange={(e) =>
                        updateStage(row.key, "winCondition.winByEnabled", e.target.value === "on")
                      }
                      sx={cellSelectSx}
                    >
                      <MenuItem value="on">Có</MenuItem>
                      <MenuItem value="off">Không</MenuItem>
                    </TextField>
                  </td>
                  <td>
                    <TextField
                      size="small"
                      type="number"
                      fullWidth
                      value={stage.winCondition?.winByMargin ?? win.winByMargin ?? 2}
                      disabled={disabled || !winByOn}
                      title={!winByOn ? "Chỉ áp dụng khi bật thắng cách biệt" : undefined}
                      onChange={(e) =>
                        updateStage(
                          row.key,
                          "winCondition.winByMargin",
                          Number(e.target.value) || 2
                        )
                      }
                      sx={{
                        ...cellSelectSx,
                        ...(!winByOn ? inactiveControlSx : null),
                      }}
                      inputProps={{ min: 1 }}
                    />
                  </td>
                  <td>
                    <Stack spacing={0.3}>
                      <TextField
                        size="small"
                        select
                        fullWidth
                        value={pointCapOn ? "on" : "off"}
                        disabled={disabled || pointCapUnsupported}
                        title={pointCapUnsupported ? "Chưa vận hành đầy đủ" : undefined}
                        onChange={(e) =>
                          updateStage(
                            row.key,
                            "winCondition.pointCapEnabled",
                            e.target.value === "on"
                          )
                        }
                        sx={cellSelectSx}
                      >
                        <MenuItem value="on">Có</MenuItem>
                        <MenuItem value="off">Không</MenuItem>
                      </TextField>
                      <TextField
                        size="small"
                        type="number"
                        fullWidth
                        value={
                          pointCapOn
                            ? (stage.winCondition?.pointCap ?? win.pointCap ?? "")
                            : ""
                        }
                        placeholder="—"
                        disabled={disabled || pointCapUnsupported || !pointCapOn}
                        title={
                          pointCapUnsupported
                            ? "Chưa vận hành đầy đủ"
                            : !pointCapOn
                              ? "Chỉ áp dụng khi bật điểm trần"
                              : undefined
                        }
                        onChange={(e) =>
                          updateStage(
                            row.key,
                            "winCondition.pointCap",
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                        sx={{
                          ...cellSelectSx,
                          ...(!pointCapOn || pointCapUnsupported ? inactiveControlSx : null),
                        }}
                        inputProps={{ min: 1 }}
                      />
                    </Stack>
                  </td>
                  <td>
                    <TextField
                      size="small"
                      select
                      fullWidth
                      value={changeOn ? "on" : "off"}
                      disabled={disabled || changeUnsupported}
                      title={
                        changeUnsupported
                          ? "Chưa vận hành đầy đủ"
                          : "Đổi bên / đổi đầu sân"
                      }
                      onChange={(e) =>
                        updateStage(
                          row.key,
                          "changeEnd.changeEndsEnabled",
                          e.target.value === "on"
                        )
                      }
                      sx={cellSelectSx}
                    >
                      <MenuItem value="on">Có</MenuItem>
                      <MenuItem value="off">Không</MenuItem>
                    </TextField>
                  </td>
                  <td>
                    <TextField
                      size="small"
                      type="number"
                      fullWidth
                      value={
                        changeOn
                          ? (stage.changeEnd?.changeEndsAtPoints ??
                            baseChange.changeEndsAtPoints ??
                            "")
                          : ""
                      }
                      placeholder="—"
                      disabled={disabled || changeUnsupported || !changeOn}
                      title={
                        !changeOn
                          ? "Chỉ áp dụng khi bật đổi bên"
                          : "Đổi phía thi đấu trong cùng một sân; không phải chuyển trận sang sân vật lý khác."
                      }
                      onChange={(e) =>
                        updateStage(
                          row.key,
                          "changeEnd.changeEndsAtPoints",
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                      sx={{
                        ...cellSelectSx,
                        ...(!changeOn || changeUnsupported ? inactiveControlSx : null),
                      }}
                      inputProps={{ min: 1 }}
                    />
                  </td>
                  <td>
                    <Button
                      size="small"
                      disabled={disabled}
                      onClick={() => updateStage(row.key, "inheritBase", true)}
                      sx={{
                        fontSize: 11,
                        textTransform: "none",
                        color: TOURNAMENT_COLOR.danger,
                        minWidth: 0,
                        px: 0.5,
                        whiteSpace: "normal",
                        lineHeight: 1.2,
                        textAlign: "left",
                      }}
                    >
                      Xóa ghi đè
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Box>
      </Box>
      <Alert severity="info" sx={{ mt: 1, py: 0.5, fontSize: 12 }}>
        Nếu một giai đoạn để trống, hệ thống sẽ dùng rule cơ sở của Nội dung. Đổi bên = đổi phía /
        đổi đầu sân trong cùng một sân — không phải chuyển sân vật lý.
      </Alert>
      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
        <Button
          size="small"
          variant="outlined"
          disabled={disabled}
          onClick={resetAllStages}
          sx={{ ...outlinedActionSx, textTransform: "none", fontSize: 12 }}
        >
          Đặt lại về rule cơ sở
        </Button>
      </Stack>
    </Box>
  );
}

/**
 * @param {{
 *  draft: object,
 *  setDraft: (updater: (prev: object) => object) => void,
 *  eventName: string,
 *  eventType: string,
 *  eventId?: string,
 *  events?: array,
 *  selectedEventId?: string,
 *  onSelectEvent?: (id: string) => void,
 *  onEventNameChange: (v: string) => void,
 *  onEventTypeChange: (v: string) => void,
 *  locked: boolean,
 *  lockReason?: string,
 *  scoringCaps?: object,
 *  officialMode?: string,
 *  rulesBootstrapSource?: string|null,
 *  rulesAdoption?: object|null,
 *  dirty?: boolean,
 *  busy?: boolean,
 *  lastSavedAt?: string|null,
 *  onBack?: () => void,
 *  onSaveDraft?: () => void,
 *  onUpdate?: () => void,
 * }} props
 */
export default function OfficialContentFormatSettingsPanel({
  draft,
  setDraft,
  eventName,
  eventType,
  eventId = "",
  events = [],
  selectedEventId = "",
  onSelectEvent,
  onEventNameChange,
  onEventTypeChange,
  locked = false,
  lockReason = "",
  scoringCaps = {},
  officialMode = OFFICIAL_MODE.OPEN,
  rulesBootstrapSource = null,
  rulesAdoption = null,
  dirty = false,
  busy = false,
  lastSavedAt = null,
  onBack,
  onSaveDraft,
  onUpdate,
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [searchParams, setSearchParams] = useSearchParams();
  // URL ?section= is presentation authority (F5 / Back / Forward). Not business data.
  const resolvedActiveGroup = resolveFormatSettingsSection(
    readFormatSettingsSectionQuery(searchParams)
  ).sectionId;
  const setActiveGroup = (sectionId) => {
    const next = applyFormatSettingsSectionSearchParams(searchParams, sectionId);
    setSearchParams(next, { replace: false });
  };

  const patch = (path, value) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (path === ".") return { ...prev, ...value };
      const parts = path.split(".");
      let cursor = next;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const key = parts[i];
        cursor[key] = { ...(cursor[key] || {}) };
        cursor = cursor[key];
      }
      cursor[parts[parts.length - 1]] = value;
      if (
        path.startsWith("groupStage") ||
        path.startsWith("qualification") ||
        path === "groupCount"
      ) {
        const groupCount =
          Number(path === "groupStage.groupCount" ? value : next.groupStage?.groupCount) || 4;
        const direct =
          Number(
            path === "qualification.directQualifiersPerGroup"
              ? value
              : next.qualification?.directQualifiersPerGroup
          ) || 2;
        const total =
          Number(
            path === "qualification.totalQualifiers"
              ? value
              : next.qualification?.totalQualifiers
          ) || groupCount * direct;
        next.qualification = {
          ...(next.qualification || {}),
          directQualifiersPerGroup: direct,
          totalQualifiers: total,
          wildcardSlots: Math.max(0, total - groupCount * direct),
        };
      }
      return next;
    });
  };

  const groupCount = Number(draft?.groupStage?.groupCount) || 4;
  const directQ = Number(draft?.qualification?.directQualifiersPerGroup) || 2;
  const totalQ = Number(draft?.qualification?.totalQualifiers) || groupCount * directQ;
  const wildcard = Math.max(0, totalQ - groupCount * directQ);
  const aiBalance = String(officialMode) === OFFICIAL_MODE.AI_BALANCE;
  const disabled = locked;

  const updateStage = (stageKey, field, value) => {
    setDraft((prev) => {
      const stages = { ...(prev.stageOverrides || {}) };
      const current = { ...(stages[stageKey] || { inheritBase: true }) };
      if (field === "inheritBase" && value === true) {
        stages[stageKey] = { inheritBase: true };
      } else if (field === "inheritBase" && value === false) {
        stages[stageKey] = {
          inheritBase: false,
          scoringMethod: prev.matchScoring?.scoringMethod,
          matchFormat: prev.matchScoring?.matchFormat,
          targetPoints: prev.matchScoring?.targetPoints || 11,
          winCondition: { ...(prev.matchScoring?.winCondition || {}) },
          changeEnd: { ...(prev.matchScoring?.changeEnd || {}) },
        };
      } else {
        current.inheritBase = false;
        if (field.includes(".")) {
          const [a, b] = field.split(".");
          current[a] = { ...(current[a] || {}), [b]: value };
        } else {
          current[field] = value;
        }
        if (current.targetPoints == null) {
          current.targetPoints = prev.matchScoring?.targetPoints || 11;
        }
        stages[stageKey] = current;
      }
      return { ...prev, stageOverrides: stages };
    });
  };

  const resetAllStages = () => {
    setDraft((prev) => {
      const stages = {};
      for (const row of STAGE_ROWS) stages[row.key] = { inheritBase: true };
      return { ...prev, stageOverrides: stages };
    });
  };

  const readiness = useMemo(
    () => computeUiReadiness(draft, scoringCaps),
    [draft, scoringCaps]
  );

  const baseTarget = Number(draft?.matchScoring?.targetPoints) || 11;
  const winByMargin = Number(draft?.matchScoring?.winCondition?.winByMargin) || 2;
  const pointCapEnabled = draft?.matchScoring?.winCondition?.pointCapEnabled === true;
  const pointCap = draft?.matchScoring?.winCondition?.pointCap;
  const infoTie =
    pointCapEnabled && pointCap != null
      ? `Khi ${Math.max(0, Number(pointCap) - winByMargin)}–${Math.max(0, Number(pointCap) - winByMargin)}: phải hơn đối phương ${winByMargin} điểm và không vượt quá điểm trần ${pointCap}.`
      : `Khi hòa sát điểm thắng ${baseTarget}: phải hơn đối phương ${winByMargin} điểm${pointCapEnabled && pointCap != null ? ` và không vượt quá điểm trần ${pointCap}` : ""}.`;

  const exampleLines = STAGE_ROWS.filter((r) =>
    ["GROUP", "QUARTERFINAL", "SEMIFINAL", "FINAL"].includes(r.key)
  ).map((row) => {
    const pts = effectiveStagePoints(draft, row.key);
    const stage = draft?.stageOverrides?.[row.key];
    const margin =
      stage?.inheritBase === false && stage?.winCondition?.winByMargin != null
        ? stage.winCondition.winByMargin
        : winByMargin;
    const cap =
      stage?.inheritBase === false && stage?.winCondition?.pointCap != null
        ? stage.winCondition.pointCap
        : pointCapEnabled
          ? pointCap
          : null;
    const changeOn =
      stage?.inheritBase === false && stage?.changeEnd?.changeEndsEnabled != null
        ? stage.changeEnd.changeEndsEnabled === true
        : draft?.matchScoring?.changeEnd?.changeEndsEnabled === true;
    const changeAt =
      stage?.inheritBase === false && stage?.changeEnd?.changeEndsAtPoints != null
        ? stage.changeEnd.changeEndsAtPoints
        : draft?.matchScoring?.changeEnd?.changeEndsAtPoints;
    const series = "BO1";
    const changeText = changeOn
      ? changeAt != null
        ? ` – đổi bên tại ${changeAt}`
        : " – có đổi bên"
      : "";
    return {
      label: row.label,
      text: `${series} – ${pts} điểm – thắng cách biệt ${margin}${cap != null ? ` – điểm trần ${cap}` : ""}${changeText}`,
    };
  });

  const tipCap =
    effectiveStagePoints(draft, "FINAL") ||
    effectiveStagePoints(draft, "QUARTERFINAL") ||
    21;

  const maxCapacity =
    draft?.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR
      ? draft?.capacity?.maxPairs
      : draft?.capacity?.maxParticipants;

  const renderGroupCenter = () => {
    if (resolvedActiveGroup === "content-registration") {
      return (
        <>
          <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 0.35 }}>
            Nhóm 1. Nội dung & đăng ký
          </Typography>
          <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 1.5 }}>
            Thông tin định danh Nội dung và điều kiện đăng ký.
          </Typography>
          <WorkspaceCard title="Thông tin Nội dung">
            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Tên Nội dung"
                  value={eventName}
                  disabled={disabled}
                  onChange={(e) => onEventNameChange(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  select
                  label="Loại thi đấu"
                  value={eventType}
                  disabled={disabled}
                  onChange={(e) => onEventTypeChange(e.target.value)}
                >
                  {EVENT_TYPE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Giới tính"
                  value={deriveGender(eventType)}
                  disabled
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  select
                  label="Hình thức đăng ký"
                  value={draft.registrationMode || OFFICIAL_REGISTRATION_MODE.INDIVIDUAL}
                  disabled={disabled || aiBalance}
                  onChange={(e) => patch("registrationMode", e.target.value)}
                >
                  <MenuItem value={OFFICIAL_REGISTRATION_MODE.INDIVIDUAL}>Cá nhân</MenuItem>
                  <MenuItem value={OFFICIAL_REGISTRATION_MODE.PAIR} disabled={aiBalance}>
                    Cặp cố định
                  </MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  label="Số lượng tối đa"
                  value={maxCapacity ?? ""}
                  disabled={disabled}
                  onChange={(e) =>
                    patch(
                      draft.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR
                        ? "capacity.maxPairs"
                        : "capacity.maxParticipants",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  label="Trình độ min"
                  value={draft.eligibility?.minLevel ?? ""}
                  disabled={disabled}
                  onChange={(e) =>
                    patch("eligibility.minLevel", e.target.value === "" ? null : e.target.value)
                  }
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  label="Trình độ max"
                  value={draft.eligibility?.maxLevel ?? ""}
                  disabled={disabled}
                  onChange={(e) =>
                    patch("eligibility.maxLevel", e.target.value === "" ? null : e.target.value)
                  }
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  label="Rating min"
                  value={draft.eligibility?.minRating ?? ""}
                  disabled={disabled}
                  onChange={(e) =>
                    patch("eligibility.minRating", e.target.value === "" ? null : e.target.value)
                  }
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  label="Rating max"
                  value={draft.eligibility?.maxRating ?? ""}
                  disabled={disabled}
                  onChange={(e) =>
                    patch("eligibility.maxRating", e.target.value === "" ? null : e.target.value)
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  select
                  label="Seeding"
                  value={draft.seedingPolicy || "NONE"}
                  disabled={disabled}
                  helperText="Chỉ lưu chính sách Nội dung. Không dùng cho ghép cặp / chia bảng. KO placement chưa sẵn sàng."
                  onChange={(e) => patch("seedingPolicy", e.target.value)}
                >
                  <MenuItem value="NONE">Không seed</MenuItem>
                  <MenuItem value="MANUAL">Thủ công (chưa sẵn sàng)</MenuItem>
                  <MenuItem value="RANKING">Theo xếp hạng (chưa sẵn sàng)</MenuItem>
                  <MenuItem value="RATING">Theo rating (chưa sẵn sàng)</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </WorkspaceCard>
        </>
      );
    }

    if (resolvedActiveGroup === "structure") {
      return (
        <>
          <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 0.35 }}>
            Nhóm 2. Cấu trúc thi đấu
          </Typography>
          <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 1.5 }}>
            Vòng bảng, suất đi tiếp và nhánh knockout theo Nội dung.
          </Typography>
          <WorkspaceCard title="Vòng bảng">
            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  select
                  label="Có vòng bảng"
                  value={draft.groupStage?.groupStageEnabled !== false ? "yes" : "no"}
                  disabled={disabled}
                  onChange={(e) => patch("groupStage.groupStageEnabled", e.target.value === "yes")}
                >
                  <MenuItem value="yes">Có</MenuItem>
                  <MenuItem value="no">Không</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  label="Số bảng"
                  value={groupCount}
                  disabled={disabled}
                  onChange={(e) => patch("groupStage.groupCount", Number(e.target.value) || 1)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  label="Số tối đa mỗi bảng"
                  value={draft.groupStage?.maxUnitsPerGroup ?? ""}
                  disabled={disabled}
                  onChange={(e) =>
                    patch(
                      "groupStage.maxUnitsPerGroup",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  select
                  label="Round robin"
                  value="SINGLE"
                  disabled
                  helperText="Hai lượt: chưa sẵn sàng"
                >
                  <MenuItem value="SINGLE">Một lượt</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  select
                  label="Bảng không đều"
                  value={draft.groupStage?.allowUnevenGroups !== false ? "yes" : "no"}
                  disabled={disabled}
                  onChange={(e) =>
                    patch("groupStage.allowUnevenGroups", e.target.value === "yes")
                  }
                >
                  <MenuItem value="yes">Cho phép</MenuItem>
                  <MenuItem value="no">Không</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </WorkspaceCard>
          <WorkspaceCard title="Đi tiếp">
            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  label="Tổng số suất knockout"
                  value={totalQ}
                  disabled={disabled}
                  onChange={(e) =>
                    patch("qualification.totalQualifiers", Number(e.target.value) || 1)
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  label="Suất trực tiếp mỗi bảng"
                  value={directQ}
                  disabled={disabled}
                  onChange={(e) =>
                    patch(
                      "qualification.directQualifiersPerGroup",
                      Number(e.target.value) || 1
                    )
                  }
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Alert severity="info" sx={{ py: 0.75, fontSize: 12.5 }}>
                  {groupCount} bảng × {directQ} suất trực tiếp = {groupCount * directQ} suất
                  <br />
                  Tổng suất knockout = {totalQ}
                  <br />
                  Còn {wildcard} suất wildcard
                  {wildcard > 0 ? (
                    <>
                      <br />
                      {wildcard} suất wildcard cần được xác định theo chính sách xếp hạng ở Nhóm 4
                      (chưa thực thi).
                    </>
                  ) : null}
                </Alert>
              </Grid>
            </Grid>
          </WorkspaceCard>
          <WorkspaceCard title="Knockout">
            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  select
                  label="Có knockout"
                  value={draft.knockout?.knockoutEnabled !== false ? "yes" : "no"}
                  disabled={disabled}
                  onChange={(e) => patch("knockout.knockoutEnabled", e.target.value === "yes")}
                >
                  <MenuItem value="yes">Có</MenuItem>
                  <MenuItem value="no">Không</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  label="Knockout size"
                  value={totalQ}
                  disabled
                  helperText="Theo tổng suất đi tiếp"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  select
                  label="Pairing policy"
                  value={draft.knockout?.pairingPolicy || "CROSS_GROUP"}
                  disabled={disabled}
                  onChange={(e) => patch("knockout.pairingPolicy", e.target.value)}
                  helperText={
                    draft.knockout?.pairingPolicy === "SEEDED" ||
                    draft.knockout?.pairingPolicy === "RANDOM"
                      ? "Chưa sẵn sàng trên Official classic path"
                      : "Chéo bảng: A1×B2 / A2×B1 (engine hiện có)"
                  }
                >
                  <MenuItem value="CROSS_GROUP">Chéo bảng</MenuItem>
                  <MenuItem value="SEEDED" disabled>
                    Theo seed — Chưa sẵn sàng
                  </MenuItem>
                  <MenuItem value="RANDOM" disabled>
                    Ngẫu nhiên — Chưa sẵn sàng
                  </MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  select
                  label="Tránh cùng bảng gặp lại"
                  value={draft.knockout?.avoidSameGroupFirstRound !== false ? "yes" : "no"}
                  disabled={disabled}
                  onChange={(e) =>
                    patch("knockout.avoidSameGroupFirstRound", e.target.value === "yes")
                  }
                >
                  <MenuItem value="yes">Có</MenuItem>
                  <MenuItem value="no">Không</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </WorkspaceCard>
          <WorkspaceCard
            title="Tùy chọn nâng cao"
            action={<StatusBadge label="Capability truth" tone="warn" />}
          >
            <Stack spacing={0.75}>
              <TextField
                size="small"
                fullWidth
                label="Bỏ vòng bảng (GROUP_STAGE_BYPASS)"
                value="SUPPORTED — cần entryId; UI chọn đơn vị chưa sẵn sàng"
                disabled
                helperText="Runtime chia bảng đã bind shared bypass population. Không mở control thiếu selector entryId."
              />
              <TextField
                size="small"
                fullWidth
                label="Vào thẳng knockout (DIRECT)"
                value="PARTIAL — Chưa sẵn sàng trên Official classic"
                disabled
                helperText="Shared CE first-playable only; Official classic CROSS_GROUP fail-closed."
              />
              <TextField
                size="small"
                fullWidth
                label="Bye (KNOCKOUT_BYE)"
                value="SUPPORTED (CORE-08/09) — Official classic chưa bind"
                disabled
                helperText="Không invent bye cục bộ. DIRECT ≠ BYE."
              />
            </Stack>
          </WorkspaceCard>
        </>
      );
    }

    if (resolvedActiveGroup === "match-rules") {
      return (
        <>
          <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 0.35 }}>
            Nhóm 3. Luật trận đấu & đổi bên
          </Typography>
          <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 1.5 }}>
            Cấu hình toàn bộ luật trận đấu của Nội dung, bao gồm cách tính điểm, thể thức, điểm
            thắng, thắng cách biệt, điểm trần và đổi bên theo từng giai đoạn thi đấu.
          </Typography>

          <WorkspaceCard title="A. Rule cơ sở của Nội dung">
            <Stack spacing={1.25}>
              <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                Một hồ sơ luật trận đầy đủ của Nội dung (bao gồm đổi bên / đổi đầu sân).
              </Typography>
              <CompactField label="Cách tính điểm">
                <RadioGroup
                  row
                  value={draft.matchScoring?.scoringMethod || OFFICIAL_SCORING_METHOD.RALLY}
                  onChange={(e) => patch("matchScoring.scoringMethod", e.target.value)}
                >
                  <FormControlLabel
                    value={OFFICIAL_SCORING_METHOD.RALLY}
                    control={<Radio size="small" disabled={disabled} />}
                    label="Rally"
                  />
                  <FormControlLabel
                    value={OFFICIAL_SCORING_METHOD.SIDE_OUT}
                    control={
                      <Radio
                        size="small"
                        disabled={
                          disabled || !SIDEOUT_OPERATIONAL || scoringCaps.sideOut !== true
                        }
                      />
                    }
                    label="Side-out"
                  />
                </RadioGroup>
              </CompactField>

              <CompactField label="Thể thức">
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                  <RadioGroup
                    row
                    value={draft.matchScoring?.matchFormat || OFFICIAL_MATCH_FORMAT.BEST_OF_1}
                    onChange={(e) => patch("matchScoring.matchFormat", e.target.value)}
                  >
                    <FormControlLabel
                      value={OFFICIAL_MATCH_FORMAT.BEST_OF_1}
                      control={<Radio size="small" disabled={disabled} />}
                      label="Best of 1"
                    />
                    <FormControlLabel
                      value={OFFICIAL_MATCH_FORMAT.BEST_OF_3}
                      control={
                        <Radio
                          size="small"
                          disabled={
                            disabled ||
                            !BEST_OF_3_OPERATIONAL ||
                            scoringCaps.bestOf3 !== true
                          }
                        />
                      }
                      label="Best of 3"
                    />
                  </RadioGroup>
                  {!BEST_OF_3_OPERATIONAL || scoringCaps.bestOf3 !== true ? (
                    <StatusBadge label="Chưa sẵn sàng" tone="warn" />
                  ) : null}
                </Stack>
              </CompactField>

              <Grid container spacing={1}>
                <Grid size={{ xs: 6, sm: 3, md: 1.5 }}>
                  <CompactField label="Điểm thắng">
                    <TextField
                      size="small"
                      fullWidth
                      type="number"
                      value={draft.matchScoring?.targetPoints ?? 11}
                      disabled={disabled}
                      onChange={(e) =>
                        patch("matchScoring.targetPoints", Number(e.target.value) || 11)
                      }
                    />
                  </CompactField>
                </Grid>
                <Grid size={{ xs: 6, sm: 3, md: 1.5 }}>
                  <CompactField label="Win-by">
                    <TextField
                      size="small"
                      fullWidth
                      select
                      value={
                        draft.matchScoring?.winCondition?.winByEnabled !== false ? "on" : "off"
                      }
                      disabled={disabled || scoringCaps.winBy !== true}
                      onChange={(e) =>
                        patch(
                          "matchScoring.winCondition.winByEnabled",
                          e.target.value === "on"
                        )
                      }
                    >
                      <MenuItem value="on">Có</MenuItem>
                      <MenuItem value="off">Không</MenuItem>
                    </TextField>
                  </CompactField>
                </Grid>
                <Grid size={{ xs: 6, sm: 3, md: 1.5 }}>
                  <CompactField label="Cách biệt">
                    <TextField
                      size="small"
                      fullWidth
                      type="number"
                      value={draft.matchScoring?.winCondition?.winByMargin ?? 2}
                      disabled={
                        disabled ||
                        draft.matchScoring?.winCondition?.winByEnabled === false ||
                        scoringCaps.winBy !== true
                      }
                      title={
                        draft.matchScoring?.winCondition?.winByEnabled === false
                          ? "Chỉ áp dụng khi bật thắng cách biệt"
                          : undefined
                      }
                      helperText={
                        draft.matchScoring?.winCondition?.winByEnabled === false
                          ? "Chỉ áp dụng khi bật thắng cách biệt"
                          : " "
                      }
                      FormHelperTextProps={{ sx: { mx: 0, minHeight: 18 } }}
                      onChange={(e) =>
                        patch(
                          "matchScoring.winCondition.winByMargin",
                          Number(e.target.value) || 2
                        )
                      }
                      sx={
                        draft.matchScoring?.winCondition?.winByEnabled === false ||
                        scoringCaps.winBy !== true
                          ? inactiveControlSx
                          : undefined
                      }
                    />
                  </CompactField>
                </Grid>
                <Grid size={{ xs: 6, sm: 3, md: 2.5 }}>
                  <CompactField label="Điểm trần">
                    <Stack direction="row" spacing={0.75} alignItems="flex-start">
                      <TextField
                        size="small"
                        select
                        value={
                          draft.matchScoring?.winCondition?.pointCapEnabled === true
                            ? "on"
                            : "off"
                        }
                        disabled={disabled || scoringCaps.pointCap !== true}
                        title={
                          scoringCaps.pointCap !== true ? "Chưa vận hành đầy đủ" : undefined
                        }
                        onChange={(e) =>
                          patch(
                            "matchScoring.winCondition.pointCapEnabled",
                            e.target.value === "on"
                          )
                        }
                        sx={{ minWidth: 80 }}
                      >
                        <MenuItem value="on">Có</MenuItem>
                        <MenuItem value="off">Không</MenuItem>
                      </TextField>
                      <TextField
                        size="small"
                        type="number"
                        value={
                          draft.matchScoring?.winCondition?.pointCapEnabled === true
                            ? (draft.matchScoring?.winCondition?.pointCap ?? "")
                            : ""
                        }
                        placeholder="—"
                        disabled={
                          disabled ||
                          scoringCaps.pointCap !== true ||
                          !draft.matchScoring?.winCondition?.pointCapEnabled
                        }
                        title={
                          scoringCaps.pointCap !== true
                            ? "Chưa vận hành đầy đủ"
                            : !draft.matchScoring?.winCondition?.pointCapEnabled
                              ? "Chỉ áp dụng khi bật điểm trần"
                              : undefined
                        }
                        helperText={
                          !draft.matchScoring?.winCondition?.pointCapEnabled
                            ? "Chỉ áp dụng khi bật điểm trần"
                            : " "
                        }
                        FormHelperTextProps={{ sx: { mx: 0, minHeight: 18 } }}
                        onChange={(e) =>
                          patch(
                            "matchScoring.winCondition.pointCap",
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                        sx={{
                          flex: 1,
                          ...(scoringCaps.pointCap !== true ||
                          !draft.matchScoring?.winCondition?.pointCapEnabled
                            ? inactiveControlSx
                            : null),
                        }}
                      />
                    </Stack>
                  </CompactField>
                </Grid>
                <Grid size={{ xs: 6, sm: 3, md: 1.5 }}>
                  <CompactField label="Đổi bên">
                    <TextField
                      size="small"
                      fullWidth
                      select
                      value={
                        draft.matchScoring?.changeEnd?.changeEndsEnabled === true ? "on" : "off"
                      }
                      disabled={disabled || scoringCaps.changeEnd !== true}
                      title="Đổi bên / đổi đầu sân"
                      onChange={(e) =>
                        patch(
                          "matchScoring.changeEnd.changeEndsEnabled",
                          e.target.value === "on"
                        )
                      }
                      helperText={
                        scoringCaps.changeEnd !== true ? "Chưa vận hành đầy đủ" : " "
                      }
                      FormHelperTextProps={{ sx: { mx: 0, minHeight: 18 } }}
                    >
                      <MenuItem value="on">Có</MenuItem>
                      <MenuItem value="off">Không</MenuItem>
                    </TextField>
                  </CompactField>
                </Grid>
                <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                  <CompactField label="Điểm đổi bên">
                    <TextField
                      size="small"
                      fullWidth
                      type="number"
                      value={
                        draft.matchScoring?.changeEnd?.changeEndsEnabled === true
                          ? (draft.matchScoring?.changeEnd?.changeEndsAtPoints ?? "")
                          : ""
                      }
                      placeholder="—"
                      disabled={
                        disabled ||
                        scoringCaps.changeEnd !== true ||
                        draft.matchScoring?.changeEnd?.changeEndsEnabled !== true
                      }
                      title={
                        draft.matchScoring?.changeEnd?.changeEndsEnabled !== true
                          ? "Chỉ áp dụng khi bật đổi bên"
                          : "Đổi phía thi đấu trong cùng một sân; không phải chuyển trận sang sân vật lý khác."
                      }
                      helperText={
                        draft.matchScoring?.changeEnd?.changeEndsEnabled !== true
                          ? "Chỉ áp dụng khi bật đổi bên"
                          : "11→6 · 15→8 · 21→11"
                      }
                      FormHelperTextProps={{ sx: { mx: 0, minHeight: 18 } }}
                      onChange={(e) =>
                        patch(
                          "matchScoring.changeEnd.changeEndsAtPoints",
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                      sx={
                        draft.matchScoring?.changeEnd?.changeEndsEnabled !== true ||
                        scoringCaps.changeEnd !== true
                          ? inactiveControlSx
                          : undefined
                      }
                    />
                  </CompactField>
                </Grid>
              </Grid>

              <Alert
                severity="info"
                sx={{
                  py: 0.75,
                  bgcolor: TOURNAMENT_COLOR.primarySurface,
                  color: TOURNAMENT_COLOR.text,
                  border: `1px solid ${TOURNAMENT_COLOR.primary}33`,
                  "& .MuiAlert-icon": { color: TOURNAMENT_COLOR.primary },
                }}
              >
                {infoTie} Đổi bên = đổi phía thi đấu trong cùng một sân; không phải chuyển trận
                sang sân vật lý khác.
              </Alert>

              <Accordion
                disableGutters
                elevation={0}
                sx={{
                  border: `1px solid ${TOURNAMENT_COLOR.divider}`,
                  borderRadius: "8px !important",
                  "&:before": { display: "none" },
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                      Nâng cao — Đổi bên
                    </Typography>
                    {scoringCaps.changeEnd !== true ? (
                      <StatusBadge label="Chưa vận hành đầy đủ" tone="warn" />
                    ) : null}
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mb: 1 }}>
                    Đổi bên / đổi đầu sân — không phải đổi sân vật lý (Sân 1 → Sân 2).
                  </Typography>
                  <Grid container spacing={1.25}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        size="small"
                        fullWidth
                        select
                        label="Đổi bên giữa các game"
                        value={
                          draft.matchScoring?.changeEnd?.changeEndsBetweenGames !== false
                            ? "yes"
                            : "no"
                        }
                        disabled={disabled || scoringCaps.changeEnd !== true}
                        onChange={(e) =>
                          patch(
                            "matchScoring.changeEnd.changeEndsBetweenGames",
                            e.target.value === "yes"
                          )
                        }
                      >
                        <MenuItem value="yes">Có</MenuItem>
                        <MenuItem value="no">Không</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        size="small"
                        fullWidth
                        type="number"
                        label="Game quyết định đổi bên tại điểm"
                        value={draft.matchScoring?.changeEnd?.decidingGameChangeEndsAt ?? ""}
                        disabled={disabled || scoringCaps.changeEnd !== true}
                        onChange={(e) =>
                          patch(
                            "matchScoring.changeEnd.decidingGameChangeEndsAt",
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Stack>
          </WorkspaceCard>

          <WorkspaceCard title="B. Cấu hình theo giai đoạn">
            <StageRuleTable
              draft={draft}
              disabled={disabled}
              updateStage={updateStage}
              resetAllStages={resetAllStages}
              scoringCaps={scoringCaps}
            />
          </WorkspaceCard>

          <Box sx={{ ...cardSx }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1 }}>C. Ví dụ minh họa</Typography>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 7 }}>
                <Stack spacing={0.75}>
                  {exampleLines.map((line) => (
                    <Typography key={line.label} sx={{ fontSize: 12.5 }}>
                      <strong>{line.label}:</strong> {line.text}
                    </Typography>
                  ))}
                  <Typography sx={{ fontSize: 12.5, mt: 0.5 }}>
                    <strong>Đổi bên:</strong> 11 điểm → đổi tại 6 · 15 → 8 · 21 → 11
                  </Typography>
                  <Typography sx={{ fontSize: 12.5 }}>
                    Trận BO1, Rally, 15 điểm, thắng cách biệt 2, đổi bên khi một bên đạt 8 điểm.
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Box
                  sx={{
                    bgcolor: TOURNAMENT_COLOR.purpleSurface,
                    borderRadius: "8px",
                    p: 1.25,
                    border: `1px solid ${TOURNAMENT_COLOR.purple}33`,
                  }}
                >
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 0.5, color: TOURNAMENT_COLOR.purple }}>
                    Khi tỉ số {tipCap - 1}–{tipCap - 1}:
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.text }}>
                    • Ai đạt {tipCap} trước thắng.
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.text }}>
                    • Không cần hơn 2 điểm do đã có điểm trần.
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.text, mt: 0.75 }}>
                    • Trận 15 điểm → đổi bên khi một bên đạt 8.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </>
      );
    }

    if (resolvedActiveGroup === "ranking") {
      return (
        <>
          <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 0.35 }}>
            Nhóm 4. Xếp hạng & đi tiếp
          </Typography>
          <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 1.5 }}>
            Thứ tự tie-break — engine domain tính toán, UI chỉ cấu hình chính sách.
          </Typography>
          <WorkspaceCard title="A. Tie-break trong bảng">
            <Stack component="ol" spacing={0.5} sx={{ m: 0, pl: 2.25 }}>
              {[
                "Đối đầu",
                "Số trận thắng",
                "Hiệu số điểm",
                "Điểm ghi được",
                "Bốc thăm",
              ].map((item) => (
                <Typography component="li" key={item} sx={{ fontSize: 13 }}>
                  {item}
                </Typography>
              ))}
            </Stack>
          </WorkspaceCard>
          <WorkspaceCard title="B. Wildcard liên bảng">
            <Stack component="ol" spacing={0.5} sx={{ m: 0, pl: 2.25, mb: 1 }}>
              {[
                "Tỷ lệ thắng",
                "Hiệu số điểm / trận",
                "Điểm ghi được / trận",
                "Bốc thăm",
              ].map((item) => (
                <Typography component="li" key={item} sx={{ fontSize: 13 }}>
                  {item}
                </Typography>
              ))}
            </Stack>
            <Alert severity="info" sx={{ py: 0.75, fontSize: 12.5 }}>
              Nếu các bảng có số trận khác nhau, sử dụng chỉ số chuẩn hóa theo mỗi trận.
            </Alert>
            {wildcard > 0 ? (
              <Alert severity="warning" sx={{ mt: 1, py: 0.75, fontSize: 12.5 }}>
                {wildcard} suất wildcard cần xếp hạng chéo bảng ở Nhóm 4 — chưa thực thi. Không tự
                chọn theo rating / thứ tự đăng ký / ngẫu nhiên.
              </Alert>
            ) : null}
          </WorkspaceCard>
        </>
      );
    }

    if (resolvedActiveGroup === "ops") {
      return (
        <>
          <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 0.35 }}>
            Nhóm 5. Vận hành trận
          </Typography>
          <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 1.5 }}>
            Chính sách vận hành — không giả lập runtime.
          </Typography>
          <Grid container spacing={1.25}>
            {[
              {
                title: "Walkover (WO)",
                body: (
                  <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                    Chính sách WO theo luật Nội dung. Runtime vẫn qua luồng trận hiện có.
                  </Typography>
                ),
                badge: { label: "Policy", tone: "ok" },
              },
              {
                title: "Retired (RET)",
                body: (
                  <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                    Ghi nhận RET trên trận — chưa có cấu hình riêng trên màn này.
                  </Typography>
                ),
                badge: { label: "Chưa sẵn sàng", tone: "warn" },
              },
              {
                title: "Đến trễ",
                body: (
                  <TextField
                    size="small"
                    fullWidth
                    select
                    label="Ngưỡng (phút)"
                    value={draft.walkover?.lateArrivalPolicy?.thresholdMinutes ?? 15}
                    disabled={disabled}
                    onChange={(e) =>
                      patch(
                        "walkover.lateArrivalPolicy.thresholdMinutes",
                        Number(e.target.value) || 15
                      )
                    }
                  >
                    {[5, 10, 15, 20, 30].map((m) => (
                      <MenuItem key={m} value={m}>
                        {m} phút
                      </MenuItem>
                    ))}
                  </TextField>
                ),
                badge: { label: "Policy", tone: "ok" },
              },
              {
                title: "Rút khỏi giải",
                body: (
                  <TextField
                    size="small"
                    fullWidth
                    select
                    label="Kết quả trước"
                    value={
                      draft.walkover?.withdrawalPolicy ||
                      "KEEP_COMPLETED_AND_WO_REMAINING"
                    }
                    disabled={disabled}
                    onChange={(e) => patch("walkover.withdrawalPolicy", e.target.value)}
                  >
                    <MenuItem value="KEEP_COMPLETED_AND_WO_REMAINING">
                      Giữ kết quả xong · WO còn lại
                    </MenuItem>
                    <MenuItem value="KEEP_COMPLETED_RESULTS">Giữ kết quả đã xong</MenuItem>
                    <MenuItem value="VOID_ALL_RESULTS">Hủy mọi kết quả</MenuItem>
                  </TextField>
                ),
                badge: { label: "Policy", tone: "ok" },
              },
              {
                title: "Thay VĐV",
                body: (
                  <Stack spacing={1}>
                    <TextField
                      size="small"
                      fullWidth
                      select
                      label="Cho phép thay"
                      value={draft.substitution?.allowed === true ? "yes" : "no"}
                      disabled={disabled}
                      onChange={(e) =>
                        patch("substitution.allowed", e.target.value === "yes")
                      }
                    >
                      <MenuItem value="yes">Có</MenuItem>
                      <MenuItem value="no">Không</MenuItem>
                    </TextField>
                    <StatusBadge label="Runtime thay người chưa đầy đủ" tone="warn" />
                  </Stack>
                ),
                badge: { label: "Partial", tone: "warn" },
              },
              {
                title: "Check-in",
                body: (
                  <Stack spacing={1}>
                    <TextField
                      size="small"
                      fullWidth
                      select
                      label="Bắt buộc"
                      value={draft.checkIn?.checkInRequired === true ? "yes" : "no"}
                      disabled={disabled}
                      onChange={(e) =>
                        patch("checkIn.checkInRequired", e.target.value === "yes")
                      }
                    >
                      <MenuItem value="yes">Có</MenuItem>
                      <MenuItem value="no">Không</MenuItem>
                    </TextField>
                    <TextField
                      size="small"
                      fullWidth
                      type="number"
                      label="Đóng trước trận (phút)"
                      value={draft.checkIn?.checkInCloseMinutesBeforeStart ?? 30}
                      disabled={disabled || !draft.checkIn?.checkInRequired}
                      onChange={(e) =>
                        patch(
                          "checkIn.checkInCloseMinutesBeforeStart",
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </Stack>
                ),
                badge: { label: "Policy", tone: "ok" },
              },
            ].map((card) => (
              <Grid key={card.title} size={{ xs: 12, sm: 6 }}>
                <Box sx={cardSx}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography sx={{ fontWeight: 800, fontSize: 13.5 }}>{card.title}</Typography>
                    <StatusBadge label={card.badge.label} tone={card.badge.tone} />
                  </Stack>
                  {card.body}
                </Box>
              </Grid>
            ))}
          </Grid>
        </>
      );
    }

    // ops-infra
    return (
      <>
        <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 0.35 }}>
          Nhóm 6. Sân, trọng tài, lịch & công bố
        </Typography>
        <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 1.5 }}>
          Chỉ chính sách. Không gán sân / trọng tài cụ thể tại đây.
        </Typography>
        <WorkspaceCard title="A. Yêu cầu sân">
          <TextField
            size="small"
            fullWidth
            type="number"
            label="Số sân tối thiểu (policy)"
            value={draft.courtRequirement?.minimumCourts ?? ""}
            disabled={disabled}
            onChange={(e) =>
              patch(
                "courtRequirement.minimumCourts",
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
            helperText="Đây là yêu cầu sử dụng sân, không phải phân công Sân 1 / Sân 2."
          />
        </WorkspaceCard>
        <WorkspaceCard title="B. Trọng tài">
          <Grid container spacing={1.25}>
            {[
              { key: "GROUP", label: "Vòng bảng", fallback: "OPTIONAL" },
              { key: "QUARTERFINAL", label: "Tứ kết", fallback: "OPTIONAL" },
              { key: "SEMIFINAL", label: "Bán kết", fallback: "REQUIRED" },
              { key: "FINAL", label: "Chung kết", fallback: "REQUIRED" },
            ].map((row) => (
              <Grid key={row.key} size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  select
                  label={row.label}
                  value={draft.refereeRequirement?.byStage?.[row.key] || row.fallback}
                  disabled={disabled}
                  onChange={(e) =>
                    patch(`refereeRequirement.byStage.${row.key}`, e.target.value)
                  }
                >
                  <MenuItem value="NOT_REQUIRED">Không bắt buộc</MenuItem>
                  <MenuItem value="OPTIONAL">Tùy chọn</MenuItem>
                  <MenuItem value="REQUIRED">Bắt buộc</MenuItem>
                </TextField>
              </Grid>
            ))}
          </Grid>
        </WorkspaceCard>
        <WorkspaceCard title="C. Lịch">
          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                size="small"
                fullWidth
                type="number"
                label="Thời lượng trận dự kiến (phút)"
                value={draft.scheduleConstraints?.estimatedMatchDurationMinutes ?? 45}
                disabled={disabled}
                onChange={(e) =>
                  patch(
                    "scheduleConstraints.estimatedMatchDurationMinutes",
                    Number(e.target.value) || 45
                  )
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                size="small"
                fullWidth
                type="number"
                label="Nghỉ tối thiểu (phút)"
                value={draft.scheduleConstraints?.minimumRestMinutes ?? 15}
                disabled={disabled}
                onChange={(e) =>
                  patch(
                    "scheduleConstraints.minimumRestMinutes",
                    Number(e.target.value) || 0
                  )
                }
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                size="small"
                fullWidth
                select
                label="Không xếp trùng VĐV"
                value="yes"
                disabled
                helperText="Luôn áp dụng trong scheduler hiện có"
              >
                <MenuItem value="yes">Có</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </WorkspaceCard>
        <WorkspaceCard title="D. Công bố">
          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                size="small"
                fullWidth
                select
                label="Kết quả trận"
                value={
                  draft.publication?.resultsPublicationPolicy || "AFTER_ACCEPTED_RESULT"
                }
                disabled={disabled}
                onChange={(e) =>
                  patch("publication.resultsPublicationPolicy", e.target.value)
                }
              >
                <MenuItem value="AFTER_ACCEPTED_RESULT">Sau kết quả accepted</MenuItem>
                <MenuItem value="DIRECTOR_APPROVAL">Cần BTC duyệt</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                size="small"
                fullWidth
                select
                label="BXH live"
                value={draft.publication?.standingsPublicationPolicy || "PUBLIC"}
                disabled={disabled}
                onChange={(e) =>
                  patch("publication.standingsPublicationPolicy", e.target.value)
                }
              >
                <MenuItem value="PUBLIC">Công khai</MenuItem>
                <MenuItem value="PRIVATE">Riêng tư</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                size="small"
                fullWidth
                select
                label="Bracket"
                value={draft.publication?.bracketPublicationPolicy || "DIRECTOR_APPROVAL"}
                disabled={disabled}
                onChange={(e) =>
                  patch("publication.bracketPublicationPolicy", e.target.value)
                }
              >
                <MenuItem value="IMMEDIATE">Khi tạo</MenuItem>
                <MenuItem value="DIRECTOR_APPROVAL">Sau BTC duyệt</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                size="small"
                fullWidth
                select
                label="Kết quả chung cuộc"
                value={draft.publication?.finalResultsPublicationPolicy || "DIRECTOR_APPROVAL"}
                disabled={disabled}
                onChange={(e) =>
                  patch("publication.finalResultsPublicationPolicy", e.target.value)
                }
              >
                <MenuItem value="DIRECTOR_APPROVAL">Sau BTC duyệt</MenuItem>
                <MenuItem value="IMMEDIATE">Ngay khi hoàn tất</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </WorkspaceCard>
      </>
    );
  };

  const leftNav = (
    <Stack
      spacing={0.85}
      data-testid="content-settings-left-nav"
      sx={{
        display: { xs: "none", md: "flex" },
        width: { md: 200, lg: 220 },
        flexShrink: 0,
      }}
    >
      {NAV_GROUPS.map((g) => {
        const active = resolvedActiveGroup === g.id;
        return (
          <Box
            key={g.id}
            component="button"
            type="button"
            onClick={() => setActiveGroup(g.id)}
            data-testid={`content-settings-nav-${g.id}`}
            sx={{
              textAlign: "left",
              cursor: "pointer",
              bgcolor: active ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
              border: `1.5px solid ${active ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider}`,
              borderRadius: "8px",
              p: 1.1,
              boxShadow: active ? "none" : TOURNAMENT_ELEVATION.card,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  bgcolor: active ? TOURNAMENT_COLOR.primary : "#E2E8F0",
                  color: active ? "#fff" : TOURNAMENT_COLOR.textMuted,
                  fontSize: 11,
                  fontWeight: 800,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  mt: 0.15,
                }}
              >
                {g.number}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: 12.5,
                    color: active ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.text,
                    lineHeight: 1.25,
                  }}
                >
                  {g.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 11,
                    color: TOURNAMENT_COLOR.textMuted,
                    lineHeight: 1.3,
                    mt: 0.25,
                  }}
                >
                  {g.description}
                </Typography>
              </Box>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );

  const mobileNav = (
    <Box sx={{ display: { xs: "block", md: "none" }, mb: 1.25 }}>
      <TextField
        size="small"
        fullWidth
        select
        label="Nhóm cấu hình"
        value={resolvedActiveGroup}
        onChange={(e) => setActiveGroup(e.target.value)}
      >
        {NAV_GROUPS.map((g) => (
          <MenuItem key={g.id} value={g.id}>
            {g.number}. {g.title}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );

  const rightSidebar = (
    <Stack
      spacing={1.25}
      data-testid="content-settings-right-rail"
      sx={{
        width: { xs: "100%", lg: 260 },
        flexShrink: 0,
        mt: { xs: 1.5, lg: 0 },
      }}
    >
      <Box sx={cardSx}>
        <Typography sx={{ fontWeight: 800, fontSize: 13, mb: 0.75 }}>Thông tin Nội dung</Typography>
        <InfoRow label="Tên Nội dung" value={eventName || EVENT_TYPE_LABELS[eventType] || "—"} />
        <InfoRow label="Loại thi đấu" value={deriveEventKind(eventType)} />
        <InfoRow label="Giới tính" value={deriveGender(eventType)} />
        <InfoRow
          label="Hình thức đăng ký"
          value={registrationLabel(draft.registrationMode)}
        />
        <InfoRow
          label="Số lượng tối đa"
          value={
            maxCapacity != null
              ? `${maxCapacity} ${draft.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR ? "cặp" : "VĐV"}`
              : "Chưa đặt"
          }
        />
        <InfoRow label="Trình độ" value={formatLevelRange(draft.eligibility)} />
        <InfoRow label="Rating" value={formatRatingRange(draft.eligibility)} />
        <InfoRow label="Seeding" value={seedingLabel(draft.seedingPolicy)} />
      </Box>

      <Box sx={cardSx}>
        <Typography sx={{ fontWeight: 800, fontSize: 13, mb: 0.75 }}>
          Tóm tắt luật trận đấu
        </Typography>
        <InfoRow
          label="Cách tính điểm"
          value={
            String(draft.matchScoring?.scoringMethod || "").toLowerCase().includes("side")
              ? "Side-out"
              : "Rally"
          }
        />
        <InfoRow
          label="Thể thức cơ sở"
          value={
            String(draft.matchScoring?.matchFormat || "")
              .toUpperCase()
              .includes("BEST_OF_3")
              ? "Best of 3"
              : "Best of 1"
          }
        />
        <InfoRow
          label="Đổi bên"
          value={
            draft.matchScoring?.changeEnd?.changeEndsEnabled === true
              ? draft.matchScoring?.changeEnd?.changeEndsAtPoints != null
                ? `Có · tại ${draft.matchScoring.changeEnd.changeEndsAtPoints} điểm`
                : "Có"
              : "Không"
          }
        />
        <Stack spacing={0.55} sx={{ mt: 0.75 }}>
          {STAGE_ROWS.map((row) => {
            const pts = effectiveStagePoints(draft, row.key);
            const base = stageUsesBase(draft, row.key);
            return (
              <Stack key={row.key} direction="row" spacing={0.75} alignItems="center">
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: base ? TOURNAMENT_COLOR.success : TOURNAMENT_COLOR.warning,
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.text }}>
                  {row.label}: {pts} điểm
                </Typography>
              </Stack>
            );
          })}
        </Stack>
        <Button
          size="small"
          onClick={() => setActiveGroup("match-rules")}
          sx={{ mt: 1, textTransform: "none", fontSize: 12, px: 0 }}
        >
          Xem chi tiết tất cả nhóm
        </Button>
      </Box>

      <Box sx={cardSx}>
        <Typography sx={{ fontWeight: 800, fontSize: 13, mb: 1 }}>
          Mức sẵn sàng của cấu hình
        </Typography>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <ReadinessRing percent={readiness.percent} />
          <Box>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: 14,
                color: readiness.incomplete
                  ? TOURNAMENT_COLOR.warning
                  : TOURNAMENT_COLOR.success,
              }}
            >
              {readiness.incomplete ? "Chưa hoàn tất" : "Sẵn sàng"}
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted, mt: 0.35 }}>
              {readiness.incomplete
                ? "Vẫn còn một số mục chưa cấu hình hoặc đang tạm khóa."
                : "Các mục cấu hình chính đã đủ trên UI."}
            </Typography>
            {readiness.incomplete ? (
              <Button
                size="small"
                onClick={() => setActiveGroup("ops-infra")}
                sx={{ mt: 0.5, textTransform: "none", fontSize: 11.5, px: 0 }}
              >
                Xem danh sách cần hoàn tất
              </Button>
            ) : null}
          </Box>
        </Stack>
      </Box>

      <Box sx={cardSx}>
        <Typography sx={{ fontWeight: 800, fontSize: 13, mb: 0.5 }}>Lưu gần nhất</Typography>
        <Typography sx={{ fontSize: 12.5 }}>
          {lastSavedAt
            ? new Date(lastSavedAt).toLocaleString("vi-VN")
            : "Chưa có lần lưu trên hồ sơ"}
        </Typography>
        {rulesBootstrapSource ? (
          <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, mt: 0.5 }}>
            Nguồn form: {rulesBootstrapSource}
            {rulesAdoption?.contentRulesSource
              ? ` · ${rulesAdoption.contentRulesSource}`
              : ""}
            {dirty ? " · đang chỉnh nháp" : ""}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );

  return (
    <Box
      data-testid="official-content-format-settings"
      sx={{ width: "100%", minWidth: 0, overflowX: "hidden" }}
    >
      {/* Top settings header — mockup toolbar */}
      <Box
        data-testid="content-settings-toolbar"
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mb: 1.5,
          p: 1.25,
          bgcolor: TOURNAMENT_COLOR.cardBg,
          border: `1px solid ${TOURNAMENT_COLOR.divider}`,
          borderRadius: "8px",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            select
            label="Chọn nội dung"
            value={selectedEventId || eventId || ""}
            onChange={(e) => onSelectEvent?.(e.target.value)}
            sx={{ minWidth: { xs: 160, sm: 200 } }}
          >
            {(events || []).map((ev) => (
              <MenuItem key={ev.id} value={ev.id}>
                {ev.name || EVENT_TYPE_LABELS[ev.eventType] || ev.id}
              </MenuItem>
            ))}
          </TextField>
          <StatusBadge
            label={locked ? "Đã khóa" : "Đang áp dụng"}
            tone={locked ? "warn" : "ok"}
          />
          <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
            ID: {eventId || selectedEventId || "—"}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={outlinedActionSx}
          >
            Quay lại
          </Button>
          <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SaveOutlinedIcon />}
              disabled={busy || locked}
              onClick={onSaveDraft}
              sx={outlinedActionSx}
            >
              Lưu nháp
            </Button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
            <Button
              size="small"
              variant="contained"
              disabled={busy}
              onClick={onUpdate}
              sx={primaryActionSx}
            >
              Cập nhật
            </Button>
          </PermissionGate>
        </Stack>
      </Box>

      {locked ? (
        <Alert severity="warning" sx={{ mb: 1.25 }}>
          {lockReason || "Luật Nội dung đã khóa vì nội dung đang có trận."}
        </Alert>
      ) : null}

      {mobileNav}

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          alignItems: "flex-start",
          gap: { xs: 0, md: 1.5, lg: 2 },
          width: "100%",
          minWidth: 0,
        }}
      >
        {leftNav}

        <Box sx={{ flex: 1, minWidth: 0 }} data-testid="content-settings-center">
          {renderGroupCenter()}
        </Box>

        {isDesktop ? rightSidebar : null}
      </Box>

      {!isDesktop ? rightSidebar : null}
    </Box>
  );
}
