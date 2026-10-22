import { redact } from "./privacy";
import type { Finding, ScanResult } from "./types";

/** Hard bounds protect the popup; oversized exports fail instead of losing findings. */
export const MAX_JSON_LENGTH = 1_000_000;
export interface JsonFinding {
  category: Finding["category"];
  severity: Finding["severity"];
  intent: Finding["intent"];
  count: number;
  destination: string;
  explanation: string;
  suggestedFix: string;
}
export interface JsonReport {
  schemaVersion: 1;
  pageOrigin: string;
  inspected: number;
  truncated: boolean;
  contactFindings: JsonFinding[];
  generalObservations: JsonFinding[];
}

const invalid = () =>
  new Error(
    "JSON export unavailable: invalid or oversized scan. Re-scan the page.",
  );
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;
function text(value: string): string {
  if (typeof value !== "string" || value.length > 4096) throw invalid();
  return value;
}

/** Explicit fields only: no labels, element IDs, tokens, or arbitrary object keys. */
export function jsonReport(scan: ScanResult): string {
  if (
    !Array.isArray(scan.findings) ||
    scan.findings.length > 250 ||
    !integer(scan.inspected) ||
    typeof scan.truncated !== "boolean"
  )
    throw invalid();
  let pageOrigin = "null";
  const page = text(scan.page);
  if (page !== "null") {
    try {
      const url = new URL(page);
      if (!["http:", "https:", "file:"].includes(url.protocol)) throw invalid();
      pageOrigin = url.origin;
    } catch {
      throw invalid();
    }
  }
  const result: JsonReport = {
    schemaVersion: 1,
    pageOrigin,
    inspected: scan.inspected,
    truncated: scan.truncated,
    contactFindings: [],
    generalObservations: [],
  };
  for (const f of scan.findings) {
    if (
      !f ||
      !["contact", "general"].includes(f.scope) ||
      !["whatsapp", "telephone", "email", "placeholder"].includes(f.category) ||
      !["error", "warning", "info"].includes(f.severity) ||
      !["destination", "label-or-context", "none"].includes(f.intent) ||
      !integer(f.count) ||
      f.count === 0
    )
      throw invalid();
    const finding: JsonFinding = {
      category: f.category,
      severity: f.severity,
      intent: f.intent,
      count: f.count,
      destination: redact(text(f.link)),
      explanation: text(f.explanation),
      suggestedFix: text(f.fix),
    };
    (f.scope === "contact"
      ? result.contactFindings
      : result.generalObservations
    ).push(finding);
  }
  const serialized = JSON.stringify(result, null, 2);
  if (serialized.length > MAX_JSON_LENGTH) throw invalid();
  return serialized;
}
