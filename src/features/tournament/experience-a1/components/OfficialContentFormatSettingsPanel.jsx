/**
 * Official Content → Thiết kế thể thức — 7-group settings UI.
 * Presentation + draft editing only. Persistence via parent Save → event.competitionRules.
 */

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Chip,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
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
import {
  TOURNAMENT_COLOR,
} from "../visual/tournamentExperienceTokens.js";

const STAGE_ROWS = [
  { key: "GROUP", label: "Vòng bảng" },
  { key: "ROUND_OF_16", label: "Vòng 16" },
  { key: "QUARTERFINAL", label: "Tứ kết" },
  { key: "SEMIFINAL", label: "Bán kết" },
  { key: "FINAL", label: "Chung kết" },
];

function StatusChip({ label, tone = "muted" }) {
  const color =
    tone === "ok"
      ? TOURNAMENT_COLOR.success
      : tone === "warn"
        ? TOURNAMENT_COLOR.warning
        : TOURNAMENT_COLOR.textMuted;
  return (
    <Chip
      size="small"
      label={label}
      sx={{
        height: 22,
        fontSize: 11,
        bgcolor: "transparent",
        border: `1px solid ${color}`,
        color,
      }}
    />
  );
}

function Section({ id, title, description, badges, children, defaultExpanded = false }) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      data-testid={`content-settings-section-${id}`}
      sx={{
        border: `1px solid ${TOURNAMENT_COLOR.divider}`,
        borderRadius: "8px !important",
        bgcolor: TOURNAMENT_COLOR.cardBg,
        "&:before": { display: "none" },
        mb: 1,
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack spacing={0.35} sx={{ width: "100%", pr: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{title}</Typography>
            {(badges || []).map((badge) => (
              <StatusChip key={badge.label} label={badge.label} tone={badge.tone} />
            ))}
          </Stack>
          <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
            {description}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>{children}</AccordionDetails>
    </Accordion>
  );
}

function Field({ children, size = { xs: 12, sm: 6 } }) {
  return <Grid size={size}>{children}</Grid>;
}

/**
 * @param {{
 *  draft: object,
 *  setDraft: (updater: (prev: object) => object) => void,
 *  eventName: string,
 *  eventType: string,
 *  onEventNameChange: (v: string) => void,
 *  onEventTypeChange: (v: string) => void,
 *  locked: boolean,
 *  lockReason?: string,
 *  scoringCaps?: object,
 *  officialMode?: string,
 * }} props
 */
export default function OfficialContentFormatSettingsPanel({
  draft,
  setDraft,
  eventName,
  eventType,
  onEventNameChange,
  onEventTypeChange,
  locked = false,
  lockReason = "",
  scoringCaps = {},
  officialMode = OFFICIAL_MODE.OPEN,
}) {
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
      // Keep derived wildcard preview consistent
      if (
        path.startsWith("groupStage") ||
        path.startsWith("qualification") ||
        path === "groupCount"
      ) {
        const groupCount = Number(
          path === "groupStage.groupCount" ? value : next.groupStage?.groupCount
        ) || 4;
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

  return (
    <Stack spacing={1.25} data-testid="official-content-format-settings">
      {locked ? (
        <Alert severity="warning">
          {lockReason || "Luật Nội dung đã khóa vì nội dung đang có trận."}
        </Alert>
      ) : null}

      <Section
        id="content-registration"
        title="1. Nội dung & đăng ký"
        description="Một Nội dung chỉ có một hình thức đăng ký (cá nhân hoặc cặp cố định)."
        badges={[{ label: "Content-owned", tone: "ok" }]}
        defaultExpanded
      >
        <Grid container spacing={1.25}>
          <Field>
            <TextField
              size="small"
              fullWidth
              label="Tên Nội dung"
              value={eventName}
              disabled={disabled}
              onChange={(e) => onEventNameChange(e.target.value)}
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Loại thi đấu / giới tính"
              value={eventType}
              disabled={disabled}
              onChange={(e) => onEventTypeChange(e.target.value)}
              helperText="Đơn / Đôi · Nam / Nữ / Nam nữ / Mở"
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Hình thức đăng ký"
              value={draft.registrationMode || OFFICIAL_REGISTRATION_MODE.INDIVIDUAL}
              disabled={disabled || aiBalance}
              onChange={(e) => patch("registrationMode", e.target.value)}
              helperText={
                aiBalance
                  ? "AI Balance chỉ nhận đăng ký cá nhân."
                  : "Không trộn cá nhân + cặp trên cùng Nội dung."
              }
            >
              <MenuItem value={OFFICIAL_REGISTRATION_MODE.INDIVIDUAL}>Cá nhân</MenuItem>
              <MenuItem value={OFFICIAL_REGISTRATION_MODE.PAIR} disabled={aiBalance}>
                Cặp cố định
              </MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label={
                draft.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR
                  ? "Sức chứa tối đa (cặp)"
                  : "Sức chứa tối đa (VĐV)"
              }
              value={
                draft.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR
                  ? draft.capacity?.maxPairs ?? ""
                  : draft.capacity?.maxParticipants ?? ""
              }
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
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Trình độ tối thiểu"
              value={draft.eligibility?.minLevel ?? ""}
              disabled={disabled}
              onChange={(e) =>
                patch("eligibility.minLevel", e.target.value === "" ? null : e.target.value)
              }
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Trình độ tối đa"
              value={draft.eligibility?.maxLevel ?? ""}
              disabled={disabled}
              onChange={(e) =>
                patch("eligibility.maxLevel", e.target.value === "" ? null : e.target.value)
              }
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Rating tối thiểu"
              value={draft.eligibility?.minRating ?? ""}
              disabled={disabled}
              onChange={(e) =>
                patch("eligibility.minRating", e.target.value === "" ? null : e.target.value)
              }
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Rating tối đa"
              value={draft.eligibility?.maxRating ?? ""}
              disabled={disabled}
              onChange={(e) =>
                patch("eligibility.maxRating", e.target.value === "" ? null : e.target.value)
              }
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Seeding"
              value={draft.seedingPolicy || "NONE"}
              disabled={disabled}
              onChange={(e) => patch("seedingPolicy", e.target.value)}
              helperText="Chính sách Nội dung (không tạo authority ghép cặp mới)."
            >
              <MenuItem value="NONE">Không seed</MenuItem>
              <MenuItem value="MANUAL">Thủ công</MenuItem>
              <MenuItem value="RANKING">Theo xếp hạng</MenuItem>
              <MenuItem value="RATING">Theo rating</MenuItem>
            </TextField>
          </Field>
        </Grid>
      </Section>

      <Section
        id="structure"
        title="2. Cấu trúc thi đấu"
        description="Vòng bảng, suất đi tiếp, knockout — theo Nội dung đang chọn."
        badges={[
          { label: "Wildcard tính tự động", tone: "ok" },
          { label: "Admission PR#459 chờ", tone: "warn" },
        ]}
        defaultExpanded
      >
        <Grid container spacing={1.25}>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Có vòng bảng"
              value={draft.groupStage?.groupStageEnabled !== false ? "yes" : "no"}
              disabled={disabled}
              onChange={(e) =>
                patch("groupStage.groupStageEnabled", e.target.value === "yes")
              }
            >
              <MenuItem value="yes">Có</MenuItem>
              <MenuItem value="no">Không</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Số bảng"
              value={groupCount}
              disabled={disabled}
              onChange={(e) => patch("groupStage.groupCount", Number(e.target.value) || 1)}
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Tối đa đơn vị / bảng"
              value={draft.groupStage?.maxUnitsPerGroup ?? ""}
              disabled={disabled}
              onChange={(e) =>
                patch(
                  "groupStage.maxUnitsPerGroup",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Round-robin"
              value="SINGLE"
              disabled
              helperText="Double RR chưa hỗ trợ runtime Official."
            >
              <MenuItem value="SINGLE">Một lượt (SINGLE)</MenuItem>
              <MenuItem value="DOUBLE" disabled>
                Hai lượt (chưa sẵn sàng)
              </MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Cho phép bảng lệch"
              value={draft.groupStage?.allowUnevenGroups !== false ? "yes" : "no"}
              disabled={disabled}
              onChange={(e) =>
                patch("groupStage.allowUnevenGroups", e.target.value === "yes")
              }
            >
              <MenuItem value="yes">Có</MenuItem>
              <MenuItem value="no">Không</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Suất thẳng / bảng"
              value={directQ}
              disabled={disabled}
              onChange={(e) =>
                patch(
                  "qualification.directQualifiersPerGroup",
                  Number(e.target.value) || 1
                )
              }
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Tổng suất knockout"
              value={totalQ}
              disabled={disabled}
              onChange={(e) =>
                patch("qualification.totalQualifiers", Number(e.target.value) || 1)
              }
            />
          </Field>
          <Field size={{ xs: 12 }}>
            <Alert severity="info" sx={{ py: 0.5 }}>
              {groupCount} bảng × {directQ} suất thẳng = {groupCount * directQ}. Tổng suất
              knockout = {totalQ} → Wildcard = {wildcard}
              {wildcard > 0
                ? " (xếp hạng chéo bảng: khóa thực thi / fail-closed)."
                : "."}
            </Alert>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Có nhánh knockout"
              value={draft.knockout?.knockoutEnabled !== false ? "yes" : "no"}
              disabled={disabled}
              onChange={(e) =>
                patch("knockout.knockoutEnabled", e.target.value === "yes")
              }
            >
              <MenuItem value="yes">Có</MenuItem>
              <MenuItem value="no">Không</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Ghép cặp knockout"
              value={draft.knockout?.pairingPolicy || "CROSS_GROUP"}
              disabled={disabled}
              onChange={(e) => patch("knockout.pairingPolicy", e.target.value)}
            >
              <MenuItem value="CROSS_GROUP">Chéo bảng</MenuItem>
              <MenuItem value="SEEDED">Theo seed</MenuItem>
              <MenuItem value="RANDOM">Ngẫu nhiên</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Tránh cùng bảng vòng 1 KO"
              value={draft.knockout?.avoidSameGroupFirstRound !== false ? "yes" : "no"}
              disabled={disabled}
              onChange={(e) =>
                patch("knockout.avoidSameGroupFirstRound", e.target.value === "yes")
              }
            >
              <MenuItem value="yes">Có</MenuItem>
              <MenuItem value="no">Không</MenuItem>
            </TextField>
          </Field>
          <Field size={{ xs: 12 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <StatusChip label="Bypass vòng bảng: chưa sẵn sàng (PR #459)" tone="warn" />
              <StatusChip label="Direct KO entry: chưa sẵn sàng" tone="warn" />
              <StatusChip label="Bye: chưa sẵn sàng" tone="warn" />
            </Stack>
          </Field>
        </Grid>
      </Section>

      <Section
        id="match-rules"
        title="3. Luật trận đấu"
        description="Rule cơ sở của Nội dung + bảng điểm theo giai đoạn (không kế thừa Tournament)."
        badges={[
          { label: scoringCaps.sideOut ? "Side-out chọn được" : "Side-out khóa", tone: scoringCaps.sideOut ? "ok" : "warn" },
          { label: "BO3 chưa sẵn sàng", tone: "warn" },
        ]}
        defaultExpanded
      >
        <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>Rule cơ sở</Typography>
        <Grid container spacing={1.25}>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Cách tính điểm"
              value={draft.matchScoring?.scoringMethod || OFFICIAL_SCORING_METHOD.RALLY}
              disabled={disabled}
              onChange={(e) => patch("matchScoring.scoringMethod", e.target.value)}
            >
              <MenuItem value={OFFICIAL_SCORING_METHOD.RALLY}>Rally</MenuItem>
              <MenuItem
                value={OFFICIAL_SCORING_METHOD.SIDE_OUT}
                disabled={!SIDEOUT_OPERATIONAL || scoringCaps.sideOut !== true}
              >
                Side-out
              </MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Thể thức trận"
              value={draft.matchScoring?.matchFormat || OFFICIAL_MATCH_FORMAT.BEST_OF_1}
              disabled={disabled}
              onChange={(e) => patch("matchScoring.matchFormat", e.target.value)}
            >
              <MenuItem value={OFFICIAL_MATCH_FORMAT.BEST_OF_1}>Best of 1</MenuItem>
              <MenuItem
                value={OFFICIAL_MATCH_FORMAT.BEST_OF_3}
                disabled={!BEST_OF_3_OPERATIONAL || scoringCaps.bestOf3 !== true}
              >
                Best of 3 (chưa sẵn sàng)
              </MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Điểm đích (cơ sở)"
              value={draft.matchScoring?.targetPoints ?? 11}
              disabled={disabled}
              onChange={(e) =>
                patch("matchScoring.targetPoints", Number(e.target.value) || 11)
              }
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Win-by"
              value={draft.matchScoring?.winCondition?.winByEnabled !== false ? "on" : "off"}
              disabled={disabled || scoringCaps.winBy !== true}
              onChange={(e) =>
                patch("matchScoring.winCondition.winByEnabled", e.target.value === "on")
              }
            >
              <MenuItem value="on">Bật</MenuItem>
              <MenuItem value="off">Tắt</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Win-by margin"
              value={draft.matchScoring?.winCondition?.winByMargin ?? 2}
              disabled={
                disabled ||
                draft.matchScoring?.winCondition?.winByEnabled === false ||
                scoringCaps.winBy !== true
              }
              onChange={(e) =>
                patch(
                  "matchScoring.winCondition.winByMargin",
                  Number(e.target.value) || 2
                )
              }
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Point cap"
              value={draft.matchScoring?.winCondition?.pointCapEnabled === true ? "on" : "off"}
              disabled={disabled}
              onChange={(e) =>
                patch(
                  "matchScoring.winCondition.pointCapEnabled",
                  e.target.value === "on"
                )
              }
            >
              <MenuItem value="on">Bật</MenuItem>
              <MenuItem value="off">Tắt</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Point cap (điểm)"
              value={draft.matchScoring?.winCondition?.pointCap ?? ""}
              disabled={disabled || !draft.matchScoring?.winCondition?.pointCapEnabled}
              onChange={(e) =>
                patch(
                  "matchScoring.winCondition.pointCap",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
            />
          </Field>
        </Grid>

        <Typography sx={{ fontWeight: 700, fontSize: 13, mt: 2, mb: 1 }}>
          Điểm theo giai đoạn
        </Typography>
        <Stack spacing={1}>
          {STAGE_ROWS.map((row) => {
            const stage = draft.stageOverrides?.[row.key] || { inheritBase: true };
            const effectiveInherit = stage.inheritBase !== false;
            return (
              <Grid container spacing={1} key={row.key} alignItems="center">
                <Grid size={{ xs: 12, sm: 2 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{row.label}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    size="small"
                    fullWidth
                    select
                    label="Nguồn"
                    value={effectiveInherit ? "base" : "override"}
                    disabled={disabled}
                    onChange={(e) =>
                      updateStage(row.key, "inheritBase", e.target.value === "base")
                    }
                  >
                    <MenuItem value="base">Dùng rule cơ sở</MenuItem>
                    <MenuItem value="override">Ghi đè giai đoạn</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    label="Điểm"
                    value={
                      effectiveInherit
                        ? draft.matchScoring?.targetPoints ?? 11
                        : stage.targetPoints ?? draft.matchScoring?.targetPoints ?? 11
                    }
                    disabled={disabled || effectiveInherit}
                    onChange={(e) =>
                      updateStage(row.key, "targetPoints", Number(e.target.value) || 11)
                    }
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    label="Win-by"
                    value={
                      effectiveInherit
                        ? draft.matchScoring?.winCondition?.winByMargin ?? 2
                        : stage.winCondition?.winByMargin ?? 2
                    }
                    disabled={disabled || effectiveInherit}
                    onChange={(e) =>
                      updateStage(
                        row.key,
                        "winCondition.winByMargin",
                        Number(e.target.value) || 2
                      )
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    label="Cap"
                    value={
                      effectiveInherit
                        ? draft.matchScoring?.winCondition?.pointCap ?? ""
                        : stage.winCondition?.pointCap ?? ""
                    }
                    disabled={disabled || effectiveInherit}
                    onChange={(e) =>
                      updateStage(
                        row.key,
                        "winCondition.pointCap",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                    helperText={
                      effectiveInherit
                        ? "Hiệu lực = rule cơ sở Nội dung"
                        : "Ghi đè giai đoạn"
                    }
                  />
                </Grid>
              </Grid>
            );
          })}
        </Stack>
      </Section>

      <Section
        id="change-end"
        title="4. Đổi bên"
        description="Đổi đầu sân / đổi bên trong trận — không phải đổi sân vật lý (Court 1 → Court 2)."
        badges={[{ label: "Execution partial", tone: "warn" }]}
      >
        <Grid container spacing={1.25}>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Bật đổi bên"
              value={draft.matchScoring?.changeEnd?.changeEndsEnabled === true ? "on" : "off"}
              disabled={disabled || scoringCaps.changeEnd !== true}
              onChange={(e) =>
                patch("matchScoring.changeEnd.changeEndsEnabled", e.target.value === "on")
              }
              helperText={
                scoringCaps.changeEnd === true
                  ? "Policy có thể lưu; runtime vẫn partial."
                  : "Chưa vận hành đầy đủ — chỉ lưu policy."
              }
            >
              <MenuItem value="on">Bật</MenuItem>
              <MenuItem value="off">Tắt</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Đổi bên tại điểm"
              value={draft.matchScoring?.changeEnd?.changeEndsAtPoints ?? ""}
              disabled={disabled || !draft.matchScoring?.changeEnd?.changeEndsEnabled}
              onChange={(e) =>
                patch(
                  "matchScoring.changeEnd.changeEndsAtPoints",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              helperText="VD: 11→6 · 15→8 · 21→11"
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Đổi bên giữa các ván"
              value={
                draft.matchScoring?.changeEnd?.changeEndsBetweenGames !== false
                  ? "yes"
                  : "no"
              }
              disabled={disabled}
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
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Ván quyết định đổi tại"
              value={draft.matchScoring?.changeEnd?.decidingGameChangeEndsAt ?? ""}
              disabled={disabled}
              onChange={(e) =>
                patch(
                  "matchScoring.changeEnd.decidingGameChangeEndsAt",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
            />
          </Field>
        </Grid>
      </Section>

      <Section
        id="ranking"
        title="5. Xếp hạng & đi tiếp"
        description="Chỉ cấu hình chính sách. Engine canonical/domain tính toán — UI không tính."
        badges={[
          { label: "In-group policy", tone: "ok" },
          { label: "Wildcard execution khóa", tone: "warn" },
        ]}
      >
        <Grid container spacing={1.25}>
          <Field size={{ xs: 12 }}>
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
              Thứ tự tie-break trong bảng (mặc định): thắng trận → đối đầu → hiệu số → điểm ghi →
              bốc thăm. Hòa nhiều đội: mini-table.
            </Typography>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Hòa nhiều đội"
              value={draft.inGroupTieBreak?.multiWayRequiresMiniTable !== false ? "mini" : "skip"}
              disabled={disabled}
              onChange={(e) =>
                patch(
                  "inGroupTieBreak.multiWayRequiresMiniTable",
                  e.target.value === "mini"
                )
              }
            >
              <MenuItem value="mini">Mini-table</MenuItem>
              <MenuItem value="skip">Sang tiêu chí tiếp</MenuItem>
            </TextField>
          </Field>
          <Field size={{ xs: 12 }}>
            <Alert severity={wildcard > 0 ? "warning" : "info"}>
              Wildcard slots = {wildcard}. Khi &gt; 0 dùng metric chuẩn hóa (win%, hiệu số/trận…) —
              không so tổng thắng thô giữa bảng lệch. Thực thi xếp hạng chéo bảng hiện fail-closed.
            </Alert>
          </Field>
        </Grid>
      </Section>

      <Section
        id="ops"
        title="6. Vận hành trận"
        description="Walkover / Retired / Late / Withdrawal / Substitution / Check-in — policy Nội dung."
        badges={[{ label: "Policy partial", tone: "warn" }]}
      >
        <Grid container spacing={1.25}>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Late — ngưỡng (phút)"
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
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Withdrawal — kết quả trước"
              value={
                draft.walkover?.withdrawalPolicy || "KEEP_COMPLETED_AND_WO_REMAINING"
              }
              disabled={disabled}
              onChange={(e) => patch("walkover.withdrawalPolicy", e.target.value)}
            >
              <MenuItem value="KEEP_COMPLETED_AND_WO_REMAINING">
                Giữ kết quả xong · WO trận còn lại
              </MenuItem>
              <MenuItem value="KEEP_COMPLETED_RESULTS">Giữ kết quả đã xong</MenuItem>
              <MenuItem value="VOID_ALL_RESULTS">Hủy mọi kết quả</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Check-in bắt buộc"
              value={draft.checkIn?.checkInRequired === true ? "yes" : "no"}
              disabled={disabled}
              onChange={(e) =>
                patch("checkIn.checkInRequired", e.target.value === "yes")
              }
            >
              <MenuItem value="yes">Có</MenuItem>
              <MenuItem value="no">Không</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Đóng check-in trước trận (phút)"
              value={draft.checkIn?.checkInCloseMinutesBeforeStart ?? 30}
              disabled={disabled || !draft.checkIn?.checkInRequired}
              onChange={(e) =>
                patch(
                  "checkIn.checkInCloseMinutesBeforeStart",
                  Number(e.target.value) || 0
                )
              }
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Thiếu check-in"
              value={draft.checkIn?.noCheckInPolicy || "WARN"}
              disabled={disabled}
              onChange={(e) => patch("checkIn.noCheckInPolicy", e.target.value)}
            >
              <MenuItem value="WARN">Cảnh báo</MenuItem>
              <MenuItem value="BLOCK_START">Chặn bắt đầu</MenuItem>
              <MenuItem value="DIRECTOR_REVIEW">BTC xem xét</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Thay người (substitution)"
              value={draft.substitution?.allowed === true ? "yes" : "no"}
              disabled={disabled}
              onChange={(e) =>
                patch("substitution.allowed", e.target.value === "yes")
              }
              helperText="Policy only — chưa có runtime thay người đầy đủ."
            >
              <MenuItem value="yes">Cho phép</MenuItem>
              <MenuItem value="no">Không</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Hạn thay người"
              value={draft.substitution?.deadline || "BEFORE_DRAW"}
              disabled={disabled || !draft.substitution?.allowed}
              onChange={(e) => patch("substitution.deadline", e.target.value)}
            >
              <MenuItem value="BEFORE_DRAW">Trước bốc thăm</MenuItem>
              <MenuItem value="BEFORE_FIRST_MATCH">Trước trận đầu</MenuItem>
              <MenuItem value="EMERGENCY_ONLY">Khẩn cấp</MenuItem>
            </TextField>
          </Field>
        </Grid>
      </Section>

      <Section
        id="ops-infra"
        title="7. Sân, trọng tài, lịch & công bố"
        description="Chỉ chính sách. Không gán sân vật lý / không gán trọng tài tại đây."
        badges={[
          { label: "Court = policy", tone: "ok" },
          { label: "CORE-13 assignment", tone: "ok" },
        ]}
      >
        <Grid container spacing={1.25}>
          <Field>
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
              helperText="Không gán Court ID tại Settings."
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Trọng tài vòng bảng"
              value={draft.refereeRequirement?.byStage?.GROUP || "OPTIONAL"}
              disabled={disabled}
              onChange={(e) =>
                patch("refereeRequirement.byStage.GROUP", e.target.value)
              }
            >
              <MenuItem value="OPTIONAL">Tùy chọn</MenuItem>
              <MenuItem value="REQUIRED">Bắt buộc</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Trọng tài bán kết"
              value={draft.refereeRequirement?.byStage?.SEMIFINAL || "REQUIRED"}
              disabled={disabled}
              onChange={(e) =>
                patch("refereeRequirement.byStage.SEMIFINAL", e.target.value)
              }
            >
              <MenuItem value="OPTIONAL">Tùy chọn</MenuItem>
              <MenuItem value="REQUIRED">Bắt buộc</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Trọng tài chung kết"
              value={draft.refereeRequirement?.byStage?.FINAL || "REQUIRED"}
              disabled={disabled}
              onChange={(e) =>
                patch("refereeRequirement.byStage.FINAL", e.target.value)
              }
            >
              <MenuItem value="REQUIRED">Bắt buộc</MenuItem>
            </TextField>
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Thời lượng slot (phút)"
              value={draft.scheduleConstraints?.estimatedMatchDurationMinutes ?? 45}
              disabled={disabled}
              onChange={(e) =>
                patch(
                  "scheduleConstraints.estimatedMatchDurationMinutes",
                  Number(e.target.value) || 45
                )
              }
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Nghỉ tối thiểu giữa trận (phút)"
              value={draft.scheduleConstraints?.minimumRestMinutes ?? 15}
              disabled={disabled}
              onChange={(e) =>
                patch(
                  "scheduleConstraints.minimumRestMinutes",
                  Number(e.target.value) || 0
                )
              }
            />
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Công bố kết quả"
              value={
                draft.publication?.resultsPublicationPolicy || "AFTER_ACCEPTED_RESULT"
              }
              disabled={disabled}
              onChange={(e) =>
                patch("publication.resultsPublicationPolicy", e.target.value)
              }
            >
              <MenuItem value="AFTER_ACCEPTED_RESULT">
                Tự sau CORE-17 accepted
              </MenuItem>
              <MenuItem value="DIRECTOR_APPROVAL">Cần BTC duyệt</MenuItem>
            </TextField>
          </Field>
          <Field>
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
          </Field>
          <Field>
            <TextField
              size="small"
              fullWidth
              select
              label="Công bố bracket"
              value={draft.publication?.bracketPublicationPolicy || "DIRECTOR_APPROVAL"}
              disabled={disabled}
              onChange={(e) =>
                patch("publication.bracketPublicationPolicy", e.target.value)
              }
            >
              <MenuItem value="IMMEDIATE">Khi tạo</MenuItem>
              <MenuItem value="DIRECTOR_APPROVAL">Sau BTC duyệt</MenuItem>
            </TextField>
          </Field>
        </Grid>
      </Section>

      <Typography sx={{ fontSize: 11.5, color: TOURNAMENT_COLOR.textMuted }}>
        Lifecycle lock do hệ thống áp theo Nội dung (không chỉnh tay trên màn này).
      </Typography>
    </Stack>
  );
}
