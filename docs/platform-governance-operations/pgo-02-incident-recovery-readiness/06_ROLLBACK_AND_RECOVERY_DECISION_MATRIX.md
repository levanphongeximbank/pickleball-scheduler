# 06 — Rollback And Recovery Decision Matrix

**Workstream:** PGO-02
**Fresh `origin/main`:** `12a559c1214e980e2f734ef70f308e87b3a66df7`
**Snapshot timestamp:** `2026-07-25T21:00:26+07:00`
**Rule:** Chỉ mô tả **khi nào / ai / cần evidence gì**. **Không** cung cấp lệnh deploy, database rollback execution, hoặc secret mutation.

## Decision matrix

| Option | Khi cân nhắc | Authority tối thiểu | Required evidence | Prohibited |
|--------|--------------|---------------------|-------------------|------------|
| **Application rollback** | Bug nằm ở app bundle đã ship; data schema tương thích bản trước | Deployment authority + **Owner GO** (Production) | Prior deployment ID/status; impact notes; validate plan | Hotfix Production không GO; xóa deployment history |
| **Deployment rollback** | Deploy mới gây outage/regression rõ | Deployment authority (Vercel Git Integration path) + **Owner GO** (Production) | Deploy diff summary; time-to-detect; smoke plan | Force-push để “rollback git” thay cho quy trình deploy; bypass CI để xanh giả |
| **Configuration rollback** | Lỗi do env/flag/config | Secret/config authority + **Owner GO** (Production) | Config change timeline (names only); expected prior state | Commit secret values; rotate secrets trong incident docs |
| **Database rollback** | Corruption/loss trong DB; schema/data cần reverse | Data Owner + **Owner GO** + External Platform Owner nếu vendor restore | Backup evidence; blast radius; validation queries list (no secrets) | Restore Production “thử”; drop toàn DB khi có scoped option chưa xét |
| **Migration rollback** | Migration/SQL apply gây lỗi; có paired rollback doc | Track/module owner + **Owner GO** | Paired `*-rollback.sql` / rollback doc path; pre-apply backup gate status | Chạy rollback SQL từ PGO-02; apply rollback khi đã có data phụ thuộc chưa đánh giá |
| **Feature-flag disablement** | Feature mới gây hại; flag tồn tại | Module/Platform owner + **Owner GO** nếu Production contract | Flag name; default/safe state; affected tenants | Coi flag disable là đủ khi data đã corrupt |
| **Partial recovery** | Chỉ một tenant/module/path ảnh hưởng | IC + domain owner + Owner GO nếu Production mutate | Scope boundaries; non-impact proof plan | Mở rộng scope “tiện tay” không evidence |
| **Forward fix** | Rollback rủi ro cao hơn; root cause rõ và fix nhỏ an toàn | Technical Lead + module owner + **Owner GO** (Production) | Root-cause note; test/validate evidence; rollback fallback still identified | Forward fix để tránh postmortem; skip validation |
| **External platform recovery** | Vendor outage hoặc chỉ vendor có thể restore | External Platform Owner + Owner GO (Production) | Vendor status/incident ID; dependency map | Giả định vendor đã restore khi chưa confirm |

## Authority summary

```text
Non-prod exploratory rollback docs review  → module/platform ops
Staging remote rollback/restore            → Owner GO + Data/Module owners
Production any rollback/restore/config     → Owner GO (+ listed domain owners)
PGO-02 workstream                          → documentation only (no execution)
```

## Required evidence (all Production options)

1. Incident ID + SEV + type.
2. Chosen option + rejected alternatives (short).
3. Authority approvals (roles).
4. Pre-state evidence (deploy ID / backup id / config names).
5. Validation criteria and results.
6. Communication record ([07](./07_INCIDENT_COMMUNICATION_AND_POSTMORTEM.md)).

## Prohibited actions (global)

- Không chạy rollback/deploy/migration từ PGO-02.
- Không cung cấp/ghi secret values.
- Không force push / reset / clean / stash để “sửa lịch sử”.
- Không thay CI/Production gates để giấu regression.
- Không xóa log.
- Không mở Notification Production Phase 2C (`DEFERRED_BY_OWNER`).
- Không coi module rollback pack thiếu rehearsal là Platform Core defect.

## Mapping to existing repo artifacts (read-only)

| Artifact class | Examples on tree / tip | Role in matrix |
|----------------|------------------------|----------------|
| Deploy rollback guidance | `DEPLOYMENT_GUIDE.md` § Rollback (Vercel redeploy prior) | Application/deployment option pointer |
| SQL rollback packs | `docs/**/**rollback*.sql`, module `*_ROLLBACK.md` | Migration rollback **docs** — execution needs GO |
| Backup gates | COMMS-ACT-01 backup gate; rating backup checklist | Prerequisite evidence for DB rollback/restore |
| CI vs deploy | PGO-01 §05 | Deployment rollback ≠ failing CI greenwash |

## Choosing between rollback and forward fix (policy)

1. Nếu data-loss / tenant-isolation → ưu tiên contain + Data/Security assessment trước mọi rollback rộng.
2. Nếu chỉ app regression và prior deploy healthy → deployment/application rollback thường ưu tiên hơn schema churn.
3. Nếu migration đã ghi data mới phụ thuộc → forward fix hoặc scoped compensating action có thể an toàn hơn destructive rollback.
4. Nếu vendor outage → external recovery; không “fix” bằng cách sửa business rules trong PGO.
