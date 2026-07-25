# 02 — Incident Ownership And Escalation

**Workstream:** PGO-02
**Fresh `origin/main`:** `12a559c1214e980e2f734ef70f308e87b3a66df7`
**Snapshot timestamp:** `2026-07-25T21:00:26+07:00`

## 1. Role definitions

| Role | Trách nhiệm chính | Không làm gì |
|------|-------------------|--------------|
| **Incident Commander (IC)** | Điều phối vòng đời incident; quyết định ưu tiên contain/communicate; giữ timeline và decision log | Không tự ý Production mutate nếu chưa có Owner GO khi policy yêu cầu |
| **Technical Lead** | Điều tra kỹ thuật, đề xuất contain/recover options, điều phối engineer | Không bỏ validation fail để “xanh” |
| **Security Owner** | Security / tenant-isolation / credential exposure assessment | Không publish exploit detail trong repo docs |
| **Data Owner** | Đánh giá integrity/loss, backup/restore necessity, data validation criteria | Không chạy restore khi chưa đủ authority + evidence |
| **Communications Owner** | Internal updates, Owner updates, tenant-facing factual status | Không suy đoán root cause chưa có evidence |
| **Business Module Owner** | Sở hữu defect/recovery trong module của mình | Không đẩy mặc định sang Platform Core |
| **External Platform Owner** | Liên hệ/điều phối vendor (Supabase, Vercel, GitHub, …); ghi vendor incident IDs | Không giả định console setting nếu repo không có evidence |
| **Owner GO** | Phê duyệt Production actions, reopen deferred tracks, certification verdicts | Là authority cuối — không bypass |

Một người có thể kiêm nhiều role trên SEV-2/SEV-3 nếu ghi rõ; SEV-0/SEV-1 nên tách IC và Technical Lead khi có thể.

## 2. Ownership classification (PGO-02)

| Class | Ví dụ | Decision default |
|-------|--------|------------------|
| **Platform Governance ownership** | Severity model, escalation policy, readiness certification vocabulary | PGO docs + Owner GO |
| **Platform Operations ownership** | Execute contain/recover under runbook; monitoring/logging ops | Platform ops + IC |
| **Business Module ownership** | Module bugfix, module rollback SQL docs, module staging apply packs | Module owner + Owner GO khi Staging/Production mutate |
| **External Platform ownership** | Vendor outage, PITR plan capability, Vercel rollback UI | External + environment authority |
| **Owner approval** | Production deploy/SQL/secret/restore/rollback; reopen deferred | Owner GO bắt buộc |
| **Deferred workstreams** | Notification Production Phase 2C | **`DEFERRED_BY_OWNER`** — không escalate thành “mở Phase 2C” từ PGO-02 |

## 3. Escalation path

```text
Detector / On-call
  → Acknowledge + provisional classify ([01](./01_INCIDENT_CLASSIFICATION_AND_SEVERITY.md))
  → Assign IC (SEV-2+ recommended; SEV-1/0 required)
  → Domain owners (Module / Security / Data / External) theo type
  → Owner GO  (mọi Production action; SEV-0/1 ngay khi xác nhận)
  → External vendor bridge (nếu external-platform)
```

| Từ | Đến | Trigger |
|----|-----|---------|
| Module owner | IC + Platform ops | Blast radius vượt module hoặc đụng shared identity/tenant boundary |
| Technical Lead | Security Owner | Nghi ngờ security / isolation / credential |
| Technical Lead | Data Owner | Nghi ngờ loss/corruption / restore needed |
| IC | Owner GO | Production change, SEV-0/1, restore/rollback, secret touch |
| Any | External Platform Owner | Vendor outage hoặc capability ngoài repo |
| Any | **Stop** | Đề xuất reopen Notification Phase 2C — giữ `DEFERRED_BY_OWNER` |

## 4. Decision authority

| Decision | Authority tối thiểu |
|----------|---------------------|
| Classify SEV / type | IC (hoặc detector → IC confirm) |
| Containment non-prod | Technical Lead + module/platform ops |
| Staging remote mutate | Track owner + **Owner GO** (PGO-01 §04) |
| Production deploy / env / SQL / RLS | **Owner GO** + environment authority |
| Production restore / PITR / destructive rollback | **Owner GO** + Data Owner + backup/restore authority |
| Feature-flag disable (Production) | Module/Platform owner + **Owner GO** nếu ảnh hưởng Production contract |
| Close incident / postmortem approve | IC + Owner GO (SEV-0/1); IC đủ cho SEV-3 nếu không Production impact |
| Production operational readiness verdict | **Owner GO only** — PGO-02 không tự certify |

## 5. Handoff rules

1. Handoff phải ghi: timestamp, from/to role, open decisions, next action, evidence links.
2. Không handoff bằng chat miệng không có log khi SEV-1+.
3. Khi chuyển từ module → platform IR: giữ nguyên module ticket ID; thêm platform Incident ID.
4. Khi external vendor tham gia: ghi vendor ticket/incident ID — không lưu secret vendor.

## 6. Evidence log (bắt buộc cho SEV-1+)

Mỗi entry tối thiểu:

| Field | Content |
|-------|---------|
| `at` | ISO timestamp |
| `actor_role` | IC / TL / Security / … |
| `action` | observe / decide / escalate / communicate / recover / validate |
| `decision` | short factual |
| `authority` | who approved |
| `evidence_ref` | path / URL / deploy ID / PR — no secrets |

Không xóa hoặc chỉnh sửa lịch sử để làm đẹp; chỉ append correction notes.
