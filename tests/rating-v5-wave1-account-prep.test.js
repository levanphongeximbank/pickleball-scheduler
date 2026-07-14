import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  WAVE1_MANIFEST,
  WAVE0_EMAILS,
  STAGING_REF,
  PRODUCTION_REF,
} from "../scripts/lib/rating-v5-wave1-manifest.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prepareSource = fs.readFileSync(
  path.join(rootDir, "scripts/prepare-rating-v5-wave1-accounts.mjs"),
  "utf8",
);
const cohortCsv = fs.readFileSync(
  path.join(rootDir, "docs/v5/rating-v5/V5-C1C_WAVE1_COHORT_REVIEW.csv"),
  "utf8",
);

test("wave1 manifest uses staging ref guard constants", () => {
  assert.equal(STAGING_REF, "qyewbxjsiiyufanzcjcq");
  assert.equal(PRODUCTION_REF, "expuvcohlcjzvrrauvud");
});

test("wave1 manifest excludes wave0 emails", () => {
  for (const slot of WAVE1_MANIFEST) {
    assert.equal(WAVE0_EMAILS.has(slot.email), false, slot.email);
    assert.match(slot.email, /@staging\.local$/i);
  }
});

test("wave1 manifest candidate count within 10-20", () => {
  assert.ok(WAVE1_MANIFEST.length >= 10 && WAVE1_MANIFEST.length <= 20);
});

test("prepare script blocks production ref in source guard", () => {
  assert.match(prepareSource, /PRODUCTION_REF/);
  assert.match(prepareSource, /assertStaging/);
  assert.doesNotMatch(prepareSource, /PickleStaging/);
});

test("prepare script does not log password", () => {
  assert.doesNotMatch(prepareSource, /console\.log\([^)]*password/i);
});

test("cohort csv has no jwt or password material", () => {
  assert.doesNotMatch(cohortCsv, /eyJ[a-zA-Z0-9_-]+\./);
  assert.doesNotMatch(cohortCsv, /password/i);
});

test("cohort csv skill band distribution meets minimum", () => {
  const lines = cohortCsv.trim().split(/\r?\n/).slice(1);
  const bands = { "1.5-2.5": 0, "3.0-3.5": 0, "4.0-4.5": 0 };
  for (const line of lines) {
    const band = line.split(",")[8];
    if (bands[band] != null) bands[band] += 1;
  }
  assert.ok(bands["1.5-2.5"] >= 4);
  assert.ok(bands["3.0-3.5"] >= 4);
  assert.ok(bands["4.0-4.5"] >= 2);
});

test("cohort csv coach estimates not invented", () => {
  const lines = cohortCsv.trim().split(/\r?\n/).slice(1);
  for (const line of lines) {
    const cols = line.split(",");
    const coachEstimate = cols[9];
    const coachConfidence = cols[10];
    const coachReviewer = cols[11];
    const coachReviewedAt = cols[12];
    const coachStatus = cols[13];
    assert.equal(coachEstimate, "");
    assert.equal(coachConfidence, "");
    assert.equal(coachReviewer, "");
    assert.equal(coachReviewedAt, "");
    assert.equal(coachStatus, "PENDING_COACH_REVIEW");
  }
});

test("cohort csv enrollment status none for all slots", () => {
  const lines = cohortCsv.trim().split(/\r?\n/).slice(1);
  for (const line of lines) {
    const enrollment = line.split(",")[16];
    assert.equal(enrollment, "none");
  }
});

test("duplicate emails absent in cohort csv", () => {
  const lines = cohortCsv.trim().split(/\r?\n/).slice(1);
  const emails = lines.map((l) => l.split(",")[3].toLowerCase());
  assert.equal(emails.length, new Set(emails).size);
});

test("duplicate auth ids absent in cohort csv", () => {
  const lines = cohortCsv.trim().split(/\r?\n/).slice(1);
  const ids = lines.map((l) => l.split(",")[1]);
  assert.equal(ids.length, new Set(ids).size);
});

test("new wave1 accounts follow naming convention", () => {
  const created = WAVE1_MANIFEST.filter((s) => s.create);
  assert.equal(created.length, 10);
  for (const slot of created) {
    assert.match(slot.email, /^rating\.wave1\.\d{2}@staging\.local$/);
  }
});
