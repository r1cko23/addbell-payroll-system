/**
 * Match sidebar / nav hrefs that may include query strings (e.g. /dashboard?type=executive).
 */
export function isNavItemActive(
  pathname: string,
  searchString: string,
  href: string
): boolean {
  const qMark = href.indexOf("?");
  const path = qMark === -1 ? href : href.slice(0, qMark);
  const queryFromHref =
    qMark === -1 ? null : new URLSearchParams(href.slice(qMark + 1));

  const trimmed = searchString.startsWith("?")
    ? searchString.slice(1)
    : searchString;
  const currentParams = new URLSearchParams(trimmed);

  if (queryFromHref) {
    if (pathname !== path) return false;
    for (const [key, value] of queryFromHref.entries()) {
      if (currentParams.get(key) !== value) return false;
    }
    return true;
  }

  if (pathname === path) return true;
  if (path !== "/" && pathname.startsWith(`${path}/`)) return true;
  return false;
}
