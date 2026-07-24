/**
 * COMMS-05 — Communication SQL migration package (static verification only).
 * Does not connect to a database. Does not invoke Supabase CLI. Does not apply SQL.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forwardPath = path.join(root, "docs/supabase-communication-comms05.sql");
const rollbackPath = path.join(
  root,
  "docs/supabase-communication-comms05-rollback.sql"
);

const REQUIRED_TABLES = [
  "communication_conversations",
  "communication_conversation_participants",
  "communication_message_position_counters",
  "communication_messages",
  "communication_message_reactions",
  "communication_read_cursors",
  "communication_direct_requests",
  "communication_pinned_messages",
  "communication_user_blocks",
  "communication_message_reports",
  "communication_moderation_actions",
  "communication_community_restrictions",
  "communication_idempotency",
  "communication_persistence_events",
];

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

test("COMMS-05 migration files exist at canonical docs/supabase location", () => {
  assert.ok(fs.existsSync(forwardPath));
  assert.ok(fs.existsSync(rollbackPath));
  assert.equal(
    path.relative(root, forwardPath).replace(/\\/g, "/"),
    "docs/supabase-communication-comms05.sql"
  );
});

test("COMMS-05 forward declares AUTHORED_NOT_APPLIED and activation gates", () => {
  const sql = read(forwardPath);
  const body = stripSqlComments(sql);
  assert.match(sql, /MIGRATION_STATUS\s*=\s*AUTHORED_NOT_APPLIED/);
  assert.match(sql, /CLIENT_RLS_POLICY\s*=\s*DEFERRED_FAIL_CLOSED/);
  assert.match(sql, /REALTIME_PUBLICATION\s*=\s*DEFERRED_NOT_ENABLED/);
  assert.match(sql, /SQL_APPLY\s*=\s*DEFERRED_STAGING_FIRST_GATE/);
  assert.match(sql, /DO NOT APPLY/i);
  // Executable body must not enable realtime publication (comments may mention the gate).
  assert.doesNotMatch(body, /alter\s+publication\s+supabase_realtime/i);
});

test("COMMS-05 creates required tables and enables RLS with deny-all", () => {
  const body = stripSqlComments(read(forwardPath));
  for (const table of REQUIRED_TABLES) {
    assert.match(
      body,
      new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, "i"),
      `missing table ${table}`
    );
    assert.match(
      body,
      new RegExp(
        `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
        "i"
      ),
      `RLS not enabled on ${table}`
    );
    assert.match(
      body,
      new RegExp(
        `create\\s+policy\\s+\\w+_deny_all\\s+on\\s+public\\.${table}[\\s\\S]*?using\\s*\\(\\s*false\\s*\\)[\\s\\S]*?with\\s+check\\s*\\(\\s*false\\s*\\)`,
        "i"
      ),
      `deny-all policy missing on ${table}`
    );
  }
});

test("COMMS-05 has no permissive USING (true) / WITH CHECK (true) policies", () => {
  const body = stripSqlComments(read(forwardPath));
  assert.doesNotMatch(body, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(body, /with\s+check\s*\(\s*true\s*\)/i);
});

test("COMMS-05 uniqueness invariants: pair, channel, lobby, participant, pin, pending request", () => {
  const body = stripSqlComments(read(forwardPath));
  assert.match(body, /communication_conversations_direct_pair_uidx/i);
  assert.match(body, /communication_conversations_channel_key_uidx/i);
  assert.match(body, /communication_conversations_community_lobby_uidx/i);
  assert.match(body, /communication_conversations_club_general_uidx/i);
  assert.match(body, /communication_direct_requests_pending_pair_uidx/i);
  assert.match(
    body,
    /primary\s+key\s*\(\s*conversation_id\s*,\s*participant_id\s*\)/i
  );
  assert.match(
    body,
    /create\s+table[\s\S]*communication_pinned_messages[\s\S]*primary\s+key\s*\(\s*conversation_id\s*,\s*message_id\s*\)/i
  );
});

test("COMMS-05 reply same-conversation guard and message ordering objects exist", () => {
  const body = stripSqlComments(read(forwardPath));
  assert.match(body, /communication_assert_reply_same_conversation/i);
  assert.match(body, /communication_allocate_message_position/i);
  assert.match(body, /communication_messages_conv_position_uidx/i);
  assert.match(body, /communication_advance_read_cursor/i);
});

test("COMMS-05 indexes for inbox, pagination, moderation, reports", () => {
  const body = stripSqlComments(read(forwardPath));
  assert.match(body, /communication_participants_participant_idx/i);
  assert.match(body, /communication_messages_conv_created_idx/i);
  assert.match(body, /communication_messages_sender_latest_idx/i);
  assert.match(body, /communication_message_reports_conv_idx/i);
  assert.match(body, /communication_moderation_actions_conv_idx/i);
});

test("COMMS-05 does not invent foreign SoT tables or open grants", () => {
  const body = stripSqlComments(read(forwardPath));
  assert.doesNotMatch(body, /create\s+table\s+if\s+not\s+exists\s+public\.profiles\b/i);
  assert.doesNotMatch(body, /create\s+table\s+if\s+not\s+exists\s+public\.club_members\b/i);
  assert.doesNotMatch(body, /grant\s+.*(anon|authenticated)/i);
  assert.match(body, /revoke\s+all\s+on\s+public\.communication_conversations\s+from\s+anon,\s*authenticated/i);
});

test("COMMS-05 rollback drops only communication_* objects", () => {
  const sql = read(rollbackPath);
  assert.match(sql, /drop\s+table\s+if\s+exists\s+public\.communication_conversations/i);
  assert.doesNotMatch(sql, /drop\s+table\s+if\s+exists\s+public\.profiles/i);
  assert.doesNotMatch(sql, /drop\s+table\s+if\s+exists\s+public\.club_members/i);
  assert.match(sql, /destructive/i);
});
