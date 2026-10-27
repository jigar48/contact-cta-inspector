import "./style.css";
import { jsonReport } from "./json-report";
import { scanTab, highlightTab } from "./bridge";
import { filterFindings, report, summarize } from "./report";
import type { ScanResult, Category, FindingScope } from "./types";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header><span class="brand-icon" aria-hidden="true">✓</span><div class="brand"><h1>Contact CTA Inspector</h1><p class="subtitle">Contact format & name checks</p></div><button id="scan" class="primary">Scan page</button></header>
  <p id="status" role="status" aria-live="polite">Nothing is scanned automatically.</p>
  <div id="initial" class="initial"><strong>Ready to inspect contact links</strong><p>Review contact formats, likely missing names and contact-labelled controls. General link observations are kept separate.</p></div>
  <main id="results" hidden aria-label="Scan results" aria-busy="false">
    <div id="summary" class="summary" aria-label="Scan summary">
      <div class="stat"><strong id="inspected">0</strong><span>Inspected</span></div>
      <div class="stat error"><strong id="errors">0</strong><span>Errors</span></div>
      <div class="stat warning"><strong id="warnings">0</strong><span>Warnings</span></div>
      <div class="stat info"><strong id="infos">0</strong><span>Info</span></div>
    </div>
    <div class="view-row"><label for="view">View<select id="view"><option value="contact">Contact findings</option><option value="general">General link observations</option></select></label></div>
    <div class="filters"><label for="category">Category<select id="category"><option value="all">All categories</option><option value="whatsapp">WhatsApp</option><option value="telephone">Telephone</option><option value="email">Email</option><option value="placeholder">Placeholder</option><option value="accessible-name">Accessible name</option></select></label><label for="severity">Severity<select id="severity"><option value="all">All severities</option><option value="error">Errors</option><option value="warning">Warnings</option><option value="info">Information</option></select></label></div>
    <div class="results-heading"><h2 id="section-title">Contact findings</h2><span id="shown"></span></div>
    <p id="limit" class="note" hidden>Scan limits reached; results are incomplete.</p>
    <div id="findings" role="region" aria-label="Contact link findings" tabindex="0"></div>
    <div class="report-bar"><span>Severity counts = groups in this view</span><button id="copy" class="secondary" aria-label="Copy full redacted report">Copy both sections</button><button id="copy-json" class="secondary" aria-label="Copy JSON for both sections">Copy JSON</button></div>
    <details id="fallback" hidden><summary>Copy report manually</summary><textarea id="report" readonly aria-label="Redacted report"></textarea></details>
  </main>
  <footer><details><summary>Scope & privacy</summary><p id="scope">Top-level DOM only. All frames, including inaccessible frames, and shadow roots are not scanned.</p><p>Contact intent uses destination and bounded label/context heuristics; it can miss or misclassify controls. Placeholders and JavaScript links are not confirmed broken. Event handlers and actual contact delivery are not verified.</p><p>Name warnings are conservative; this is not a complete accessibility audit. Element totals sum occurrences per finding, so one control can count in multiple groups.</p><p>Queries, fragments and URL credentials are hidden. Contact addresses can remain visible. No form data is collected, no destinations are opened and no network checks are made.</p><p>By Jigar Prajapati · Results are discarded when this popup closes.</p></details></footer>`;
const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let current: ScanResult | undefined, tabId: number | undefined;
let copyAttempt = 0;
const status = (message: string) => {
  get("status").textContent = message;
};
const categories: Record<Category, string> = {
  whatsapp: "WhatsApp",
  telephone: "Telephone",
  email: "Email",
  placeholder: "Placeholder",
  "accessible-name": "Accessible name",
};
get("app").dataset.state = "initial";
// Let Chrome measure natural content first. A viewport-height cap during the
// initial 25px popup measurement traps intrinsic sizing at that tiny height.
let resizeTimer: ReturnType<typeof setTimeout>;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (
      current &&
      window.innerHeight >= 300 &&
      get("app").getBoundingClientRect().height > window.innerHeight + 2
    )
      get("app").style.maxHeight = `${Math.min(580, window.innerHeight)}px`;
  }, 100);
});

function render() {
  if (!current) return;
  const container = get("findings");
  container.replaceChildren();
  container.scrollTop = 0;
  const view = get<HTMLSelectElement>("view").value as FindingScope;
  const viewFindings = current.findings.filter((f) => f.scope === view);
  const counts = summarize(viewFindings);
  for (const scope of ["contact", "general"] as const) {
    const totals = summarize(current.findings.filter((f) => f.scope === scope));
    get<HTMLSelectElement>("view").querySelector<HTMLOptionElement>(
      `option[value="${scope}"]`,
    )!.textContent =
      `${scope === "contact" ? "Contact findings" : "General observations"} · ${totals.groups} ${totals.groups === 1 ? "group" : "groups"} / ${totals.occurrences} ${totals.occurrences === 1 ? "element" : "elements"}`;
  }
  const filtered = filterFindings(
    current.findings,
    get<HTMLSelectElement>("category").value,
    get<HTMLSelectElement>("severity").value,
    view,
  );
  for (const [id, value] of [
    ["inspected", current.inspected],
    ["errors", counts.errors],
    ["warnings", counts.warnings],
    ["infos", counts.infos],
  ] as const)
    get(id).textContent = String(value);
  get("summary").setAttribute(
    "aria-label",
    `Inspected elements and severity groups in ${view === "contact" ? "contact findings" : "general observations"}; category and severity filters affect cards only`,
  );
  get("section-title").textContent =
    view === "contact" ? "Contact findings" : "General observations";
  const displayed = summarize(filtered);
  get("shown").textContent =
    `${filtered.length} of ${counts.groups} ${counts.groups === 1 ? "group" : "groups"} · ${displayed.occurrences} ${displayed.occurrences === 1 ? "element" : "elements"}`;
  get("limit").hidden = !current.truncated;
  get("scope").textContent =
    `${current.frames} frames encountered; all frames, including inaccessible frames, and shadow roots are excluded. Top-level DOM only.`;
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    const title = document.createElement("strong");
    title.textContent = viewFindings.length
      ? "No matching findings"
      : view === "contact"
        ? "No contact findings detected"
        : "No general observations";
    const text = document.createElement("span");
    text.textContent = viewFindings.length
      ? "Try another category or severity."
      : view === "contact"
        ? "General observations are available in View. Test contact actions manually."
        : "No general link observations within this scan’s limits.";
    empty.append(title, text);
    container.append(empty);
  }
  for (const f of filtered) {
    const card = document.createElement("article");
    card.className = `card ${f.severity}`;
    const header = document.createElement("div");
    header.className = "card-heading";
    const heading = document.createElement("h3");
    heading.textContent = categories[f.category];
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent =
      f.severity === "info"
        ? "Info"
        : f.severity === "error"
          ? "Error"
          : "Warning";
    header.append(heading, badge);
    const link = document.createElement("code");
    link.textContent = f.link || "[empty href]";
    link.setAttribute("aria-label", "Affected link");
    const explanation = document.createElement("p");
    explanation.textContent = f.explanation;
    const intent = document.createElement("p");
    intent.className = "intent";
    intent.textContent =
      f.intent === "destination"
        ? "Contact destination"
        : f.intent === "label-or-context"
          ? "Contact label/context · heuristic"
          : "No clear contact signal · manual review";
    const fix = document.createElement("p");
    fix.className = "fix";
    fix.textContent = `Fix: ${f.fix}`;
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const occurrences = document.createElement("span");
    occurrences.className = "occurrences";
    occurrences.textContent = `${f.count} ${f.count === 1 ? "element" : "elements"}`;
    const button = document.createElement("button");
    button.className = "locate";
    button.textContent = "Highlight";
    button.setAttribute(
      "aria-label",
      `Highlight first ${categories[f.category]} element: ${f.link || "empty href"}`,
    );
    button.addEventListener("click", async () => {
      try {
        status(
          (await highlightTab(tabId!, f.id, current!.token))
            ? "Highlighted for 3 seconds. Scroll or resize clears it."
            : "Element is hidden, removed or the scan expired. Re-scan the page.",
        );
      } catch {
        status("Page changed or access was lost. Re-scan the page.");
      }
    });
    actions.append(occurrences, button);
    card.append(header, link, explanation, fix, intent, actions);
    container.append(card);
  }
}
get("scan").addEventListener("click", async () => {
  const button = get<HTMLButtonElement>("scan");
  button.disabled = true;
  get("app").style.maxHeight = "580px";
  button.textContent = "Scanning…";
  get("app").dataset.state = "scanning";
  get("results").setAttribute("aria-busy", "true");
  get("results").hidden = true;
  get("initial").hidden = true;
  get("fallback").hidden = true;
  get<HTMLTextAreaElement>("report").value = "";
  copyAttempt++;
  current = undefined;
  get<HTMLSelectElement>("view").value = "contact";
  status("Inspecting accessible top-level links…");
  try {
    const scan = await scanTab();
    current = scan.result;
    tabId = scan.tabId;
    get("results").hidden = false;
    render();
    get("app").dataset.state = current.findings.some(
      (f) => f.scope === "contact",
    )
      ? "results"
      : "empty";
    status("Scan complete · Format/name heuristics; delivery not verified.");
  } catch (error) {
    get("app").dataset.state = "error";
    status(
      error instanceof Error ? error.message : "Scan failed. Please retry.",
    );
  } finally {
    button.disabled = false;
    button.textContent = "Re-scan";
    get("results").setAttribute("aria-busy", "false");
  }
});
for (const id of ["category", "severity", "view"])
  get(id).addEventListener("change", render);
async function copyReport(format: "text" | "json") {
  if (!current) return;
  const attempt = ++copyAttempt;
  get("fallback").hidden = true;
  get<HTMLTextAreaElement>("report").value = "";
  let text: string;
  try {
    text = format === "json" ? jsonReport(current) : report(current);
  } catch {
    status(
      "JSON export unavailable: invalid or oversized scan. Re-scan the page.",
    );
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    if (attempt !== copyAttempt) return;
    status(
      format === "json"
        ? "JSON for both sections copied."
        : "Full redacted report copied.",
    );
  } catch {
    if (attempt !== copyAttempt) return;
    get("fallback").hidden = false;
    get<HTMLDetailsElement>("fallback").open = true;
    get<HTMLTextAreaElement>("report").setAttribute(
      "aria-label",
      format === "json" ? "Redacted JSON report" : "Redacted report",
    );
    get<HTMLTextAreaElement>("report").value = text;
    get<HTMLTextAreaElement>("report").focus();
    get<HTMLTextAreaElement>("report").select();
    status("Clipboard unavailable. Select and copy the report below.");
  }
}
get("copy").addEventListener("click", () => void copyReport("text"));
get("copy-json").addEventListener("click", () => void copyReport("json"));
