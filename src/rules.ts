import type { Category, Severity } from "./types";
export interface Verdict {
  category: Category;
  severity: Severity;
  explanation: string;
  fix: string;
}
const result = (
  category: Category,
  severity: Severity,
  explanation: string,
  fix: string,
): Verdict => ({ category, severity, explanation, fix });
function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
function mailbox(value: string): boolean {
  // Accept quoted local parts and international domains; reject structural impossibilities.
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return false;
  const local = value.slice(0, at),
    domain = value.slice(at + 1);
  const quoted = local.startsWith('"') && local.endsWith('"');
  if (
    !quoted &&
    (/[\s<>(),:;@\\"]/.test(local) ||
      local.startsWith(".") ||
      local.endsWith(".") ||
      local.includes(".."))
  )
    return false;
  return (
    !/[\s/@<>?#]/.test(domain) &&
    !domain.startsWith(".") &&
    !domain.endsWith(".") &&
    !domain.includes("..")
  );
}
export function validate(raw: string | null, base: string): Verdict | null {
  if (raw === null)
    return result(
      "placeholder",
      "info",
      "Clickable element has no link destination; a script may handle it.",
      "Check its keyboard behavior and contact action manually.",
    );
  const href = raw.trim();
  if (
    !href ||
    href === "#" ||
    /^(?:about:blank|#(?:!|void|undefined)|undefined|null)$/i.test(href)
  )
    return result(
      "placeholder",
      "warning",
      "No meaningful link destination; JavaScript may provide behavior.",
      "Use a real contact URL or verify the scripted action manually.",
    );
  if (/^javascript:/i.test(href))
    return result(
      "placeholder",
      "warning",
      "JavaScript-driven link cannot be validated statically.",
      "Prefer a button for scripted behavior; manually test the contact action.",
    );
  if (/^tel:/i.test(href)) {
    const phone = decode(href.slice(4));
    if (phone === null)
      return result(
        "telephone",
        "error",
        "Malformed percent encoding.",
        "Correct the URI percent escapes.",
      );
    const [number, ...params] = phone.split(";");
    if (
      !number ||
      !/^[+\d(). *#-]+$/.test(number) ||
      !/[\d]/.test(number) ||
      /\+/.test(number.slice(1))
    )
      return result(
        "telephone",
        "error",
        "Telephone destination has an invalid structure.",
        "Use tel:+442079460123; keep separators simple.",
      );
    if (
      params.some(
        (p) =>
          !/^(ext=[\d().-]+|phone-context=\+?[\w.-]+|isub=[\w.-]+)$/i.test(p),
      )
    )
      return result(
        "telephone",
        "warning",
        "Telephone parameters need manual review.",
        "Check extension and phone-context syntax against RFC 3966.",
      );
    if (!number.startsWith("+"))
      return result(
        "telephone",
        "info",
        "Local or service number depends on the caller’s region.",
        "Use an international number where appropriate; test on a phone.",
      );
    if (number.replace(/\D/g, "").length > 15)
      return result(
        "telephone",
        "warning",
        "Number exceeds the usual international 15-digit limit.",
        "Review the country code and any extension.",
      );
    return null;
  }
  if (/^mailto:/i.test(href)) {
    const destination = href.slice(7),
      split = destination.indexOf("?");
    const path = split < 0 ? destination : destination.slice(0, split);
    const query = split < 0 ? "" : destination.slice(split + 1);
    const recipients: string[] = [];
    const decoded = decode(path);
    if (decoded === null || decode(query) === null)
      return result(
        "email",
        "error",
        "Malformed percent encoding.",
        "Correct the URI percent escapes.",
      );
    if (decoded)
      recipients.push(...decoded.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/));
    // mailto is not form encoding: a literal + in an address must remain a +.
    const params = new URLSearchParams(query.replace(/\+/g, "%2B"));
    for (const [key, value] of params)
      if (["to", "cc", "bcc"].includes(key.toLowerCase()))
        recipients.push(...value.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/));
    if (recipients.some((r) => !mailbox(r.trim()) || /[\r\n]/.test(r)))
      return result(
        "email",
        "error",
        "At least one recipient has an invalid mailbox structure.",
        "Use complete local-part@domain recipients, separated by commas.",
      );
    if (
      [...params].some(
        ([k, v]) => k.toLowerCase() !== "body" && /[\r\n]/.test(v),
      )
    )
      return result(
        "email",
        "error",
        "A mail header contains a line break.",
        "Remove encoded line breaks from mail headers.",
      );
    if (!recipients.length)
      return result(
        "email",
        "info",
        "No recipient is prefilled; the user must choose one.",
        "Add a recipient if this CTA should contact your team.",
      );
    return null;
  }
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (
    !["wa.me", "api.whatsapp.com", "www.wa.me"].includes(
      url.hostname.toLowerCase(),
    )
  )
    return null;
  const bad = (explanation: string) =>
    result(
      "whatsapp",
      "error",
      explanation,
      "Use https://wa.me/ followed by international digits without +, spaces or punctuation.",
    );
  if (!["https:", "http:"].includes(url.protocol))
    return bad("Unsupported WhatsApp URL scheme.");
  const api = url.hostname === "api.whatsapp.com";
  if (api && url.pathname !== "/send" && url.pathname !== "/send/")
    return result(
      "whatsapp",
      "warning",
      "Unrecognized WhatsApp API route.",
      "Review the route; the supported contact route is /send?phone=internationaldigits.",
    );
  const number = api
    ? url.searchParams.get("phone")
    : decode(url.pathname.slice(1).replace(/\/$/, ""));
  if (!api && /^(message\/|c\/|qr\/)/i.test(url.pathname.slice(1)))
    return result(
      "whatsapp",
      "info",
      "WhatsApp short code or business route needs manual verification.",
      "Test this route manually; it is not a phone-number URL.",
    );
  if (api && !number)
    return result(
      "whatsapp",
      "info",
      "WhatsApp opens without a specific recipient.",
      "Add phone=internationaldigits if a recipient should be preselected.",
    );
  if (!number || !/^[1-9]\d*$/.test(number))
    return bad(
      "WhatsApp phone URLs require international digits without a leading zero.",
    );
  if (number.length > 15)
    return bad("Phone number exceeds the international 15-digit limit.");
  if (
    number.length < 7 ||
    url.protocol === "http:" ||
    url.hostname === "www.wa.me" ||
    (api && url.searchParams.getAll("phone").length > 1)
  )
    return result(
      "whatsapp",
      "warning",
      "Unusual number length, transport, hostname or duplicate phone parameter.",
      "Review the destination manually and prefer the canonical HTTPS URL.",
    );
  return null;
}
