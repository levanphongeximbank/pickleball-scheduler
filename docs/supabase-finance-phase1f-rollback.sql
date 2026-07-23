-- =============================================================================
-- PICK_VN — Finance Foundation Phase 1F ROLLBACK
-- =============================================================================
-- Filename: docs/supabase-finance-phase1f-rollback.sql
-- Forward:  docs/supabase-finance-phase1f.sql
--
-- WARNING: Applying this rollback DESTROYS all operational Finance data in
-- finance_* tables. Irreversible without a prior backup.
--
-- Scope: Finance-owned objects ONLY (public.finance_*).
-- Never drops Billing (public.invoices, public.payments, …),
-- Subscription, Competition, or other module objects.
-- Never uses broad CASCADE.
--
-- Status: Rollback authored for emergency use only.
--   Forward SQL was applied to Staging only (Phase 1H).
--   Do not run against Staging or Production without explicit Owner
--   authorization, backup verification, and a documented rollback window.
--   Production was not authorized for Finance SQL apply.
-- =============================================================================

-- Drop policies first (reverse of enablement)
drop policy if exists finance_idempotency_update on public.finance_idempotency;
drop policy if exists finance_idempotency_insert on public.finance_idempotency;
drop policy if exists finance_idempotency_select on public.finance_idempotency;

drop policy if exists finance_events_insert on public.finance_events;
drop policy if exists finance_events_select on public.finance_events;

drop policy if exists finance_refunds_update on public.finance_refunds;
drop policy if exists finance_refunds_insert on public.finance_refunds;
drop policy if exists finance_refunds_select on public.finance_refunds;

drop policy if exists finance_receipts_insert on public.finance_receipts;
drop policy if exists finance_receipts_select on public.finance_receipts;

drop policy if exists finance_payment_attempts_update on public.finance_payment_attempts;
drop policy if exists finance_payment_attempts_insert on public.finance_payment_attempts;
drop policy if exists finance_payment_attempts_select on public.finance_payment_attempts;

drop policy if exists finance_payments_update on public.finance_payments;
drop policy if exists finance_payments_insert on public.finance_payments;
drop policy if exists finance_payments_select on public.finance_payments;

drop policy if exists finance_invoice_items_update on public.finance_invoice_items;
drop policy if exists finance_invoice_items_insert on public.finance_invoice_items;
drop policy if exists finance_invoice_items_select on public.finance_invoice_items;

drop policy if exists finance_invoices_update on public.finance_invoices;
drop policy if exists finance_invoices_insert on public.finance_invoices;
drop policy if exists finance_invoices_select on public.finance_invoices;

drop policy if exists finance_obligations_update on public.finance_obligations;
drop policy if exists finance_obligations_insert on public.finance_obligations;
drop policy if exists finance_obligations_select on public.finance_obligations;

drop policy if exists finance_audit_evidence_update on public.finance_audit_evidence;
drop policy if exists finance_audit_evidence_insert on public.finance_audit_evidence;
drop policy if exists finance_audit_evidence_select on public.finance_audit_evidence;

drop policy if exists finance_fee_definitions_update on public.finance_fee_definitions;
drop policy if exists finance_fee_definitions_insert on public.finance_fee_definitions;
drop policy if exists finance_fee_definitions_select on public.finance_fee_definitions;

-- Drop child tables before parents (dependency order)
drop table if exists public.finance_idempotency;
drop table if exists public.finance_events;
drop table if exists public.finance_refunds;
drop table if exists public.finance_receipts;
drop table if exists public.finance_payment_attempts;
drop table if exists public.finance_payments;
drop table if exists public.finance_invoice_items;

-- Break obligation → invoice FK before dropping invoices
alter table if exists public.finance_obligations
  drop constraint if exists finance_obligations_invoice_fk;

drop table if exists public.finance_invoices;
drop table if exists public.finance_obligations;
drop table if exists public.finance_audit_evidence;
drop table if exists public.finance_fee_definitions;

-- End Finance Phase 1F rollback (Finance objects only; no Billing/foreign DROP).
