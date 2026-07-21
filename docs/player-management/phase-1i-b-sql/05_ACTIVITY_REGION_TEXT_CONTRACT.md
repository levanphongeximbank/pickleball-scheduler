# Phase 1I-B — activity_region Text Contract Remediation

**Owner context:** Phase 1I-A remediation + `AUTHORIZE_PHASE_1I_B_SQL_AUTHORING_ONLY`  
**Status:** Final accepted contract for Directory RPC I/O

---

## 1. Old design assumption (Phase 1I-0)

Phase 1I-0 design docs originally specified:

| Surface | 1I-0 assumption |
|---------|-----------------|
| Stored column | `public.profiles.activity_region` **jsonb** |
| RPC output `activity_region` | **jsonb or null** (masked object) |
| Search arg `p_region` | **jsonb** equality on object keys |

This matched the general public-profile projector, which exposes a structured region object (`countryCode`, `provinceCode`, `provinceName`, `city`, `district`).

---

## 2. Final accepted contract (Phase 1I-A → 1I-B)

Merged Phase 1I-A application contract (`d2e850d…`) locks:

| Surface | Final contract |
|---------|----------------|
| Stored column | unchanged **jsonb** on `public.profiles` |
| Directory DTO `activityRegion` | **`string \| null` only** |
| RPC output `activity_region` | **`text \| null` only** (never a JSON object) |
| Search arg `p_region` | **`text \| null`** |
| Objects / arrays / numbers in RPC output | **rejected** by `projectDirectoryPlayerFromRpcRow` (fail closed) |

Evidence:

- `src/features/player/constants/directory.js`
- `src/features/player/projectors/projectDirectoryPlayer.js`
- `src/features/player/contracts/directoryRequests.js`
- `src/features/player/repositories/supabasePlayerDirectoryRepository.js` (comment: 1I-B must accept text)
- `tests/player-management-phase-1i-a-directory-contract.test.js`

---

## 3. Why activity_region is text or null

1. **UI Directory surface** needs a single display label, not a structured editor object.  
2. **Fail closed:** returning jsonb would break the 1I-A projector (objects are rejected).  
3. **Privacy:** server still reads jsonb + `showActivityRegion` internally; clients never see raw privacy JSON or unmasked structured region when disabled.  
4. **Filter simplicity:** authenticated clients pass a normalized region string (e.g. `"Hà Nội"`), not a partial jsonb document.

---

## 4. SQL conversion rule (storage jsonb → emit text)

When `showActivityRegion = true`, format allow-listed keys in this order (aligned with `formatActivityRegionDisplay`):

`provinceName`, `city`, `district`, `countryCode`

Join non-empty trimmed parts with `", "`.  
If none → emit `null`.  
If `showActivityRegion` is not true → emit `null`.  
If stored value is null / non-object → emit `null` (fail closed).

Region **filter** (`p_region text`): case-insensitive equality against those allow-listed fields, `provinceCode`, or the formatted label; only rows with `showActivityRegion = true`.

---

## 5. Compatibility with merged Phase 1I-A

| Check | Result |
|-------|--------|
| Adapter passes `p_region: string\|null` | Compatible |
| Projector requires `activity_region` string\|null | Compatible |
| No application contract change required for 1I-B | Confirmed |
| 1I-0 docs updated to note remediation | See `phase-1i/05` + `06` addenda |

---

## 6. Non-goals

- Do not migrate `profiles.activity_region` column away from jsonb  
- Do not change Phase 1G self-edit structured region form  
- Do not return jsonb on Directory RPCs “for convenience”
