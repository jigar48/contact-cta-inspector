import { redact } from "./privacy";
import type { Finding, ScanResult, FindingScope } from "./types";
export function summarize(findings: Finding[]) {
  return {
    groups: findings.length,
    occurrences: findings.reduce((sum, f) => sum + f.count, 0),
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    infos: findings.filter((f) => f.severity === "info").length,
  };
}
export function filterFindings(
  findings: Finding[],
  category: string,
  severity: string,
  scope?: FindingScope,
): Finding[] {
  return findings.filter(
    (f) =>
      (!scope || f.scope === scope) &&
      (category === "all" || f.category === category) &&
      (severity === "all" || f.severity === severity),
  );
}
export function report(scan: ScanResult): string {
  const section = (scope: FindingScope, title: string) => {
    const findings = scan.findings.filter((f) => f.scope === scope),
      counts = summarize(findings);
    return [
      `${title}: ${counts.groups} ${counts.groups === 1 ? "group" : "groups"} · ${counts.occurrences} affected ${counts.occurrences === 1 ? "element" : "elements"}`,
      `${counts.errors} error groups · ${counts.warnings} warning groups · ${counts.infos} info groups`,
      ...findings.map(
        (f) =>
          `[${f.severity.toUpperCase()}] ${f.category} (${f.count} occurrence${f.count === 1 ? "" : "s"})\n${redact(f.link)}\nIntent: ${f.intent === "destination" ? "Contact destination" : f.intent === "label-or-context" ? "Contact label/context (heuristic)" : "No clear contact signal"}\n${f.explanation}\nSuggested fix: ${f.fix}`,
      ),
    ].join("\n\n");
  };
  return [
    "Contact CTA Inspector — format review",
    `Page origin: ${redact(scan.page)}`,
    `${scan.inspected} elements inspected; ${scan.findings.length} finding groups.`,
    "Top-level DOM only. All frames and shadow roots excluded. No number, inbox or delivery verification.",
    "Contact intent is heuristic. JavaScript event handlers are not inspected or verified. Placeholders and scripted controls are not confirmed broken.",
    scan.truncated ? "Limits reached: results are incomplete." : "",
    section("contact", "Contact-related findings"),
    section("general", "General link-quality observations"),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 150000);
}
