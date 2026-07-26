/**
 * Court runtime composition root — resolve authority once, build writer once.
 */

import { COURT_RUNTIME_AUTHORITY } from "./constants.js";
import {
  COURT_RUNTIME_ERROR_CODES,
  createCourtRuntimeError,
} from "./errors.js";
import {
  isDurableCourtRuntimeAuthority,
  isLocalCourtRuntimeAuthority,
  resolveCourtRuntimeAuthority,
} from "./resolveCourtRuntimeAuthority.js";
import { createDurableCourtRuntimeAdapter } from "./adapters/createDurableCourtRuntimeAdapter.js";
import { createLocalCourtRuntimeAdapter } from "./adapters/createLocalCourtRuntimeAdapter.js";
import { createMemoryCourtRuntimeAdapter } from "./adapters/createMemoryCourtRuntimeAdapter.js";
import { createCourtRuntimeWriter } from "./createCourtRuntimeWriter.js";

/** @type {{ authority: string, writer: object, resolution: object } | null} */
let activeRuntime = null;

function buildAdapter(authority, options = {}) {
  if (authority === COURT_RUNTIME_AUTHORITY.TEST_MEMORY) {
    return options.adapter || createMemoryCourtRuntimeAdapter({ authority });
  }
  if (
    authority === COURT_RUNTIME_AUTHORITY.DEVELOPMENT_LOCAL ||
    authority === COURT_RUNTIME_AUTHORITY.OFFLINE_LOCAL
  ) {
    return options.adapter || createLocalCourtRuntimeAdapter({ authority });
  }
  if (authority === COURT_RUNTIME_AUTHORITY.DURABLE) {
    return (
      options.adapter ||
      createDurableCourtRuntimeAdapter({
        client: options.client || null,
        getClient: options.getClient,
      })
    );
  }
  return null;
}

/**
 * @param {{
 *   authority?: string,
 *   env?: Record<string, unknown>,
 *   adapter?: object,
 *   client?: object|null,
 *   getClient?: () => object|null,
 *   writer?: object,
 * }} [options]
 */
export function createCourtRuntime(options = {}) {
  if (options.writer) {
    const writer = options.writer;
    return {
      ok: true,
      authority: writer.authority,
      writer,
      resolution: { ok: true, authority: writer.authority, explicit: true, source: "writer_injection" },
    };
  }

  const resolution = resolveCourtRuntimeAuthority(options);
  if (!resolution.ok) {
    return resolution;
  }

  const adapter = buildAdapter(resolution.authority, options);
  if (!adapter) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_AUTHORITY_UNRESOLVED,
      `No adapter for authority ${resolution.authority}`
    );
  }

  const writer = createCourtRuntimeWriter({
    authority: resolution.authority,
    adapter,
  });

  return {
    ok: true,
    authority: resolution.authority,
    writer,
    adapter,
    resolution,
  };
}

/**
 * Resolve (or reuse) the process-wide Court runtime writer.
 */
export function getCourtRuntimeWriter(options = {}) {
  if (options.forceNew === true || !activeRuntime) {
    const created = createCourtRuntime(options);
    if (!created.ok) {
      return created;
    }
    activeRuntime = {
      authority: created.authority,
      writer: created.writer,
      resolution: created.resolution,
    };
  } else if (options.authority || options.adapter || options.writer || options.env) {
    const created = createCourtRuntime(options);
    if (!created.ok) {
      return created;
    }
    activeRuntime = {
      authority: created.authority,
      writer: created.writer,
      resolution: created.resolution,
    };
  }
  return { ok: true, ...activeRuntime };
}

export function getCourtRuntimeAuthority() {
  if (!activeRuntime) {
    const resolved = getCourtRuntimeWriter();
    if (!resolved.ok) {
      return resolved;
    }
  }
  return {
    ok: true,
    authority: activeRuntime.authority,
    resolution: activeRuntime.resolution,
    inspect: activeRuntime.writer.inspect(),
  };
}

/** @internal Test / composition reset. */
export function __resetCourtRuntimeForTests(options = null) {
  activeRuntime = null;
  if (options) {
    return getCourtRuntimeWriter({ ...options, forceNew: true });
  }
  return { ok: true, reset: true };
}

export function assertLocalStorageWriteAllowed() {
  const runtime = getCourtRuntimeWriter();
  if (!runtime.ok) {
    return runtime;
  }
  if (!isLocalCourtRuntimeAuthority(runtime.authority)) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_LOCAL_MODE_NOT_EXPLICIT,
      "localStorage Court runtime writes require explicit local authority.",
      { authority: runtime.authority }
    );
  }
  return { ok: true, authority: runtime.authority };
}

export {
  isDurableCourtRuntimeAuthority,
  isLocalCourtRuntimeAuthority,
  resolveCourtRuntimeAuthority,
};
