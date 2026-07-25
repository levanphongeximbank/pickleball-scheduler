# 06 — Alert Severity, Routing And Escalation

**Workstream:** PGO-03
**Fresh `origin/main`:** `0b71e2a7d3a127cc2d6a7520c9a705bed77f2501`
**Snapshot timestamp:** `2026-07-25T22:35:46+07:00`
**Rule:** Alert ≠ incident cho đến khi được xác nhận theo PGO-02. Production response yêu cầu authority phù hợp (PGO-01 §04 / PGO-02 §02).

## 1. Alert severity model

| Alert severity | Meaning | Typical response |
|----------------|---------|------------------|
| **INFO** | Informational signal; no immediate page | Log / ticket / dashboard notice |
| **WARNING** | Degraded or rising risk; needs timely attention | Ack within ops window; investigate |
| **CRITICAL** | Severe availability/security/data risk signal | Immediate ack; escalate; evaluate incident |

Alert severity **không** tự gán SEV-0…3. Mapping ở §5.

## 2. Alert lifecycle controls

| Control | Định nghĩa | Owner |
|---------|------------|-------|
| **Acknowledgment** | Người chịu trách nhiệm xác nhận đang xử lý alert | On-call / Platform Ops / Module owner |
| **Deduplication** | Gộp firings trùng rule + window | Alert rule owner |
| **Suppression** | Tạm không page theo điều kiện (ví dụ known dependent outage) | Platform Ops + IC if incident open |
| **Maintenance window** | Cửa sổ đổi config/deploy được ghi nhận — suppress expected noise | Deployment authority + Platform Ops; **Owner GO** for Production windows |
| **Routing** | Ai nhận alert (channel/role) | Platform Ops / Security / Module per rule |
| **Escalation** | Tăng cấp nếu không ack hoặc impact tăng | Align PGO-02 escalation path |

## 3. Routing classes

| Alert class | Primary route | Escalate to |
|-------------|---------------|-------------|
| Platform availability / health | Platform Operations | IC → Owner GO (Production) |
| Security / auth anomaly / isolation | Security Owner | Owner GO + IC |
| Module feature error rate | Business Module Owner | IC if blast radius expands |
| External vendor signal | External Platform Owner | IC + environment authority |
| CI/verify gate noise | CI/Foundation owner | **Not** Production page by default |
| Notification Phase 2C related | **Do not reopen track** | Keep **`DEFERRED_BY_OWNER`** |

## 4. Alert vs incident (hard rule)

```text
Alert firing
  → Acknowledge
  → Triage impact with evidence
  → IF confirmed operational incident criteria (PGO-02)
       THEN create/attach Incident record (SEV-0…3)
  → ELSE resolve alert / ticket without incident inflation
```

- Auto-open incident từ mọi CRITICAL alert **không** bắt buộc.
- Tắt kiểm tra / xóa evidence để “xanh” **bị cấm** (PGO-02).

## 5. Mapping alert → PGO-02 SEV (guidance)

| Alert signal (examples) | Provisional SEV if **confirmed** | Notes |
|-------------------------|----------------------------------|-------|
| Total Production outage / data-loss / isolation breach indicators | **SEV-0** | Owner GO + IC immediately |
| Major Production path down, multi-tenant | **SEV-1** | Escalate per PGO-02 |
| Degraded with workaround; limited blast radius | **SEV-2** | Module/Platform ops |
| Hygiene / single-user / non-prod noise | **SEV-3** or no incident | Avoid over-escalation |
| INFO alerts | Usually no SEV | Ticket only |

Template module P0/P1/P2 (ví dụ TT-9) vẫn là **module evidence** — map sang SEV khi escalate platform IR (PGO-02 §01).

## 6. Production response authority

| Action | Authority tối thiểu |
|--------|---------------------|
| Ack WARNING in Production | Platform Ops / Module owner |
| CRITICAL Production page → contain change | IC + Technical Lead; **Owner GO** for Production mutate |
| Change alert thresholds in Production | Platform Ops + **Owner GO** if paging/contract impact |
| Declare incident SEV-0/1 | IC + Owner GO notify |
| Close CRITICAL without incident when false positive | Document evidence; IC/ops sign-off |

## 7. Repository evidence notes

- PGO-02 readiness: “Monitoring evidence” = **GAP / NOT ASSUMED**.
- No in-repo platform alert-rule SSOT or paging integration evidenced in this audit.
- Module injectables (e.g. TT realtime observability) ≠ platform alerting program.

## 8. Explicit non-actions

- PGO-03 không cấu hình PagerDuty/Slack/email alert channels.
- PGO-03 không bật Vercel/Supabase alerting.
- PGO-03 không tự mở incident Production.
- Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.
