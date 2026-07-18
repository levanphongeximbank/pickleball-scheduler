# Phase 1C — Club Owner Assign Authz Gate (Staging)

- Status: **PASS**
- Staging ref: `qyewbxjsiiyufanzcjcq`
- Production touched: `false`
- Commit: `8f5de177779d6106a09903698b7fcf65884675d7`
- Optional Club Owner transfer: **DISABLED**

## Preflight
```json
{
  "stagingRef": "qyewbxjsiiyufanzcjcq",
  "notProduction": true,
  "sqlReview": {
    "helperRoleSpecific": true,
    "noBareTenantMemberAuthz": true,
    "deniesManagers": true,
    "optionalClubOwnerDisabled": true,
    "noDestructive": true,
    "createOrReplace": true
  },
  "currentAssignUsesBareTenantMember": true,
  "currentClearUsesBareTenantMember": true,
  "audit_assign_ok": true,
  "audit_clear_ok": true,
  "rls_clubs": true,
  "tenant_member_helper_exists": true
}
```

## Apply
```json
{
  "file": "docs/v5/phase1c/PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql",
  "checksum": "8a512ec1a4dfbb7e52e54d2b71d8fe4c5643a9f7b32e2f4c2e662e74e0cae83e",
  "result": "PASS",
  "finishedAt": "2026-07-18T17:03:45.988Z"
}
```

## Catalog
```json
{
  "helper_exists": true,
  "assign_uses_narrow_helper": true,
  "clear_uses_narrow_helper": true,
  "assign_no_bare_tenant_member": true,
  "clear_no_bare_tenant_member": true,
  "helper_no_bare_tenant_member": true,
  "helper_no_club_owner_gov": true,
  "helper_no_venue_manager": true,
  "assign_security": "DEFINER",
  "rls_clubs": true,
  "grant_authenticated": true
}
```

## Assign matrix
```json
[
  {
    "id": "ASSIGN_SUPER_ADMIN",
    "ok": true,
    "expected": "ALLOW",
    "actual": "ALLOW",
    "note": null
  },
  {
    "id": "ASSIGN_Tenant owner",
    "ok": true,
    "expected": "ALLOW",
    "actual": "ALLOW",
    "note": null
  },
  {
    "id": "ASSIGN_Approved tenant admin (TENANT_OWNER profile path)",
    "ok": true,
    "expected": "ALLOW",
    "actual": "ALLOW",
    "note": "same fixture as tenant_owner when profile path overlaps"
  },
  {
    "id": "ASSIGN_Ordinary tenant_staff",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN",
    "note": null
  },
  {
    "id": "ASSIGN_VENUE_MANAGER profile fallback only",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN",
    "note": null
  },
  {
    "id": "ASSIGN_COURT_MANAGER profile fallback only",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN",
    "note": null
  },
  {
    "id": "ASSIGN_Club Owner without approved tenant-admin role",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN",
    "note": null
  },
  {
    "id": "ASSIGN_Club President",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN",
    "note": null
  },
  {
    "id": "ASSIGN_Vice President",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN",
    "note": null
  },
  {
    "id": "ASSIGN_Ordinary club player",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN",
    "note": null
  },
  {
    "id": "ASSIGN_Unrelated authenticated user",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN",
    "note": null
  },
  {
    "id": "ASSIGN_Anonymous",
    "ok": true,
    "expected": "NOT_AUTHENTICATED",
    "actual": "NOT_AUTHENTICATED"
  },
  {
    "id": "ASSIGN_stale_version",
    "ok": true,
    "expected": "VERSION_CONFLICT",
    "actual": "VERSION_CONFLICT"
  }
]
```

## Clear matrix
```json
[
  {
    "id": "CLEAR_SUPER_ADMIN",
    "ok": true,
    "expected": "ALLOW",
    "actual": "ALLOW"
  },
  {
    "id": "CLEAR_Tenant owner",
    "ok": true,
    "expected": "ALLOW",
    "actual": "ALLOW"
  },
  {
    "id": "CLEAR_Ordinary tenant_staff",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN"
  },
  {
    "id": "CLEAR_VENUE_MANAGER profile fallback only",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN"
  },
  {
    "id": "CLEAR_COURT_MANAGER profile fallback only",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN"
  },
  {
    "id": "CLEAR_Club Owner without approved tenant-admin role",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN"
  },
  {
    "id": "CLEAR_Club President",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN"
  },
  {
    "id": "CLEAR_Vice President",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN"
  },
  {
    "id": "CLEAR_Ordinary club player",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN"
  },
  {
    "id": "CLEAR_Unrelated authenticated user",
    "ok": true,
    "expected": "FORBIDDEN",
    "actual": "FORBIDDEN"
  },
  {
    "id": "CLEAR_Anonymous",
    "ok": true,
    "expected": "NOT_AUTHENTICATED",
    "actual": "NOT_AUTHENTICATED"
  },
  {
    "id": "CLEAR_stale_version",
    "ok": true,
    "expected": "VERSION_CONFLICT",
    "actual": "VERSION_CONFLICT"
  }
]
```

## Version / audit
```json
{
  "assign_ok": true,
  "clear_ok": true,
  "version_before": 118,
  "version_after_assign": 119,
  "version_after_clear": 120,
  "assign_bumped": true,
  "clear_bumped": true,
  "assign_audit": true,
  "clear_audit": true,
  "assign_request_id": "4f7db8cb-b00a-48a5-8355-073ba78f65a6",
  "clear_request_id": "d47fbac4-b106-459d-89b2-81871f2465fb"
}
```
