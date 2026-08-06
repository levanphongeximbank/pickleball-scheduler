# Operation B1 — Future Preflight

## Must prove

- Project ref = `expuvcohlcjzvrrauvud`
- Certified QA count accounted for (baseline 11)
- B1 eligible count = **exactly 8**
- External allowlist SHA-256 valid
- Each allowlisted identity:
  - Auth email present + matches profile email
  - `isCertifiedQaEmail(email) = true`
  - not `phase1b-smith@gmail.com`
  - no athlete / membership / tenant_staff / tournament / rating / finance refs
  - unambiguous Auth↔profile mapping (`auth_user_id === profile_id`)
- QA-01, QA-02, QA-03 remain excluded
- Any new reference ⇒ block identity and block batch

## Allowlist schema (external only)

```json
{
  "operation": "OPERATION_B1_REVERSIBLE_QA_QUARANTINE",
  "production_project_ref": "expuvcohlcjzvrrauvud",
  "target_count": 8,
  "captured_at_utc": "...",
  "identities": [
    {
      "label": "QA-04",
      "auth_user_id": "...",
      "profile_id": "...",
      "expected_email": "...",
      "profile_status": "active",
      "auth_banned": false,
      "reference_counts": {
        "athlete_count": 0,
        "membership_active": 0,
        "membership_removed": 0,
        "membership_total": 0,
        "tenant_members": 0,
        "tenants_owned": 0,
        "club_governance_owner": 0,
        "tournament_refs": 0,
        "rating_refs": 0,
        "finance_refs": 0,
        "other_business_refs": 0
      },
      "captured_at": "...",
      "production_project_ref": "expuvcohlcjzvrrauvud"
    }
  ]
}
```

Do not store allowlists in Git.
