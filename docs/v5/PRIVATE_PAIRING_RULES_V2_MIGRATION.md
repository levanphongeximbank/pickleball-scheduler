# Private Pairing Rules Engine V2 — Migration Plan

| Field | Value |
|-------|-------|
| Status | PR-4 DB schema ready; **no legacy data migration run**; Production blocked |
| Spec | [`PRIVATE_PAIRING_RULES_V2_SPEC.md`](./PRIVATE_PAIRING_RULES_V2_SPEC.md) |
| Audit | [`PRIVATE_PAIRING_RULES_V2_PR1_AUDIT.md`](./PRIVATE_PAIRING_RULES_V2_PR1_AUDIT.md) |
| PR-4 schema | [`PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql`](./PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql) |
| PR-4 security doc | [`PRIVATE_PAIRING_RULES_V2_PR4_DATABASE_SECURITY.md`](./PRIVATE_PAIRING_RULES_V2_PR4_DATABASE_SECURITY.md) |

---

## 1. Principle

```text
Legacy founderPairingConstraints
  → legacy adapter
  → canonical rule definitions
  → unified Rules & Constraints Engine
```

Do **not** delete legacy arrays until:

1. Adapter parity tests pass for supported cases.
2. Feature flags can fall back to legacy path.
3. Owner GO after Staging QA (PR-7).

---

## 2. Legacy sources of truth

| Location | Field | Written by |
|----------|-------|------------|
| Club blob (`clubStorage` / `club_data_v3`) | `founderPairingConstraints[]` | SelectPlayers save |
| Tournament object | `founderPairingConstraints[]` | Internal/Official setup save |
| AI runtime | `prefer_teammate` / `avoid_teammate` via `constraintsToCourtPolicies` | SelectPlayers → AI context |
| Competition Core | Mapped RuleSet when RULES_V2 ON | Bridges |

Schema (legacy item):

```text
id, type (prefer_partner|avoid_partner|avoid_same_group),
anchorPlayerId, targetPlayerIds[], mode (hard|soft),
enabled, label?, note?
```

Missing vs V2: scope, dates, relation_mode, weight, priority, visibility, reason_category, versioning.

---

## 3. Type mapping

| Legacy `type` + `mode` | Canonical type | severity | relation_mode | Notes |
|------------------------|----------------|----------|---------------|-------|
| prefer_partner + soft | PREFER_PARTNER | soft | ANY_OF | weight default 80 |
| prefer_partner + hard | MUST_PARTNER | hard | ANY_OF | Document behavior change: hard prefer → must |
| avoid_partner + soft | AVOID_PARTNER | soft | ANY_OF | weight default 70 |
| avoid_partner + hard | MUST_NOT_PARTNER | hard | ANY_OF | Aligns with hard reject semantics |
| avoid_same_group + soft | DIFFERENT_GROUP | soft | ANY_OF | Or map to same_club_separation regulatory if product prefers |
| avoid_same_group + hard | DIFFERENT_GROUP | hard | ANY_OF | — |
| (policy) prefer_teammate | PREFER_PARTNER | soft | — | Via identity `founder-*` |
| (policy) avoid_teammate HIGH | MUST_NOT_PARTNER | hard | — | Stop using -120 as source of truth when Unified ON |
| (policy) avoid_teammate MED | AVOID_PARTNER | soft | — | — |

Unsupported in legacy (create only in V2 UI): opponent types, MIN_*, SAME_TEAM, visibility modes, ALL_OF, scoped windows.

---

## 4. Scope assignment on import

| Legacy home | Migrated scope_type | scope_id |
|-------------|---------------------|----------|
| Club blob | CLUB | clubId |
| Tournament | TOURNAMENT | tournamentId |
| Neither | TENANT / GLOBAL | tenant_id if available |

`start_at`/`end_at`: null (open-ended). `active` = legacy `enabled`. `visibility` = `private`. `reason_category` = `OTHER` with `reason_text` = legacy `note` or `"migrated_from_founder_pairing_constraints"`.

---

## 5. Versioning on migrate

For each scope with rules:

1. Create `private_pairing_rule_sets` status=`active`, version=`1`, name=`Migrated founder constraints`.
2. Insert rules + targets.
3. Store migration metadata: `{ source: "founderPairingConstraints", baselineCommit, migratedAt, itemCount }`.
4. Leave legacy array intact (read-through adapter until cutover).

---

## 6. Dual-read / dual-write window

| Flag | Read | Write |
|------|------|-------|
| Private OFF, Unified OFF | Legacy only | Legacy only |
| Private ON, Unified OFF | Adapter read canonical if present else legacy | Write both (shadow) |
| Private ON, Unified ON | Canonical SoT | Canonical; optional legacy mirror for rollback |
| Rollback | Set flags OFF | Legacy resumes |

Never silently diverge: shadow writes + parity reports in PR-6.

---

## 7. Parity test matrix (PR-6)

| Case | Expectation |
|------|-------------|
| Hard avoid partners | Same teams banned in both engines |
| Soft prefer partners | Ranking tendency same; absolute scores may differ within tolerance |
| Multi-target prefer | ANY_OF: any target match counts |
| Group avoid | Same separation behavior |
| Empty constraints | Bit-identical pairing aside from score metadata |
| Unsatisfiable hard set | Both report failure (V2 must be explicit error) |

Record fixtures under `docs/v5/qa-evidence/private-pairing-rules/` (created in PR-6).

---

## 8. Cutover checklist

1. Staging migrate dry-run on copy of club/tournament blobs.
2. Spot-check SUPER_ADMIN UI lists vs legacy panel.
3. Run pairing golden fixtures (parity ≥ threshold defined in QA).
4. Redact legacy field from non-admin payloads.
5. Keep legacy field in storage until Production GO + N days soak.
6. Only then schedule purge job (separate owner approval).

---

## 9. Rollback

| Layer | Action |
|-------|--------|
| Feature | Set `VITE_PRIVATE_PAIRING_RULES_ENABLED=false` and unified flag false |
| Server | Disable RPCs / server flag |
| Data | Keep legacy arrays; optional restore from active version archive |
| Results | Prior pairings keep stored `rule_set_version`; no recompute |

---

## 9b. PR-4 destination tables (schema only)

Private pairing data targets dedicated tables (not club/tournament blobs):

- `private_pairing_rule_sets`
- `private_pairing_rules`
- `private_pairing_rule_targets`
- `private_pairing_rule_audit_logs`

Legacy `founderPairingConstraints` is **unchanged** in PR-4. Data migrate job is later (PR-6/7). Apply steps: [`PRIVATE_PAIRING_RULES_V2_PR4_APPLY_RUNBOOK.md`](./PRIVATE_PAIRING_RULES_V2_PR4_APPLY_RUNBOOK.md).

---

## 10. Out of scope for automated migrate

- Inventing opponent rules from partner rules
- Inferring ALL_OF from multi-target lists
- Promoting private rules into certified disclosure automatically
- Deleting Founder panel before PR-5/6 complete
