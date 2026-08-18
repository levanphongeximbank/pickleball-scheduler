import { useState } from "react";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentIdentitySurface from "../components/TournamentIdentitySurface.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import TournamentStatusChip from "../components/TournamentStatusChip.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import { ChipRow, FixtureAuthorityNote } from "../components/prototypeSurfaces.jsx";
import { OperatorCard } from "../components/prototypeCards.jsx";
import { TOURNAMENT_COLOR, TOURNAMENT_RADIUS } from "../design/tournamentDesignTokens.js";
import { FIXTURE_EVENTS, getFixtureTournament } from "../fixtures/prototypeFixture.js";
import {
  FIXTURE_FORMAT_STEPS,
  FIXTURE_SETTINGS_FEES,
  FIXTURE_SETTINGS_RULES,
  FIXTURE_SETTINGS_SCHEDULE,
} from "../fixtures/opsFixture.js";

const TABS = [
  { id: "info", label: "Thông tin chung" },
  { id: "format", label: "Thiết kế thể thức" },
  { id: "rules", label: "Quy định" },
  { id: "fees", label: "Lệ phí & Giải thưởng" },
  { id: "schedule", label: "Lịch trình" },
];

const EVENT_STATUS = {
  ongoing: "Đang thi đấu",
  soon: "Chưa bắt đầu",
};

function FormatDesigner({ locked = false }) {
  return (
    <Box>
      <TournamentSectionTitle
        action={locked ? <TournamentStatusChip tone="success" label="ĐÃ KHÓA" /> : null}
      >
        Thiết kế thể thức
      </TournamentSectionTitle>
      {locked ? (
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning, mb: 1 }}>
          Các cấu hình ảnh hưởng thi đấu đã được khóa. Nội dung đã bắt đầu thi đấu.
        </Typography>
      ) : null}
      <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted, mb: 1.25 }}>
        32 cặp → 4 bảng × 8 → Top 4 → Vòng 16 → Tứ kết → Bán kết → Chung kết
      </Typography>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        useFlexGap
        sx={{ alignItems: { xs: "stretch", md: "center" }, flexWrap: { xs: "nowrap", md: "wrap" } }}
      >
        {FIXTURE_FORMAT_STEPS.map((step, index) => (
          <Stack
            key={step.id}
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            sx={{ alignItems: { xs: "stretch", md: "center" } }}
          >
            <OperatorCard
              sx={{
                minWidth: { xs: 0, md: 128 },
                textAlign: "center",
                bgcolor: index === 0 ? TOURNAMENT_COLOR.primarySurface : TOURNAMENT_COLOR.cardBg,
                borderColor: index === 0 ? TOURNAMENT_COLOR.primary : TOURNAMENT_COLOR.divider,
              }}
            >
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>Bước {index + 1}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{step.label}</Typography>
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>{step.vi}</Typography>
            </OperatorCard>
            {index < FIXTURE_FORMAT_STEPS.length - 1 ? (
              <ArrowForwardIcon
                sx={{
                  display: { xs: "none", md: "block" },
                  color: TOURNAMENT_COLOR.primary,
                  fontSize: 18,
                }}
              />
            ) : null}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function TournamentInfoForm({ tournament }) {
  return (
    <Stack spacing={1.25}>
      <Grid container spacing={1.25}>
        <Grid size={{ xs: 12, md: 8 }}>
          <TextField size="small" fullWidth label="Tên giải đấu" defaultValue={tournament.name} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField size="small" fullWidth select label="Loại giải" defaultValue={tournament.typeLabel}>
            <MenuItem value="Chính thức / Mở rộng">Chính thức / Mở rộng</MenuItem>
            <MenuItem value="Nội bộ">Nội bộ</MenuItem>
            <MenuItem value="Giải đồng đội">Giải đồng đội</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <TextField size="small" fullWidth label="Cụm sân / Địa điểm" defaultValue={tournament.venue} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField size="small" fullWidth select label="Hiển thị công khai" defaultValue="published">
            <MenuItem value="draft">Nháp — chưa công khai</MenuItem>
            <MenuItem value="published">Công khai — đã công bố</MenuItem>
            <MenuItem value="unlisted">Không liệt kê — chỉ có liên kết</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField size="small" fullWidth label="Ngày bắt đầu" defaultValue="20/09/2026" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField size="small" fullWidth label="Ngày kết thúc" defaultValue="22/09/2026" />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={3}
            label="Mô tả"
            defaultValue="Giải Chính thức / Mở rộng 3 ngày tại Cụm sân Nam Long. 5 nội dung, 12 sân vật lý. Chỉ dữ liệu mẫu."
          />
        </Grid>
      </Grid>
      <Box
        sx={{
          borderRadius: `${TOURNAMENT_RADIUS.card}px`,
          overflow: "hidden",
          border: `1px solid ${TOURNAMENT_COLOR.divider}`,
        }}
      >
        <TournamentIdentitySurface
          height={112}
          gradient={`linear-gradient(120deg, ${TOURNAMENT_COLOR.navy} 0%, #16325C 42%, ${TOURNAMENT_COLOR.primary} 100%)`}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontSize: 11, opacity: 0.75 }}>Ảnh / banner đại diện</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{tournament.name}</Typography>
            <Typography sx={{ fontSize: 12, opacity: 0.9 }}>{tournament.location}</Typography>
          </Box>
        </TournamentIdentitySurface>
      </Box>
    </Stack>
  );
}

function EventInfoForm({ event, locked = false }) {
  return (
    <Grid container spacing={1.25}>
      <Grid size={{ xs: 12, md: 8 }}>
        <TextField size="small" fullWidth label="Tên nội dung" defaultValue={event.name} />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <TextField size="small" fullWidth select label="Trạng thái nội dung" defaultValue={event.status} disabled={locked}>
          <MenuItem value="soon">Chưa bắt đầu</MenuItem>
          <MenuItem value="ongoing">Đang thi đấu</MenuItem>
        </TextField>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField size="small" fullWidth label="Hạng mục" defaultValue={event.category} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
          <TextField size="small" fullWidth label="Trình độ" defaultValue={event.level} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField size="small" fullWidth label="Sức chứa cặp / đội" defaultValue={String(event.pairs)} disabled={locked} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField size="small" fullWidth select label="Thể thức thi đấu" defaultValue={event.format} disabled={locked}>
          <MenuItem value="Group + Knockout">Vòng bảng + Loại trực tiếp</MenuItem>
          <MenuItem value="Knockout">Loại trực tiếp</MenuItem>
        </TextField>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <TextField size="small" fullWidth label="Cách tính điểm" defaultValue={event.scoring} disabled={locked} />
      </Grid>
      {locked ? (
        <Grid size={{ xs: 12 }}>
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning }}>
            Thể thức, cách tính điểm, hạt giống và điều kiện vào vòng trong đã khóa vì nội dung đang thi đấu.
          </Typography>
        </Grid>
      ) : null}
    </Grid>
  );
}

