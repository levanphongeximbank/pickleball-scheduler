# 07 — Incident Communication And Postmortem

**Workstream:** PGO-02
**Fresh `origin/main`:** `12a559c1214e980e2f734ef70f308e87b3a66df7`
**Snapshot timestamp:** `2026-07-25T21:00:26+07:00`

## 1. Internal communication

| Audience | Cadence (guidance) | Content |
|----------|--------------------|---------|
| Working channel (IC + engineers) | Continuous during active SEV-1+ | Facts, next action, blockers, evidence links |
| Wider engineering | At classify + major state changes | Severity, blast radius, owning roles, ETA **if known** |
| Module owners impacted | When blast radius touches module | Impacted paths; requested actions |

Tone: factual, short, timestamped. Không suy đoán root cause chưa có evidence.

## 2. Owner update

| SEV | Owner update expectation |
|-----|--------------------------|
| SEV-0 | Immediate + periodic until contained |
| SEV-1 | Prompt after classify; updates on state change |
| SEV-2 | When Production-adjacent or authority needed |
| SEV-3 | Optional unless escalation |

Owner update template (fields):

1. Incident ID / SEV / type
2. Environment + blast radius
3. Current state (detecting/containing/recovering/validating)
4. Decisions needing **Owner GO**
5. Next update time

## 3. Impacted tenant communication

- Chỉ khi có impact tenant thật và Communications Owner + Owner GO đồng ý nội dung (Production).
- Nội dung: factual status, rough impact window, mitigation user có thể làm (nếu có), kênh follow-up.
- **Không** nêu: internal blame, secret, exploit detail, suy đoán pháp lý chưa có counsel.

Nếu không chắc tenant đã bị ảnh hưởng: nói “đang xác minh” — không khẳng định hoặc phủ nhận thiếu evidence.

## 4. Evidence preservation

- Giữ log/alert/deploy IDs/PR links/audit refs.
- Append-only correction notes.
- Không xóa evidence để “dọn”.
- Không paste secret/token/service-role vào postmortem.

## 5. Factual status language

Cho phép: observed symptom, time ranges, systems touched, actions taken, validation results.
Tránh: “chắc do X” không evidence; “user lỗi”; “CI vô dụng nên bỏ gate”.

## 6. No-blame postmortem

Mục tiêu: học hệ thống — không kết án cá nhân.

Bắt buộc có:

| Section | Content |
|---------|---------|
| Summary | 5–10 dòng factual |
| Timeline | detect → close |
| Impact | users/tenants/data/security |
| What went well | |
| What went poorly | process/tooling/gaps |
| Root-cause analysis | proximate + contributing factors |
| Corrective action | fix the immediate class of failure |
| Prevention action | reduce recurrence (monitoring, gate, rehearsal, docs) |
| Follow-ups | owner + due date |
| Closure approval | IC (+ Owner GO for SEV-0/1) |

## 7. Root-cause analysis (discipline)

- Tách: trigger event / detection gap / containment gap / recovery gap.
- Phân class: Platform Governance / Platform Ops / Business Module / External Platform / Owner-deferred.
- Không gắn Competition Engine backlog thành Platform Core root cause nếu evidence là module-owned.

## 8. Corrective vs prevention

| Type | Example class (non-executable here) |
|------|-------------------------------------|
| Corrective | Patch regression; restore from evidenced backup under GO; disable flag under GO |
| Prevention | Add monitoring signal; backup gate enforcement; restore drill scheduling; clarify ownership in PGO |

PGO-02 có thể ghi prevention dưới dạng **documentation/process**; không implement code/CI trong path này.

## 9. Closure approval

| SEV | Closure approver |
|-----|------------------|
| SEV-0 / SEV-1 | Incident Commander **and** Owner GO |
| SEV-2 Production-impacting | IC + Owner GO (or Owner designate) |
| SEV-3 / non-prod limited | IC or module owner |

Incident **closed** ≠ mọi prevention ticket xong — nhưng mọi action phải được assign. Unowned actions = blocker cho readiness certification ([08](./08_PRODUCTION_OPERATIONAL_READINESS_CERTIFICATION.md)).
