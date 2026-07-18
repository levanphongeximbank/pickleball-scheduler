# 02 — Resolution API Contract

## Public APIs

Import from `src/features/player` (or `src/features/player/index.js`) only:

| Export | Role |
|--------|------|
| `RESOLUTION_OUTCOME` | Outcome constants (`MAPPED` … `AMBIGUOUS`) |
| `resolveByAuthUser` | Auth account → identity outcome |
| `resolveCanonicalPlayerId` | Heterogeneous reference → identity outcome |
| `getPlayerProfile` | Player id → outcome + normalized profile |
| `searchPlayers` | Optional read-only search over injected roster |
| `normalizePlayerProfile` | Normalize a partial into the Player Profile read model |

### `resolveByAuthUser(authUserId, options?)`

Maps an auth account to a player identity outcome.

### `resolveCanonicalPlayerId(reference, options?)`

Resolves a string or structured reference (`player_id`, `auth_user`, `athlete`, …).

### `getPlayerProfile(playerId, options?)`

Returns a resolution result including `profile` when outcome is MAPPED or DERIVED; `profile: null` for INVALID / UNMAPPED / AMBIGUOUS.

### `searchPlayers(filters?, options?)` (optional)

Read-only filter over an **injected** `options.players` roster. Does not hit network by default.

### `normalizePlayerProfile(partial, options?)`

Builds the normalized read model. Gender output is canonical `male` \| `female` \| `unknown` when present. Missing fields stay `null`.

---

## Result object

```text
{
  ok: true,
  outcome: "MAPPED" | "DERIVED" | "UNMAPPED" | "INVALID" | "AMBIGUOUS",
  playerId: string | null,
  authUserId: string | null,
  candidatePlayerIds: string[],
  warnings: string[],
  meta: { selectable: boolean, ... },
  profile?: object | null
}
```

Normal identity outcomes are **result objects**, not thrown errors.

---

## Outcome behavior

| Outcome | Behavior |
|---------|----------|
| **MAPPED** | Explicit accepted mapping (e.g. valid `profiles.player_id`) or confirmed directory player id |
| **DERIVED** | No explicit map; `player-auth-{authUserId}` confirmed in directory |
| **UNMAPPED** | Valid input; no safe mapping |
| **INVALID** | Empty/malformed reference, or broken `profiles.player_id` |
| **AMBIGUOUS** | ≥2 distinct plausible player ids — **refuses** silent first-match; `playerId` stays `null` |

Selectable only for MAPPED / DERIVED (`meta.selectable`).

---

## Options (common)

| Option | Role |
|--------|------|
| `profile` | Identity profiles row |
| `findPlayerById` | Directory callback (`player` \| `null` \| `undefined`) |
| `clubId` / `tenantId` | Tenant/club boundary context |
| `candidatePlayerIds` | Extra known ids (tests / callers) |
| `sourceRepository` | Injectable read repository |
| `requirePlayerRow` | Default true — missing mapped row → INVALID |
| `trustUnknownExistence` | Cloud-trust path for direct id resolve |
