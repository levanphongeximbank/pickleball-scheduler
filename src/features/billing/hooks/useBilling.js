import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import { getPlanCatalog } from "../constants/billingConstants.js";
import {
  BILLING_PERSIST_SETS,
  ensureBillingStoreHydrated,
  flushBillingStoreDirty,
  isSupabaseBillingStore,
  persistBillingCollections,
} from "../repositories/billingStoreRuntime.js";
import { getBillingStore } from "../repositories/billingRepository.js";
import { ensureTrialSubscriptionRpc } from "../services/billingTrialRpc.js";
import { BillingEngine } from "../services/billingEngine.js";
import { InvoiceService } from "../services/invoiceService.js";
import { PaymentService } from "../services/paymentService.js";
import { PlanLimitService } from "../services/planLimitService.js";
import { SubscriptionService } from "../services/subscriptionService.js";
import { TenantAccessService } from "../services/tenantAccessService.js";

function buildServices(store) {
  const subscriptionService = new SubscriptionService({ store });
  const invoiceService = new InvoiceService({ store });
  const paymentService = new PaymentService({ store, subscriptionService, invoiceService });
  const planLimitService = new PlanLimitService({ store });
  const tenantAccessService = new TenantAccessService({ store });
  const engine = new BillingEngine({
    store,
    subscriptionService,
    invoiceService,
    paymentService,
  });

  return {
    subscriptionService,
    invoiceService,
    paymentService,
    planLimitService,
    tenantAccessService,
    engine,
  };
}