export default function TournamentSettingsPage() {
  const tournament = getFixtureTournament();
  const [scope, setScope] = useState("tournament");
  const [eventId, setEventId] = useState(FIXTURE_EVENTS[0].id);
  const [tab, setTab] = useState("info");
  const event = FIXTURE_EVENTS.find((item) => item.id === eventId);
  const competitionLocked = scope === "event" && event?.status === "ongoing";

  return (
    <TournamentExperienceShell
      title="Cài đặt Giải đấu / Nội dung"
      subtitle="Cài đặt giải đấu tách cài đặt nội dung"
      showEventContext={scope === "event"}
      actions={
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          {competitionLocked ? (
            <Button variant="outlined" size="small">Xem cấu hình</Button>
          ) : (
            <Button variant="outlined" size="small" startIcon={<SaveOutlinedIcon />}>Lưu nháp</Button>
          )}
          <Button variant="outlined" size="small" startIcon={<VisibilityOutlinedIcon />}>Xem trước</Button>
          <Button variant="contained" size="small">
            {competitionLocked ? "Cập nhật thông tin" : "Cập nhật"}
          </Button>
        </Stack>
      }
    >
      <FixtureAuthorityNote>cài đặt này không ghi môi trường thật. Lưu ≠ khóa ≠ công bố.</FixtureAuthorityNote>
      <TournamentWorkspace
        rail={
          <>
            <TournamentRightRailCard title="Phạm vi cấu hình">
              <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mb: 0.75 }}>
                Giải đấu và Nội dung là hai phạm vi riêng.
              </Typography>
              <Stack spacing={0.6}>
                <Typography sx={{ fontSize: 12.5 }}>
                  <strong>Giải đấu</strong> = {tournament.name}
                </Typography>
                <Typography sx={{ fontSize: 12.5 }}>
                  <strong>Nội dung</strong> = {scope === "event" ? event?.name : "Chưa chọn để cấu hình"}
                </Typography>
              </Stack>
            </TournamentRightRailCard>
            {competitionLocked ? (
              <TournamentRightRailCard title="Trạng thái cấu hình">
                <TournamentStatusChip tone="success" label="ĐÃ KHÓA" />
                <Typography sx={{ fontSize: 12.5, mt: 0.75, fontWeight: 700 }}>
                  Nội dung đã bắt đầu thi đấu
                </Typography>
                <Typography sx={{ fontSize: 12.5, mt: 0.5 }}>
                  Các cấu hình ảnh hưởng thi đấu đã được khóa.
                </Typography>
                <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 0.75 }}>
                  Thay đổi sau khi nội dung đã bắt đầu cần quy trình Điều chỉnh / Mở lại và quyền phù hợp.
                </Typography>
              </TournamentRightRailCard>
            ) : (
              <TournamentRightRailCard title="Mức sẵn sàng">
                <TournamentStatusChip tone="info" label="BẢN NHÁP" />
                <Typography sx={{ fontSize: 12.5, mt: 0.75 }}>
                  Thông tin chung đủ để lưu nháp. Thiết kế thể thức chưa khóa.
                </Typography>
              </TournamentRightRailCard>
            )}
            <TournamentRightRailCard title="Tác động">
              <Typography sx={{ fontSize: 12.5 }}>
                {competitionLocked
                  ? "Cấu hình thi đấu đã khóa. Chỉ thông tin không ảnh hưởng thể thức có thể xem / cập nhật thông tin."
                  : "Lưu nháp không công bố công khai, không khóa đăng ký, không khóa bốc thăm."}
              </Typography>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Lưu gần nhất">
              <Typography sx={{ fontSize: 12.5 }}>Nháp dữ liệu mẫu • 18/08/2026 11:40</Typography>
              <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted }}>Chưa Cập nhật chính thức</Typography>
            </TournamentRightRailCard>
          </>
        }
      >
        <ChipRow
          value={scope}
          onChange={setScope}
          items={[
            { id: "tournament", label: "Giải đấu" },
            { id: "event", label: "Nội dung" },
          ]}
        />
        {scope === "event" ? (
          <>
            <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>Chọn nội dung</Typography>
            <ChipRow
              value={eventId}
              onChange={setEventId}
              items={FIXTURE_EVENTS.map((item) => ({ id: item.id, label: item.name }))}
            />
          </>
        ) : null}
        <OperatorCard sx={{ mb: 1.5, bgcolor: TOURNAMENT_COLOR.primarySurface, borderColor: TOURNAMENT_COLOR.primary }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOURNAMENT_COLOR.primary, letterSpacing: 0.4 }}>
            {scope === "tournament" ? "PHẠM VI GIẢI ĐẤU" : "NỘI DUNG THI ĐẤU"}
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>
            {scope === "tournament" ? tournament.name : event?.name}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
            {scope === "tournament"
              ? `${tournament.typeLabel} • ${tournament.venue} • ${tournament.dates}`
              : `${event?.category} ${event?.level} • ${event?.pairs} cặp • ${EVENT_STATUS[event?.status] || event?.status}`}
          </Typography>
        </OperatorCard>
        <Tabs
          value={tab}
          onChange={(_e, value) => setTab(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mb: 1.5, minHeight: 36, "& .MuiTab-root": { textTransform: "none", minHeight: 36 } }}
        >
          {TABS.map((item) => (
            <Tab key={item.id} value={item.id} label={item.label} />
          ))}
        </Tabs>
        {tab === "info" ? (
          scope === "tournament" ? (
            <TournamentInfoForm key="tournament" tournament={tournament} />
          ) : (
            <EventInfoForm key={event.id} event={event} locked={competitionLocked} />
          )
        ) : null}
        {tab === "format" ? <FormatDesigner locked={competitionLocked} /> : null}
        {tab === "rules" ? (
          <Box>
            {competitionLocked ? (
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning, mb: 1 }}>
                Quy định hạt giống, điều kiện vào vòng trong và cách tính điểm đã khóa vì nội dung đang thi đấu.
              </Typography>
            ) : null}
            <Grid container spacing={1.25}>
              {FIXTURE_SETTINGS_RULES.map((rule) => (
                <Grid key={rule.title} size={{ xs: 12, md: 6 }}>
                  <OperatorCard>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{rule.title}</Typography>
                      {competitionLocked ? <TournamentStatusChip tone="success" label="ĐÃ KHÓA" /> : null}
                    </Stack>
                    <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mt: 0.4 }}>{rule.detail}</Typography>
                  </OperatorCard>
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : null}
        {tab === "fees" ? (
          <Grid container spacing={1.25}>
            {FIXTURE_SETTINGS_FEES.map((row) => (
              <Grid key={row.item} size={{ xs: 12, sm: 6 }}>
                <OperatorCard>
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{row.item}</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{row.value}</Typography>
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>{row.note}</Typography>
                </OperatorCard>
              </Grid>
            ))}
          </Grid>
        ) : null}
        {tab === "schedule" ? (
          <Grid container spacing={1.25}>
            {FIXTURE_SETTINGS_SCHEDULE.map((day) => (
              <Grid key={day.day} size={{ xs: 12, md: 4 }}>
                <OperatorCard>
                  <Typography sx={{ fontWeight: 800, mb: 0.75 }}>{day.day}</Typography>
                  {day.blocks.map((block) => (
                    <Typography key={block} sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                      {block}
                    </Typography>
                  ))}
                  <Typography sx={{ fontSize: 11, color: TOURNAMENT_COLOR.textMuted, mt: 0.75 }}>
                    Không phải màn Lịch thi đấu & Phân sân.
                  </Typography>
                </OperatorCard>
              </Grid>
            ))}
          </Grid>
        ) : null}
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}
