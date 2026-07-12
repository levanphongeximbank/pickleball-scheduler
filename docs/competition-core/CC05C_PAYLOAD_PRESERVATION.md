# CC-05C Payload Preservation

## Preserved references

- `Map` (`options.playersById`)
- `randomFn` (payload + options)
- Player core fields: id, rating, gender, check-in, busy, preferences

## Unmapped fields

Non-canonical top-level keys → `UNMAPPED_LEGACY_FIELD:{key}` warning (not silently dropped).

Dropped fields → `DROPPED_LEGACY_FIELD:{key}`.

## Extensions

`extractLegacyPayloadExtensions()` captures non-canonical fields for legacy snapshot.

## Source

`formationPayloadPreservation.js`
