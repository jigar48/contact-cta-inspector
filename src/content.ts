import { inspect } from "./scan";
// A file injection has its own bundled scope; only this small isolated-world registry persists.
const registry = globalThis as typeof globalThis & {
  __ctaInspector?: {
    elements: Map<number, Element>;
    token: string;
    cleanup?: () => void;
    expiry?: ReturnType<typeof setTimeout>;
  };
};
registry.__ctaInspector?.cleanup?.();
if (registry.__ctaInspector?.expiry)
  clearTimeout(registry.__ctaInspector.expiry);
const token = crypto.randomUUID();
const scan = inspect(document, token);
registry.__ctaInspector = { elements: scan.elements, token };
registry.__ctaInspector.expiry = setTimeout(
  () => {
    registry.__ctaInspector?.cleanup?.();
    delete registry.__ctaInspector;
  },
  5 * 60 * 1000,
);
// scripting.executeScript returns the final expression from this IIFE build.
export default scan.result;
