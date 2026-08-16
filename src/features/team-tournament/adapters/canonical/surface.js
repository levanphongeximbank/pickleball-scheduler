/**
 * Attach Team ĐẦU B metadata onto a canonical Contract A adapter view.
 * Contract identity is copied from ĐẦU A — never re-declared here.
 */

import { TEAM_TOURNAMENT_ADAPTER_B_MODE } from "./constants.js";
import { toCanonicalAdapterContext } from "./context.js";

export function wrapTeamBAdapter(inner, meta = {}) {
  const requiredMethods = Array.isArray(inner?.requiredMethods)
    ? inner.requiredMethods
    : Array.isArray(meta.requiredMethods)
      ? meta.requiredMethods
      : [];
  const translate = meta.translateContext === false
    ? (context) => context
    : (context) => toCanonicalAdapterContext(context || {});
  const view = {
    adapterBName: meta.adapterBName,
    ordinal: meta.ordinal,
    classification: meta.classification,
    activation: meta.activation === true,
    adapterBReady: true,
    sharedRuntime: inner?.productionBinding || meta.sharedRuntime || null,
    competitionMode: TEAM_TOURNAMENT_ADAPTER_B_MODE,
    ownsAuthority: false,
    contractId: inner?.contractId,
    contractVersion: inner?.contractVersion,
    locked: inner?.locked === true,
    domain: inner?.domain || meta.domain || null,
    productionBinding: inner?.productionBinding || null,
    runtimeClassification: inner?.runtimeClassification || null,
    requiredMethods,
    capabilities: inner?.capabilities || meta.capabilities || null,
  };
  for (const method of requiredMethods) {
    if (typeof inner?.[method] !== "function") continue;
    view[method] = (context, ...rest) => inner[method](translate(context), ...rest);
  }
  if (typeof inner?.invoke === "function") {
    view.invoke = (...args) => inner.invoke(...args);
  }
  return Object.freeze(view);
}
