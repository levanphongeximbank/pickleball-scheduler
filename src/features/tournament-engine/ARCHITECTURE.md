# Tournament Engine 4.0 — Sprint 5

**Trạng thái:** Module mới song song `src/tournament/engines/` (legacy). Không thay route setup cũ.

## Nguyên tắc

1. **AI = heuristic nội bộ** — scoring, weighting, validation, explain. Không gọi API bên ngoài.
2. **Logic tách khỏi UI** — React chỉ gọi facade `run*Engine()`.
3. **Không phá dữ liệu cũ** — state engine lưu `tournament.settings.engineV4`; áp dụng vào `events[]` khi user bấm "Áp dụng vào giải".
4. **Legacy wrap** — draw/schedule tái dùng `seededGroupEngine`, `scheduleEngine` khi cần fallback.

## Cấu trúc

```
src/features/tournament-engine/
├── constants/defaults.js
├── types/tournamentTypes.js
├── validation/tournamentValidation.js
├── engines/
│   ├── seedEngine.js
│   ├── drawEngine.js
│   ├── scheduleEngine.js
│   ├── courtAssignmentEngine.js
│   ├── timePredictionEngine.js
│   └── rankingEngine.js
├── orchestrator/tournamentEngine.js   # facade + full pipeline
├── services/
│   ├── tournamentEngineAdapter.js
│   └── engineRunLog.js
└── hooks/useTournamentEngine.js
```

## Pipeline

Seed → Draw → Schedule → Court Assignment → Time Prediction → Ranking

Mỗi bước trả `{ ok, data, score?, warnings, errors?, explain }`.

## Routes UI

| Route | Tab |
|-------|-----|
| `/tournaments/:id/engine` | Thiết lập |
| `/tournaments/:id/seed` | Hạt giống |
| `/tournaments/:id/draw` | Bốc thăm |
| `/tournaments/:id/schedule` | Lịch đấu |
| `/tournaments/:id/courts` | Sân |
| `/tournaments/:id/ranking` | Xếp hạng |
| `/tournaments/:id/logs` | Nhật ký |

## DB / Supabase (Sprint 6 đề xuất)

Schema đề xuất: `tournament_participants`, `tournament_groups`, `tournament_matches`, `tournament_rankings`, `tournament_engine_runs`. Sprint 5 dùng localStorage + blob giải hiện có.

## Tests

`tests/tournament-engine.test.js`