export function useBilling({ tenantId: tenantIdOverride } = {}) {
  const { user } = useAuth();
  const { currentTenantId } = useTenant();
  const tenantId = tenantIdOverride || currentTenantId || user?.tenant_id || user?.tenantId || "tenant-demo";
  const [refreshKey, setRefreshKey] = useState(0);
  const [hydrateState, setHydrateState] = useState({
    loading: false,
    ready: false,
    error: null,
  });
  const [persistError, setPersistError] = useState(null);

  const store = useMemo(() => getBillingStore(), []);
  const services = useMemo(() => buildServices(store), [store, refreshKey]);
  const {
    subscriptionService,
    invoiceService,
    paymentService,
    planLimitService,
    tenantAccessService,
    engine,
  } = services;

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  const persistChanges = useCallback(
    async (collections = []) => {
      if (!isSupabaseBillingStore(store)) {
        return { ok: true, errors: [] };
      }

      const result = collections.length
        ? await persistBillingCollections(store, collections)
        : await flushBillingStoreDirty(store);

      if (!result.ok) {
        setPersistError(result.errors?.[0]?.message || "Không thể lưu billing lên Supabase.");
      } else {
        setPersistError(null);
      }

      return result;
    },
    [store]
  );

  const runMutation = useCallback(
    async (mutationFn, collections = []) => {
      const result = mutationFn();
      await persistChanges(collections);
      refresh();
      return result;
    },
    [persistChanges, refresh]
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const runtime = buildServices(store);

      if (isSupabaseBillingStore(store)) {
        setHydrateState({ loading: true, ready: false, error: null });
        const hydrated = await ensureBillingStoreHydrated(store);
        if (cancelled) {
          return;
        }
        if (!hydrated.ok) {
          setHydrateState({
            loading: false,
            ready: false,
            error: hydrated.error || "Không thể tải dữ liệu billing từ Supabase.",
          });
          return;
        }
      } else {
        runtime.engine.seedDefaults();
      }

      if (cancelled) {
        return;
      }

      const existing = runtime.subscriptionService.getByTenant(tenantId);
      if (!existing) {
        if (isSupabaseBillingStore(store)) {
          const trial = await ensureTrialSubscriptionRpc(store, { tenantId });
          if (!trial.ok && !cancelled) {
            setPersistError(
              trial.code === "RPC_NOT_APPLIED"
                ? "Trial RPC chưa apply trên staging — apply docs/supabase-billing-phase9-trial-rpc.sql"
                : trial.error || "Không thể tạo trial subscription qua RPC."
            );
          }
        } else {
          runtime.engine.createTrialSubscription({ tenantId, ownerUserId: user?.id || null });
        }
      }

      if (cancelled) {
        return;
      }

      setHydrateState({ loading: false, ready: true, error: null });
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [store, tenantId, user?.id]);

  const subscription = hydrateState.ready ? subscriptionService.getByTenant(tenantId) : null;
  const planCode = subscription?.plan_code || "TRIAL";
  const hydratedPlans = hydrateState.ready ? store.read("plans") : [];
  const planFromStore = hydratedPlans.find((item) => item.code === planCode);
  const plan = planFromStore || getPlanCatalog().find((item) => item.code === planCode) || getPlanCatalog()[0];
  const access = hydrateState.ready
    ? tenantAccessService.evaluateAccess({ tenantId })
    : { allowed: true, lockLevel: "none", reason: "loading" };
  const invoices = hydrateState.ready ? invoiceService.listByTenant(tenantId) : [];
  const payments = hydrateState.ready ? paymentService.listByTenant(tenantId) : [];
  const usageSummary = hydrateState.ready
    ? planLimitService.getUsageSummary({
        planCode,
        usage: { courts: 4, clubs: 1, players: 10, bookings: 5, tournaments: 0 },
      })
    : [];

  return {
    tenantId,
    store,
    storeMode: store.mode || "local",
    engine,
    subscriptionService,
    invoiceService,
    paymentService,
    planLimitService,
    tenantAccessService,
    subscription,
    plan,
    planCatalog: hydrateState.ready && hydratedPlans.length ? hydratedPlans : getPlanCatalog(),
    access,
    invoices,
    payments,
    usageSummary,
    billingLoading: hydrateState.loading || !hydrateState.ready,
    billingError: hydrateState.error,
    persistError,
    refresh,
    persistChanges,
    changePlan: (nextPlanCode) =>
      runMutation(() => {
        if (!subscription) return null;
        return engine.changePlan(subscription.id, nextPlanCode, { actorUserId: user?.id });
      }, BILLING_PERSIST_SETS.PLAN_CHANGE),
    createInvoice: (amount) =>
      runMutation(() => {
        return invoiceService.createInvoice({
          tenantId,
          subscriptionId: subscription?.id,
          amount,
          currency: plan.currency,
          actorUserId: user?.id,
        });
      }, BILLING_PERSIST_SETS.INVOICE),
    recordManualPayment: async (amount) => {
      const invoice = invoiceService.createInvoice({
        tenantId,
        subscriptionId: subscription?.id,
        amount,
        currency: plan.currency,
        actorUserId: user?.id,
      });
      await paymentService.createPaymentIntent({
        tenantId,
        invoiceId: invoice.id,
        provider: "manual",
        amount,
        currency: plan.currency,
      });
      paymentService.handleProviderSuccess({
        paymentId: paymentService.listByTenant(tenantId).at(-1)?.id,
        actorUserId: user?.id,
      });
      await persistChanges(BILLING_PERSIST_SETS.PAYMENT);
      refresh();
      return invoice;
    },
    requestCancel: () =>
      runMutation(() => {
        if (!subscription) return null;
        return engine.cancelSubscription(subscription.id, { actorUserId: user?.id });
      }, BILLING_PERSIST_SETS.SUBSCRIPTION),
    suspendSubscription: (subscriptionId) =>
      runMutation(
        () => engine.suspendSubscription(subscriptionId, { actorUserId: user?.id }),
        BILLING_PERSIST_SETS.SUBSCRIPTION
      ),
    unlockTenant: (targetTenantId) =>
      runMutation(
        () => engine.unlockTenant(targetTenantId, { actorUserId: user?.id }),
        BILLING_PERSIST_SETS.SUBSCRIPTION
      ),
    markInvoicePaid: (invoiceId, targetTenantId = tenantId) =>
      runMutation(() => {
        const tenantInvoice = invoiceService.getById(invoiceId);
        if (!tenantInvoice) return null;
        invoiceService.markPaid(invoiceId, { actorUserId: user?.id });
        paymentService.recordPayment({
          tenantId: targetTenantId,
          invoiceId,
          provider: "manual",
          amount: tenantInvoice.total_amount,
          currency: tenantInvoice.currency,
          status: "succeeded",
          actorUserId: user?.id,
        });
        return tenantInvoice;
      }, BILLING_PERSIST_SETS.PAYMENT),
    adminChangePlan: (subscriptionId, planCode) =>
      runMutation(
        () => engine.changePlan(subscriptionId, planCode, { actorUserId: user?.id }),
        BILLING_PERSIST_SETS.PLAN_CHANGE
      ),
  };
}
