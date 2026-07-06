import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSuggestionRecord,
  isAiSuggestionCloudEnabled,
} from "../src/features/ai-assistant/services/supabaseSuggestionStorage.js";
import { AI_SUGGESTION_STATUS } from "../src/features/ai-assistant/constants/aiConfig.js";

test("buildSuggestionRecord creates pending suggestion with uuid id", () => {
  const record = buildSuggestionRecord({
    tenantId: "venue-1",
    tournamentId: "t-1",
    type: "seed",
    inputSnapshot: { n: 8 },
    outputPayload: { seeds: [] },
    confidence: "high",
    createdBy: "user-1",
  });

  assert.ok(record.id);
  assert.equal(record.tenantId, "venue-1");
  assert.equal(record.tournamentId, "t-1");
  assert.equal(record.status, AI_SUGGESTION_STATUS.PENDING);
  assert.ok(record.expiresAt);
});

test("isAiSuggestionCloudEnabled requires AI engine flag", () => {
  assert.equal(isAiSuggestionCloudEnabled(), false);
});
