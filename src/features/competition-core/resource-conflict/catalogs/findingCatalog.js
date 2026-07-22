/**
 * CORE-14 — finding / diagnostic catalog data surfaces.
 */

import {
  RESOURCE_FINDING_CODE,
  RESOURCE_FINDING_CODE_VALUES,
} from "../enums/findingCode.js";
import {
  INPUT_DIAGNOSTIC_CODE,
  INPUT_DIAGNOSTIC_CODE_VALUES,
} from "../enums/diagnosticCode.js";
import { HARD_MINIMUM_FINDING_CODES } from "./severityPolicy.js";

export const FINDING_CATALOG = Object.freeze({
  codes: RESOURCE_FINDING_CODE,
  values: RESOURCE_FINDING_CODE_VALUES,
  hardMinimumCodes: HARD_MINIMUM_FINDING_CODES,
});

export const DIAGNOSTIC_CATALOG = Object.freeze({
  codes: INPUT_DIAGNOSTIC_CODE,
  values: INPUT_DIAGNOSTIC_CODE_VALUES,
});

export { RESOURCE_FINDING_CODE, INPUT_DIAGNOSTIC_CODE };
