# 02 — Single Write Path Contract

## API

```text
updatePlayerProfile(playerId, patch, options?) → Promise<WriteResult>
```

Public export from `src/features/player`.

## Behavior

1. Resolve canonical identity via Phase 1B resolver  
2. Reject `INVALID` / `UNMAPPED` / `AMBIGUOUS`  
3. Accept only Player Management-owned fields  
4. Reject `accountStatus`, membership, rating, ranking, competition, RBAC fields  
5. Validate + normalize patch  
6. Persist via replaceable `writeRepository`  
7. Never create a second player identity  
8. Return explicit result objects  

## Owned writable fields

`displayName`, `fullName`, `phone`, `avatarUrl`, `gender`, `birthDate`, `birthYear`, `handedness`, `activityRegion`, `privacySettings`, `verificationStatus`, `profileStatus`

## Forbidden examples

`accountStatus`, `playerId`, `authUserId`, `email`, `ageGroup`, `rating`, `ratingStatus`, `role`, `clubMembershipReferences`, …
