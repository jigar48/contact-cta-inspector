/** Serialized directly by Chrome: keep self contained and accept only numeric ids and an opaque scan token. */
export function highlight(id: number, token: string): boolean {
  const registry = (
    globalThis as typeof globalThis & {
      __ctaInspector?: {
        elements: Map<number, Element>;
        token: string;
        cleanup?: () => void;
      };
    }
  ).__ctaInspector;
  if (!registry || registry.token !== token || !Number.isSafeInteger(id))
    return false;
  registry.cleanup?.();
  const element = registry.elements.get(id);
  if (!element?.isConnected) return false;
  element.scrollIntoView?.({
    block: "center",
    inline: "nearest",
    behavior: "instant",
  });
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const overlay = document.createElement("div");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText = `position:fixed;pointer-events:none;z-index:2147483647;border:3px solid #087f8c;border-radius:4px;box-shadow:0 0 0 4px #ffffffb3;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;box-sizing:border-box;`;
  document.documentElement.append(overlay);
  const initialX = window.scrollX,
    initialY = window.scrollY;
  // Ignore the queued scroll event caused by our own instant scrollIntoView.
  const onScroll = (event: Event) => {
    if (
      event.isTrusted &&
      event.target === document &&
      window.scrollX === initialX &&
      window.scrollY === initialY
    )
      return;
    cleanup();
  };
  const cleanup = () => {
    overlay.remove();
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", cleanup);
  };
  registry.cleanup = cleanup;
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", cleanup);
  setTimeout(cleanup, 3000);
  return true;
}
