import { createBrowserPlatformPersistenceAdapter } from "../persistence/index.js";
import {
  createTenantService,
  createSubscriptionService,
  createAuditService,
  createNotificationService,
  createAccessService,
  createPermissionService,
} from "../services/index.js";
import {
  createTenantEntity,
  createUserEntity,
  createDomainProjection,
  buildPhase2DomainSummary,
} from "../domain/index.js";
import { migrateLegacyV4Payload, buildMigrationPlan } from "../migration/index.js";
import { V5_PLATFORM_SCHEMA, migrationSql, rollbackSql } from "../database/index.js";
import { PLATFORM_MODULES, getPlatformModulesForUser, RouteGuard } from "../frontend/index.js";
import {
  createTournamentEngine,
  createCourtEngine,
  createLeagueEngine,
  createRankingEngine,
  createBillingEngine,
  createAiEngine,
} from "../engines/index.js";
import { createTenantRecord, createSubscription } from "../index.js";
import { runPlatformEngineWorkflow } from "../engines/orchestrator.js";

export function createPlatformRuntime({ namespace = "core-platform" } = {}) {
  const persistence = createBrowserPlatformPersistenceAdapter({ namespace });
  const tenantService = createTenantService({ persistence, collection: "tenants" });
  const subscriptionService = createSubscriptionService({ persistence, collection: "subscriptions" });
  const permissionService = createPermissionService();
  const auditService = createAuditService();
  const notificationService = createNotificationService({ persistence, collection: "notifications" });
  const accessService = createAccessService({ permissionService });

  return {
    persistence,
    tenantService,
    subscriptionService,
    permissionService,
    auditService,
    notificationService,
    accessService,
    domain: {
      createTenantEntity,
      createUserEntity,
      createDomainProjection,
      buildPhase2DomainSummary,
    },
    migration: {
      migrateLegacyV4Payload,
      buildMigrationPlan,
    },
    database: {
      schema: V5_PLATFORM_SCHEMA,
      migrationSql,
      rollbackSql,
    },
    frontend: {
      modules: PLATFORM_MODULES,
      getPlatformModulesForUser,
      RouteGuard,
    },
    engines: {
      tournament: createTournamentEngine(),
      court: createCourtEngine(),
      league: createLeagueEngine(),
      ranking: createRankingEngine(),
      billing: createBillingEngine(),
      ai: createAiEngine(),
      workflow: runPlatformEngineWorkflow,
    },
    initializeSeed({ tenantInput = {}, subscriptionInput = {} } = {}) {
      const tenant = createTenantRecord(tenantInput);
      const subscription = createSubscription(subscriptionInput);

      tenantService.create(tenant);
      subscriptionService.create(subscription);

      return { tenant, subscription };
    },
    ensureSeed({ tenantInput = {}, subscriptionInput = {} } = {}) {
      const tenantId = tenantInput.tenant_id || tenantInput.id;
      if (tenantId) {
        const existingTenant = tenantService.getById(tenantId);
        if (existingTenant) {
          const existingSubscription = subscriptionService.getByTenant(tenantId);
          return { tenant: existingTenant, subscription: existingSubscription };
        }
      }

      return this.initializeSeed({ tenantInput, subscriptionInput });
    },
    logAuditEvent(input = {}) {
      return auditService.log(input);
    },
    logNotification(input = {}) {
      return notificationService.create(input);
    },
  };
}
