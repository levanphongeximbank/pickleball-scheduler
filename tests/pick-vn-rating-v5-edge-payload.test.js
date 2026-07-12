import test from "node:test";
import assert from "node:assert/strict";

import { handleCompleteAssessmentHttpRequest } from "../src/features/pick-vn-rating-v5/server/edgeEntry.js";
import { buildCoreAnswers } from "../src/features/pick-vn-rating-v5/benchmark/personas.js";

function makeRequest(body, headers = {}) {
  return new Request("http://localhost/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("edge handler rejects forbidden top-level field before scoring", async () => {
  const answers = buildCoreAnswers({}, 3);
  const response = await handleCompleteAssessmentHttpRequest(
    makeRequest({
      assessment_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      answers,
      rating_mode: "doubles",
      verified_rating: 4,
    }),
    {
      allowedOrigins: ["*"],
      supabaseUrl: "https://qyewbxjsiiyufanzcjcq.supabase.co",
      createSupabaseClients() {
        throw new Error("must not reach auth when payload invalid");
      },
    },
  );

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.error.code, "FORBIDDEN_PAYLOAD_FIELD");
  assert.ok(json.error.details?.fields?.includes("verified_rating"));
  assert.equal(json.verified_rating, undefined);
});

test("edge handler rejects unknown future field", async () => {
  const answers = buildCoreAnswers({}, 3);
  const response = await handleCompleteAssessmentHttpRequest(
    makeRequest({
      assessment_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      answers,
      rating_mode: "doubles",
      unexpected_future_field: true,
    }),
    { allowedOrigins: ["*"] },
  );
  assert.equal(response.status, 400);
  const json = await response.json();
  assert.equal(json.error.code, "FORBIDDEN_PAYLOAD_FIELD");
});
