/**
 * Customer runtime composition factory (CUSTOMER-03 + CUSTOMER-04).
 *
 * Explicit DI only. No env reads, no global Supabase client, no network during
 * construction, no Production memory fallback.
 *
 * Customer persistence is durable business master data and must never silently
 * fall back to an in-memory repository in Production.
 */

export {
  CUSTOMER_RUNTIME_MODE,
  CUSTOMER_RUNTIME_MODE_VALUES,
  CUSTOMER_RUNTIME_ENVIRONMENT,
  CUSTOMER_RUNTIME_ENVIRONMENT_VALUES,
  validateCustomerRuntimeConfig,
} from "./config.js";

import { createCustomerApplicationService } from "../application/CustomerApplicationService.js";
import { createConsentPreferenceApplicationService } from "../application/ConsentPreferenceApplicationService.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { CustomerError } from "../errors/CustomerError.js";
import { createDurableCustomerRepository } from "../persistence/durable/durableCustomerRepository.js";
import { createDurableConsentPreferenceRepository } from "../persistence/durable/durableConsentPreferenceRepository.js";
import { createInMemoryCustomerRepository } from "../repositories/inMemory.js";
import { createInMemoryConsentPreferenceRepository } from "../repositories/inMemoryConsentPreference.js";
import {
  createSequentialCustomerIdGenerator,
  createSystemCustomerClock,
} from "../repositories/ports.js";
import {
  CUSTOMER_RUNTIME_ENVIRONMENT,
  CUSTOMER_RUNTIME_MODE,
  validateCustomerRuntimeConfig,
} from "./config.js";

const ALLOWED_DEPENDENCY_KEYS = Object.freeze([
  "db",
  "repository",
  "consentPreferenceRepository",
  "clock",
  "idGenerator",
]);

/**
 * @param {object} [dependencies]
 */
function assertDependencyKeys(dependencies) {
  if (dependencies == null) return;
  if (typeof dependencies !== "object" || Array.isArray(dependencies)) {
    throw new CustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Customer runtime dependencies must be a plain object.",
      { field: "dependencies" }
    );
  }
  for (const key of Object.keys(dependencies)) {
    if (!ALLOWED_DEPENDENCY_KEYS.includes(key)) {
      throw new CustomerError(
        CUSTOMER_ERROR_CODES.INVALID_INPUT,
        `Unknown Customer runtime dependency key rejected: ${key}`,
        { field: key, allowedKeys: [...ALLOWED_DEPENDENCY_KEYS] }
      );
    }
    if (/secret|password|token|service_role|api_key|apikey|credential/i.test(key)) {
      throw new CustomerError(
        CUSTOMER_ERROR_CODES.INVALID_INPUT,
        "Customer runtime dependencies must not include credential keys.",
        { field: key }
      );
    }
  }
}

/**
 * @param {object} [rawConfig]
 * @param {object} [dependencies]
 */
export function createCustomerRuntime(rawConfig = {}, dependencies = {}) {
  assertDependencyKeys(dependencies);
  const config = validateCustomerRuntimeConfig(rawConfig);

  const clock = dependencies.clock || createSystemCustomerClock();
  const idGenerator =
    dependencies.idGenerator || createSequentialCustomerIdGenerator();

  if (!config.enabled || config.mode === CUSTOMER_RUNTIME_MODE.DISABLED) {
    return Object.freeze({
      config,
      ready: false,
      persistenceMode: CUSTOMER_RUNTIME_MODE.DISABLED,
      repository: null,
      consentPreferenceRepository: null,
      application: null,
      consentPreferenceApplication: null,
      assertReady() {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
          "Customer Management runtime is disabled.",
          { mode: CUSTOMER_RUNTIME_MODE.DISABLED }
        );
      },
    });
  }

  let repository = dependencies.repository || null;
  let consentPreferenceRepository =
    dependencies.consentPreferenceRepository || null;
  let persistenceMode = config.mode;

  if (config.mode === CUSTOMER_RUNTIME_MODE.MEMORY) {
    repository = repository || createInMemoryCustomerRepository();
    consentPreferenceRepository =
      consentPreferenceRepository || createInMemoryConsentPreferenceRepository();
    persistenceMode = CUSTOMER_RUNTIME_MODE.MEMORY;
  } else if (config.mode === CUSTOMER_RUNTIME_MODE.DURABLE) {
    if (repository) {
      persistenceMode = CUSTOMER_RUNTIME_MODE.DURABLE;
    } else if (dependencies.db) {
      repository = createDurableCustomerRepository({ db: dependencies.db });
      persistenceMode = CUSTOMER_RUNTIME_MODE.DURABLE;
    } else {
      throw new CustomerError(
        CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
        "Durable Customer runtime requires an injectable db port or repository.",
        {
          mode: CUSTOMER_RUNTIME_MODE.DURABLE,
          environment: config.environment,
        }
      );
    }

    if (!consentPreferenceRepository) {
      if (dependencies.db) {
        consentPreferenceRepository = createDurableConsentPreferenceRepository({
          db: dependencies.db,
        });
      } else {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
          "Durable Customer consent/preference runtime requires db or consentPreferenceRepository.",
          {
            mode: CUSTOMER_RUNTIME_MODE.DURABLE,
            environment: config.environment,
          }
        );
      }
    }

    if (config.environment === CUSTOMER_RUNTIME_ENVIRONMENT.PRODUCTION) {
      if (persistenceMode !== CUSTOMER_RUNTIME_MODE.DURABLE) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
          "Customer persistence is durable business master data and must never silently fall back to an in-memory repository in Production.",
          { environment: config.environment, persistenceMode }
        );
      }
    }
  }

  if (!repository) {
    throw new CustomerError(
      CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
      "Customer Management runtime adapter is not configured.",
      { adapter: "CustomerRepository" }
    );
  }

  if (!consentPreferenceRepository) {
    throw new CustomerError(
      CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
      "Customer consent/preference repository is not configured.",
      { adapter: "CustomerConsentPreferenceRepository" }
    );
  }

  const application = createCustomerApplicationService({
    repository,
    clock,
    idGenerator,
  });

  const consentPreferenceApplication = createConsentPreferenceApplicationService({
    customerRepository: repository,
    consentPreferenceRepository,
    clock,
    idGenerator,
  });

  return Object.freeze({
    config,
    ready: true,
    persistenceMode,
    repository,
    consentPreferenceRepository,
    application,
    consentPreferenceApplication,
    assertReady() {
      return true;
    },
  });
}

/**
 * Test harness — memory runtime only (environment=test).
 * @param {object} [options]
 */
export function createCustomerRuntimeTestHarness(options = {}) {
  const repository =
    options.repository || createInMemoryCustomerRepository();
  const consentPreferenceRepository =
    options.consentPreferenceRepository ||
    createInMemoryConsentPreferenceRepository();
  const runtime = createCustomerRuntime(
    {
      enabled: true,
      mode: CUSTOMER_RUNTIME_MODE.MEMORY,
      environment: CUSTOMER_RUNTIME_ENVIRONMENT.TEST,
    },
    {
      repository,
      consentPreferenceRepository,
      clock: options.clock,
      idGenerator: options.idGenerator,
    }
  );
  return Object.freeze({
    ...runtime,
    resetAllForTests() {
      if (typeof repository.resetAllForTests === "function") {
        repository.resetAllForTests();
      }
      if (typeof consentPreferenceRepository.resetAllForTests === "function") {
        consentPreferenceRepository.resetAllForTests();
      }
    },
  });
}
