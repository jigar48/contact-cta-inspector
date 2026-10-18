import { classifyIntent } from "./intent";
import type { FindingScope, IntentSignal } from "./types";
export interface Candidate {
  element: Element;
  href: string | null;
  scope: FindingScope;
  intent: IntentSignal;
}
export function extract(
  doc: Document,
  limit = 5000,
): { candidates: Candidate[]; truncated: boolean; frames: number } {
  const candidates: Candidate[] = [];
  let frames = 0;
  const walker = doc.createTreeWalker(doc.documentElement, 1);
  let visited = 0,
    node: Node | null = doc.documentElement;
  while (node && visited++ < 50000) {
    const element = node as Element;
    const tag = element.localName;
    if (tag === "iframe" || tag === "frame") frames++;
    if (
      tag === "a" ||
      tag === "area" ||
      element.matches('button,[role="link"],[role="button"]')
    ) {
      // Never read input values or event handlers. Button labels identify candidates locally.
      const href =
        element.getAttribute("href") ??
        element.getAttributeNS("http://www.w3.org/1999/xlink", "href") ??
        element.getAttribute("data-href");
      const intent = classifyIntent(element, href, doc.baseURI);
      if (
        tag === "a" ||
        tag === "area" ||
        href !== null ||
        element.getAttribute("role") === "link" ||
        intent.scope === "contact"
      )
        candidates.push({ element, href, ...intent });
      if (candidates.length === limit)
        return { candidates, truncated: true, frames };
    }
    node = walker.nextNode();
  }
  return { candidates, truncated: node !== null, frames };
}
