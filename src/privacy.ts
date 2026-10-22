/** Queries and fragments can contain message bodies, passwords and arbitrary secrets. */
export function redact(raw: string): string {
  // Deliberately remove control characters before display or clipboard output.
  /* eslint-disable no-control-regex */
  let value = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  /* eslint-enable no-control-regex */
  if (/^javascript:/i.test(value)) return "javascript:[hidden]";
  if (/^data:/i.test(value)) return "data:[hidden]";
  // URL parsing also recognizes credentials in browser-normalized forms such as
  // https:user:password@host/path and URLs containing backslashes.
  try {
    const url = new URL(value);
    if ((url.username || url.password) && !/\/\/[^/?#\s]*@/.test(value))
      value = `${url.protocol}//[credentials hidden]@${url.host}${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Relative and malformed destinations still receive conservative redaction below.
  }
  if (value === "#") return "#"; // The empty fragment marker contains no private data.
  const cut = value.search(/[?#]/);
  let safe = cut < 0 ? value : `${value.slice(0, cut)}[query/fragment hidden]`;
  safe = safe.replace(/(\/\/)[^/?#\s]*@/g, "$1[credentials hidden]@");
  return safe.slice(0, 240);
}
