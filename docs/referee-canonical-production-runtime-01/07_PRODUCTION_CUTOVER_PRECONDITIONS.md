# Production cutover preconditions

PRODUCTION is out of scope for this workstream. No Production SQL, Edge, fixture, or schema inspection.

Later Production GO requires:

1. Staging backend certification complete
2. Same canonical tables/RPCs present
3. `wiredToProductionRuntime=true` only after live durable composition is the default path
4. No in-memory production fallback
5. Adapter B still owns mode adapters (Daily/Internal/Official/Team)
6. Team #418 behavior unchanged
7. RLS not weakened
