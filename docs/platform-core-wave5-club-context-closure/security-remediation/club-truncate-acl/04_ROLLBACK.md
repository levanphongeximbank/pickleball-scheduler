# Club TRUNCATE ACL — rollback policy

```
ROLLBACK_RECOMMENDED=NO
AUTO_REGRANT_TRUNCATE_ON_VERIFY_FAILURE=NO
REASON=Restoring anon/authenticated TRUNCATE would reintroduce a known security gap.
```

If an emergency requires restoring prior grants, that is an **Owner-authorized**
security exception with explicit evidence — not part of this package's normal path.

This package does not ship a GRANT TRUNCATE restore script.
