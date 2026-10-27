/** A bounded missing-name heuristic, not the full accessible-name algorithm. */
export function confidentlyUnnamed(element: Element): boolean {
  let visited = 0;
  let uncertain = false;

  const read = (node: Element, referenced = false): string => {
    if (++visited > 32) {
      uncertain = true;
      return "";
    }
    if (
      ["aria-label", "alt", "title"].some(
        (attr) => (node.getAttribute(attr)?.length ?? 0) > 160,
      )
    )
      uncertain = true;
    if (node.localName.includes("-") || node.hasAttribute("aria-owns"))
      uncertain = true;
    if (
      ["input", "textarea", "select", "script", "style"].includes(
        node.localName,
      ) ||
      node.hasAttribute("contenteditable") ||
      node.getAttribute("role") === "textbox"
    ) {
      uncertain = true;
      return "";
    }
    if (
      !referenced &&
      (node.getAttribute("aria-hidden") === "true" ||
        node.hasAttribute("hidden"))
    )
      return "";
    const view = node.ownerDocument.defaultView;
    const style = view?.getComputedStyle(node);
    if (view?.CSS?.supports("content", '"x"')) {
      for (const pseudo of ["::before", "::after"]) {
        const content = view.getComputedStyle(node, pseudo).content;
        if (content && !["none", "normal", '""'].includes(content))
          uncertain = true;
      }
    }
    if (
      !referenced &&
      (style?.display === "none" || style?.visibility === "hidden")
    )
      return "";
    if (
      style?.getPropertyValue("content") &&
      !["none", "normal", '""'].includes(style.getPropertyValue("content"))
    )
      uncertain = true;
    if (node.hasAttribute("aria-labelledby")) {
      // Do not approximate chained IDREF naming while traversing a reference.
      // The full algorithm has recursion/context rules; defer rather than warn.
      if (referenced) {
        uncertain = true;
        return "";
      }
      const raw = node.getAttribute("aria-labelledby")!;
      const refs = raw.slice(0, 512).trim().split(/\s+/).filter(Boolean);
      if (raw.length > 512 || refs.length > 4) uncertain = true;
      const targets = refs
        .slice(0, 4)
        .map((id) => node.ownerDocument.getElementById(id));
      if (targets.some(Boolean))
        return targets
          .map((target) => (target ? read(target, true) : ""))
          .join(" ");
    }
    const label = node.getAttribute("aria-label")?.slice(0, 160).trim();
    if (label) return label;
    if (node.localName === "img" || node.localName === "area")
      return (
        node.getAttribute("alt")?.slice(0, 160) ||
        node.getAttribute("title")?.slice(0, 160) ||
        ""
      );
    if (["use", "foreignObject", "slot"].includes(node.localName))
      uncertain = true;
    let value = "",
      count = 0;
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (++count > 16 || value.length >= 160) {
        uncertain = true;
        break;
      }
      if (child.nodeType === 3) {
        if ((child.nodeValue?.length ?? 0) > 160 - value.length)
          uncertain = true;
        value += child.nodeValue?.slice(0, 160 - value.length) ?? "";
      } else if (child.nodeType === 1)
        value +=
          " " +
          read(
            child as Element,
            referenced ||
              ((child as Element).localName === "title" &&
                node.namespaceURI === "http://www.w3.org/2000/svg"),
          );
    }
    return value.trim() || node.getAttribute("title")?.slice(0, 160) || "";
  };
  // Hidden controls and native labels/custom roles require manual review.
  if (
    !["a", "area", "button"].includes(element.localName) ||
    element.hasAttribute("role")
  )
    return false;
  if (
    element.localName === "button" &&
    (element as HTMLButtonElement).labels?.length
  )
    return false;
  let parent: Element | null = element;
  for (
    let depth = 0;
    parent && depth < 3;
    depth++, parent = parent.parentElement
  ) {
    if (parent.matches('[hidden],[aria-hidden="true"],[inert]')) return false;
    const style = element.ownerDocument.defaultView?.getComputedStyle(parent);
    if (style?.display === "none" || style?.visibility === "hidden")
      return false;
  }
  if (
    parent &&
    parent !== element.ownerDocument.body &&
    parent !== element.ownerDocument.documentElement
  )
    return false;
  const value = read(element);
  return !uncertain && !value.trim();
}
