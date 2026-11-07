import { redact } from "./privacy";
import type { Category, Finding, ScanResult, FindingScope } from "./types";
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
    "Contact CTA Inspector — format and name review",
    `Page origin: ${redact(scan.page)}`,
    `${scan.inspected} elements inspected; ${scan.findings.length} finding groups.`,
    "Top-level DOM only. All frames and shadow roots excluded. No number, inbox or delivery verification.",
    "Contact intent is heuristic. JavaScript event handlers are not inspected or verified. Placeholders and scripted controls are not confirmed broken.",
    "Accessible-name warnings are conservative heuristics, not a complete accessibility audit or WCAG compliance assessment. Affected-element totals sum occurrences per finding; an element can have both a URL and a name finding.",
    scan.truncated ? "Limits reached: results are incomplete." : "",
    section("contact", "Contact-related findings"),
    section("general", "General link-quality observations"),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 150000);
}

const safeCategories: Record<Category, string> = {
  whatsapp: "WhatsApp link format or setup",
  telephone: "Telephone link format or dialing context",
  email: "Email link format or recipient setup",
  placeholder: "Missing, placeholder or scripted link destinations",
  "accessible-name": "Contact controls that may lack an accessible name",
};

/** Emit only aggregate integers and fixed text. Never use detailed report fields. */
export function safeSummary(scan: ScanResult): string {
  const isCount = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (!isCount(scan.inspected) || scan.findings.some((f) => !isCount(f.count)))
    throw new Error("Safe summary unavailable. Re-scan the page.");

  const section = (scope: FindingScope, title: string) => {
    const findings = scan.findings.filter((f) => f.scope === scope);
    const { groups, occurrences, errors, warnings, infos } =
      summarize(findings);
    return [
      title,
      `Finding groups — ${groups}. Occurrences — ${occurrences}.`,
      `Groups by severity — error ${errors}, warning ${warnings}, info ${infos}.`,
      ...Object.entries(safeCategories).flatMap(([category, description]) => {
        const counts = summarize(
          findings.filter((f) => f.category === category),
        );
        return counts.groups
          ? [
              `- ${description} — groups ${counts.groups}, occurrences ${counts.occurrences}.`,
            ]
          : [];
      }),
    ].join("\n");
  };

  return [
    "Contact CTA Inspector — safe summary",
    `Elements inspected — ${scan.inspected}.`,
    ...(scan.truncated === true
      ? [
          "Scan limits reached. Results are incomplete and counts reflect retained findings.",
        ]
      : []),
    section("contact", "Contact-related findings"),
    section("general", "General link-quality observations"),
    "Occurrences are summed per finding group. One element can contribute to multiple groups.",
    "Findings are heuristic. They do not prove that a CTA is broken or establish WCAG compliance.",
  ].join("\n\n");
}
