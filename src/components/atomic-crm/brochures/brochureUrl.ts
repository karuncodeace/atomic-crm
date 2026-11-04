/**
 * Turns a stored brochure URL (often percent-encoded by the other app) into a
 * usable href and a short human-readable label.
 */
export const formatBrochureUrl = (
  raw: string,
): { href: string; label: string } => {
  const decoded = fullyDecode(raw.trim());
  if (!decoded) return { href: "", label: "" };

  try {
    const url = new URL(absoluteUrl(decoded));
    const fileName = url.pathname.split("/").filter(Boolean).pop();
    const label = fileName
      ? fullyDecode(fileName)
      : `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
    return { href: url.href, label: label || url.href };
  } catch {
    const href = absoluteUrl(decoded);
    return { href, label: decoded };
  }
};

const fullyDecode = (value: string) => {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    if (!/%[0-9A-Fa-f]{2}/.test(current)) break;
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
};

const absoluteUrl = (value: string) => {
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("/")) {
    return value;
  }
  return `https://${value}`;
};
