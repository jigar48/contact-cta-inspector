import type { FindingScope, IntentSignal } from "./types";

/** Bounded label text only; never reads form values, handlers or arbitrary data. */
function text(node: Element): string {
  const pending: Node[] = [node];
  let value = "",
    visited = 0;
  while (pending.length && value.length < 160 && visited++ < 32) {
    const item = pending.pop()!;
    if (item.nodeType === 3) {
      value += item.nodeValue?.slice(0, 160 - value.length) ?? "";
      continue;
    }
    if (item.nodeType !== 1) continue;
    const element = item as Element;
    if (
      ["input", "textarea", "select", "script", "style"].includes(
        element.localName,
      ) ||
      element.getAttribute("aria-hidden") === "true" ||
      element.getAttribute("role") === "textbox" ||
      (element as HTMLElement).isContentEditable ||
      (element.hasAttribute("contenteditable") &&
        element.getAttribute("contenteditable") !== "false")
    )
      continue;
    if (element.localName === "img") {
      value += element.getAttribute("alt")?.slice(0, 160 - value.length) ?? "";
      continue;
    }
    // A broad label subtree cannot force an unbounded child-list allocation.
    const children: Node[] = [];
    let child = element.firstChild;
    while (child && children.length < 16) {
      children.push(child);
      child = child.nextSibling;
    }
    pending.push(...children.reverse());
  }
  return value.replace(/\s+/g, " ").trim();
}
function name(element: Element): string {
  const refs = (element.getAttribute("aria-labelledby") ?? "")
    .slice(0, 512)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  const labelled = refs
    .map((id) => element.ownerDocument.getElementById(id))
    .filter((el): el is HTMLElement => el !== null)
    .map(text)
    .join(" ")
    .slice(0, 160);
  return (
    labelled ||
    element.getAttribute("aria-label")?.slice(0, 160) ||
    text(element) ||
    element.getAttribute("title")?.slice(0, 160) ||
    ""
  );
}
export function contactLabel(label: string): boolean {
  const normalized = label.replace(/\s+/g, " ").trim();
  return (
    /^(?:contact(?: us| support| sales)?|call(?: us| now)?|e-?mail(?: us)?|phone|telephone|whatsapp|live chat|customer (?:care|support)|get in touch|request a callback)[.!…:]*$/i.test(
      normalized,
    ) ||
    /\b(?:whatsapp|contact (?:us|support|sales|our team)|call (?:us|now|support)|e-?mail (?:us|support)|send (?:a )?message|message us|get in touch|talk to (?:us|sales)|chat with (?:us|support)|request a callback)\b/i.test(
      normalized,
    )
  );
}
export function classifyIntent(
  element: Element,
  href: string | null,
  base: string,
): { scope: FindingScope; intent: IntentSignal } {
  const raw = href?.trim() ?? "";
  if (/^(?:mailto|tel):/i.test(raw))
    return { scope: "contact", intent: "destination" };
  try {
    const url = new URL(raw, base);
    if (
      raw &&
      !/^(?:#|undefined$|null$)/i.test(raw) &&
      ["wa.me", "www.wa.me", "api.whatsapp.com"].includes(url.hostname)
    )
      return { scope: "contact", intent: "destination" };
  } catch {
    /* Malformed destinations can still have a clear contact label. */
  }
  if (contactLabel(name(element)))
    return { scope: "contact", intent: "label-or-context" };
  let parent = element.parentElement;
  for (
    let depth = 0;
    parent && depth < 3;
    depth++, parent = parent.parentElement
  ) {
    // Never infer intent from an entire navigation/footer or unrelated sibling text.
    if (
      parent.localName === "nav" ||
      parent.localName === "footer" ||
      parent.getAttribute("role") === "navigation"
    )
      break;
    if (
      parent.localName === "address" ||
      ((parent.localName === "section" ||
        parent.getAttribute("role") === "group") &&
        (parent.hasAttribute("aria-label") ||
          parent.hasAttribute("aria-labelledby")) &&
        contactLabel(name(parent)))
    )
      return { scope: "contact", intent: "label-or-context" };
  }
  return { scope: "general", intent: "none" };
}
