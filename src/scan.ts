import { extract } from "./extract";
import { validate } from "./rules";
import { redact } from "./privacy";
import type { Finding, ScanResult } from "./types";
export function inspect(
  doc: Document,
  token: string,
): { result: ScanResult; elements: Map<number, Element> } {
  if (
    !doc.documentElement ||
    !["text/html", "application/xhtml+xml", "image/svg+xml"].includes(
      doc.contentType,
    )
  )
    throw new Error("Unsupported document type");
  const { candidates, truncated, frames } = extract(doc);
  const findings: Finding[] = [],
    elements = new Map<number, Element>(),
    duplicates = new Map<string, Finding>();
  // Contact groups receive the bounded report budget before general observations.
  const prioritized = [
    ...candidates.filter((c) => c.scope === "contact"),
    ...candidates.filter((c) => c.scope === "general"),
  ];
  for (const { element, href, scope, intent } of prioritized) {
    if (href !== null && href.length > 4096) continue;
    const verdict = validate(href, doc.baseURI);
    if (!verdict) continue;
    const link = href === null ? "[missing href]" : redact(href);
    const key = JSON.stringify([verdict, href, scope]);
    const previous = duplicates.get(key);
    if (previous) {
      previous.count++;
      continue;
    }
    if (findings.length >= 250) continue;
    const id = findings.length;
    const finding = {
      id,
      ...verdict,
      link,
      count: 1,
      scope,
      intent,
      ...(scope === "general" && verdict.category === "placeholder"
        ? {
            fix: "Use a meaningful destination or verify the intended scripted behavior and keyboard access manually.",
          }
        : {}),
    };
    findings.push(finding);
    duplicates.set(key, finding);
    elements.set(id, element);
  }
  return {
    result: {
      findings,
      inspected: candidates.length,
      truncated:
        truncated ||
        findings.length >= 250 ||
        candidates.some((c) => (c.href?.length ?? 0) > 4096),
      frames,
      page: new URL(doc.URL).origin,
      token,
    },
    elements,
  };
}
