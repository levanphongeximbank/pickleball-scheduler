/**
 * Default composition for the canonical write facade.
 * Without an injected V5 CAS runtime, creation fails closed —
 * never falls back to browser draft/local mirror stores.
 */

import { createPlayerRatingWriteFacade } from "../write-facade/createPlayerRatingWriteFacade.js";
import { failDurableRuntimeUnavailable } from "../write-facade/writeFacadeErrors.js";
import { createCanonicalPlayerIdResolverAdapter } from "./identity/createCanonicalPlayerIdResolverAdapter.js";
import { createV5DurableAdapterBundle } from "./v5/createV5DurableAdapters.js";
import { resolveDefaultV5DurableRuntime } from "./v5/v5DurableRuntime.js";
import { createUnimplementedMatchResultRatingPort } from "../ports/matchResultRatingPort.js";

/**
 * @param {{
 *   runtime?: object|null,
 *   identityResolver?: object,
 *   matchResultPort?: object,
 *   allowUnready?: boolean,
 * }} [deps]
 */
export function composePlayerRatingWriteFacade(deps = {}) {
  const runtime =
    deps.runtime === undefined ? resolveDefaultV5DurableRuntime() : deps.runtime;
  const bundle = createV5DurableAdapterBundle({ runtime });

  if (!bundle.ready) {
    if (deps.allowUnready) {
      // Explicit test/diagnostic path: return a proxy that fails every command.
      return createUnreadyWriteFacadeProxy(deps);
    }
    failDurableRuntimeUnavailable("composePlayerRatingWriteFacade", {
      reason: "V5 durable CAS runtime not composed",
      authority: bundle.authority.id,
    });
  }

  return createPlayerRatingWriteFacade({
    currentStateAdapter: bundle.currentStateAdapter,
    historyAdapter: bundle.historyAdapter,
    snapshotAdapter: bundle.snapshotAdapter,
    auditAdapter: bundle.auditAdapter,
    identityResolver:
      deps.identityResolver || createCanonicalPlayerIdResolverAdapter(),
    matchResultPort:
      deps.matchResultPort || createUnimplementedMatchResultRatingPort(),
    durableRuntimeReady: true,
  });
}

/**
 * @param {{ identityResolver?: object, matchResultPort?: object }} [deps]
 */
function createUnreadyWriteFacadeProxy(deps = {}) {
  const fail = (operation) => {
    failDurableRuntimeUnavailable(operation, {
      reason: "V5 durable CAS runtime not composed",
    });
  };

  return Object.freeze({
    phase: Object.freeze({
      id: "BM-FINAL-RATING-01",
      name: "canonical-write-facade-unready",
      wiredToProductionRuntime: false,
      durableAuthority: "pick-vn-rating-v5-service-rpc",
      ready: false,
    }),
    async resolveCanonicalPlayerId(reference, scope) {
      const resolver =
        deps.identityResolver || createCanonicalPlayerIdResolverAdapter();
      return resolver.resolveCanonicalPlayerId(reference, scope);
    },
    async getCurrentState() {
      return fail("getCurrentState");
    },
    async persistCurrentState() {
      return fail("persistCurrentState");
    },
    async appendHistoryEvent() {
      return fail("appendHistoryEvent");
    },
    async persistSnapshot() {
      return fail("persistSnapshot");
    },
    async verify() {
      return fail("verify");
    },
    async adjust() {
      return fail("adjust");
    },
    async applyFromMatchResult() {
      return fail("applyFromMatchResult");
    },
    async reverseFromMatchResult() {
      return fail("reverseFromMatchResult");
    },
  });
}
