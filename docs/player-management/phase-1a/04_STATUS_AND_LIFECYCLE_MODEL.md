# 04 — Status and Lifecycle Model

**Phase:** 1A — Contract Freeze  
**Status:** Official  

---

## Principle

Account lifecycle, player profile lifecycle, club membership lifecycle, and rating verification lifecycle are **independent**. A change in one must not silently rewrite another.

```text
Account suspended  ≠  Player archived  ≠  Membership removed  ≠  Rating unverified
```

---

## 1. Account status (Identity & Authentication)

**Owner:** Identity  
**Store today:** `profiles.status`

| Value | Meaning |
|-------|---------|
| `active` | Account may authenticate (subject to other auth rules) |
| `suspended` | Account blocked at auth layer |
| `invited` | Invited, not fully activated |

**Player Management:** read-only. Must not write `accountStatus`.

---

## 2. Player profile status (Player Management)

**Owner:** Player Management  
**Store today (legacy):** blob `players[].status`; partial mirror on `athletes.status`

| Value | Meaning |
|-------|---------|
| `active` | Profile is in normal use |
| `inactive` | Temporarily not used / hidden from default directories |
| `archived` | Retained for history; not selectable for new competition pools by default |

Notes:

- Blob also has boolean `active`; UI may show “Bị khóa” when `active: false`. Phase 1+ should normalize to `profileStatus` and avoid parallel booleans where possible.
- `athletes.status` today is only `active` \| `inactive` — map `archived` via Player Management when athletes is an alias.

---

## 3. Club membership status (Club Management)

**Owner:** Club Management  
**Store today:** `club_members.status`; membership requests separate

| Value | Meaning |
|-------|---------|
| `active` | Current member |
| `left` | Member left |
| `removed` | Removed by governance |
| `pending` | Allowed **if currently supported** via membership request flows (`club_membership_requests_v42` etc.), not as a substitute for player profile status |

UI-only labels such as membership `inactive` must map into the official set via adapters; they are not a fourth DB membership SSOT.

**Player Management:** may display membership references; must not own membership transitions.

---

## 4. Rating verification status (Player Rating)

**Owner:** Player Rating  
**Examples today:** Pick_VN `rating_status`, CC-02 / V5 verification enums

This status answers: “Is the **skill rating** trusted?”

It is **not** player identity verification.

| Domain | Question |
|--------|----------|
| Player `verificationStatus` | Is this **person/profile** verified? |
| Rating `rating_status` | Is this **rating** verified? |

Phase 1A forbids conflating these in UI copy, APIs, or storage.

---

## 5. Player identity verification status (Player Management)

**Owner:** Player Management  
**Store today:** missing as a dedicated field

Proposed Phase 1 values:

| Value | Meaning |
|-------|---------|
| `unverified` | Default |
| `pending` | Review in progress |
| `verified` | Identity/profile verified under product policy |
| `rejected` | Verification rejected |

---

## 6. Independence matrix

| Event | Account | Profile | Membership | Rating verification |
|-------|---------|---------|------------|---------------------|
| Suspend login | → `suspended` | unchanged | unchanged | unchanged |
| Archive athlete profile | unchanged | → `archived` | unchanged | unchanged |
| Remove from club | unchanged | unchanged | → `removed` | unchanged |
| Verify Pick_VN rating | unchanged | unchanged | unchanged | → verified-like |
| Verify player identity | unchanged | `verificationStatus` → verified | unchanged | unchanged |

---

## 7. Gender normalization (lifecycle-adjacent contract)

Canonical stored / contract values:

```text
male | female | unknown
```

Legacy inputs (`Nam`, `Nữ`, `M`, `F`, `other`, `Khác`, …) are accepted **only through adapters** (e.g. `normalizeAthleteGender`).

- Profiles currently may store `other`; adapter maps display/engine canonical to `unknown` where Player Management contract applies.
- UI labels remain Vietnamese; stored values remain English canonical.

See also field dictionary `gender` and Identity `profileGender.js` (legacy `other`).

---

## 8. Phase 1A freeze

No status enums are migrated in Phase 1A. This document freezes the **semantic separation** required before Phase 1B/1D implementation.
