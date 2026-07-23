import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createIntegrationPortDescriptor,
  isIntegrationPortDescriptor,
  INTEGRATION_PORT_DESCRIPTOR_ERROR,
} from "./integrationPortDescriptor.js";

test("valid minimal integration port descriptor", () => {
  const result = createIntegrationPortDescriptor({
    portName: "identityEvidencePort",
    ownerModule: "platform-core",
    direction: "inbound",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.portName, "identityEvidencePort");
  assert.equal(result.value.ownerModule, "platform-core");
  assert.equal(result.value.direction, "inbound");
  assert.equal("version" in result.value, false);
});

test("valid full integration port descriptor", () => {
  const result = createIntegrationPortDescriptor({
    portName: "  teamAuthPort  ",
    ownerModule: "  competition-core  ",
    direction: "  outbound  ",
    version: "  1.0.0  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.portName, "teamAuthPort");
  assert.equal(result.value.ownerModule, "competition-core");
  assert.equal(result.value.direction, "outbound");
  assert.equal(result.value.version, "1.0.0");
});

test("empty portName is rejected", () => {
  const result = createIntegrationPortDescriptor({
    portName: "  ",
    ownerModule: "platform-core",
    direction: "inbound",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    INTEGRATION_PORT_DESCRIPTOR_ERROR.PORT_NAME_INVALID
  );
});

test("non-string ownerModule is rejected", () => {
  const result = createIntegrationPortDescriptor({
    portName: "p",
    ownerModule: 12,
    direction: "inbound",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    INTEGRATION_PORT_DESCRIPTOR_ERROR.OWNER_MODULE_INVALID
  );
});

test("empty direction is rejected", () => {
  const result = createIntegrationPortDescriptor({
    portName: "p",
    ownerModule: "m",
    direction: "",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    INTEGRATION_PORT_DESCRIPTOR_ERROR.DIRECTION_INVALID
  );
});

test("invalid version is rejected", () => {
  const result = createIntegrationPortDescriptor({
    portName: "p",
    ownerModule: "m",
    direction: "inbound",
    version: "   ",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    INTEGRATION_PORT_DESCRIPTOR_ERROR.VERSION_INVALID
  );
});

test("optional version absent is not auto-created", () => {
  const result = createIntegrationPortDescriptor({
    portName: "p",
    ownerModule: "m",
    direction: "inbound",
  });
  assert.equal(result.ok, true);
  assert.equal("version" in result.value, false);
});

test("output is frozen", () => {
  const result = createIntegrationPortDescriptor({
    portName: "p",
    ownerModule: "m",
    direction: "inbound",
  });
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.throws(() => {
    result.value.portName = "x";
  }, TypeError);
});

test("does not create adapters or connect APIs", () => {
  const source = fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "integrationPortDescriptor.js"
    ),
    "utf8"
  );
  assert.equal(/createClient|dependencyInjection|supabase/.test(source), false);
  assert.equal(/from ["'].*features\//.test(source), false);
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("randomUUID"), false);
});

test("isIntegrationPortDescriptor true/false is correct", () => {
  const valid = createIntegrationPortDescriptor({
    portName: "p",
    ownerModule: "m",
    direction: "inbound",
  });
  assert.equal(valid.ok, true);
  assert.equal(isIntegrationPortDescriptor(valid.value), true);
  assert.equal(isIntegrationPortDescriptor({ portName: "p" }), false);
  assert.equal(isIntegrationPortDescriptor(null), false);
});
