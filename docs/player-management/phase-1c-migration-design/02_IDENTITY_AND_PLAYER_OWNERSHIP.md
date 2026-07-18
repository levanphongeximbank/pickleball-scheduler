# 02 — Identity and Player Ownership

## Chain map

```text
auth.users.id
  → profiles.id                    (account SSOT + hybrid demographics today)
  → profiles.player_id             (alias → canonical playerId)
  → player-auth-{authUserId}       (preferred canonical form)
  → athletes.id                    (optional cloud alias)
  → club_members                   (membership edge)
  → rating / ranking record keys   (references only)
```

## Assessment: `profiles` ownership

| Question | Answer |
|----------|--------|
| Identity/account-only? | **No** — already holds `gender`, `birth_year` |
| Hybrid identity/player? | **Yes** |
| Already acting as player profile SSOT for auth-linked? | **Partial** — account demographics yes; operational roster still often blob |
| Suitable long-term Player SSOT alone? | **Acceptable medium-term for auth-linked**; not complete for non-auth persons |

## Contract (Phase 1A/1C)

- Identity owns: login, session, RBAC, `accountStatus`.  
- Player Management owns: canonical `playerId`, demographics, privacy, identity verification, directory.  
- Physical columns on `profiles` for Player fields are **storage co-location**, not Identity product ownership of those fields.

## Canonical player identity

- Auth-linked preferred: `player-auth-{authUserId}`  
- Non-auth: `player-{uuid}`  
- Resolution: MAPPED / DERIVED / UNMAPPED / INVALID / AMBIGUOUS  
- Do not create a second independent identity store
