/**
 * Deterministic presentation-ready CSV / JSON export renderers (REPORTING-02).
 * Accepts operational rows only. No production file I/O. No fake URLs.
 */

import { REPORT_EXPORT_FORMAT } from "../constants/parameterTypes.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { ReportingError } from "../errors/ReportingError.js";

/**
 * @param {unknown} value
 * @returns {string}
 */
export function escapeCsvCell(value) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * @param {ReadonlyArray<string>} columns
 * @param {ReadonlyArray<object>} rows
 * @returns {string}
 */
export function renderCsvFromPresentationRows(columns, rows) {
  const header = columns.map(escapeCsvCell).join(",");
  const body = (rows || []).map((row) =>
    columns.map((col) => escapeCsvCell(row?.[col])).join(",")
  );
  return [header, ...body].join("\n");
}

/**
 * @param {ReadonlyArray<string>} columns
 * @param {ReadonlyArray<object>} rows
 * @returns {string}
 */
export function renderJsonFromPresentationRows(columns, rows) {
  const projected = (rows || []).map((row) => {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const col of columns) {
      out[col] = row?.[col] ?? null;
    }
    return out;
  });
  return JSON.stringify({ columns: [...columns], rows: projected });
}

/**
 * @param {{ format: string, contentType: string, body: string, byteLength: number }}
 */
function utf8ByteLength(text) {
  return new TextEncoder().encode(String(text ?? "")).length;
}

/**
 * @param {{
 *   format: string,
 *   columns: ReadonlyArray<string>,
 *   rows: ReadonlyArray<object>,
 * }} args
 * @returns {{ format: string, contentType: string, body: string, byteLength: number }}
 */
export function renderPresentationExport(args) {
  const format = String(args.format || "").trim();
  const columns = Array.isArray(args.columns) ? args.columns.map(String) : [];
  if (!columns.length) {
    throw new ReportingError(
      REPORTING_ERROR_CODE.INVALID_COLUMN_SELECTION,
      "Export renderer requires at least one column"
    );
  }
  if (format === REPORT_EXPORT_FORMAT.CSV) {
    const body = renderCsvFromPresentationRows(columns, args.rows || []);
    return {
      format,
      contentType: "text/csv; charset=utf-8",
      body,
      byteLength: utf8ByteLength(body),
    };
  }
  if (format === REPORT_EXPORT_FORMAT.JSON) {
    const body = renderJsonFromPresentationRows(columns, args.rows || []);
    return {
      format,
      contentType: "application/json; charset=utf-8",
      body,
      byteLength: utf8ByteLength(body),
    };
  }
  throw new ReportingError(
    REPORTING_ERROR_CODE.INVALID_EXPORT_FORMAT,
    `Renderer does not support format: ${format || "(empty)"}`,
    { format }
  );
}
