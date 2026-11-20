export const APP_HOST = 'day15.build40for40.com'

const LEGACY_HOSTS = new Set(['build40for40.com', 'www.build40for40.com'])
const LEGACY_PREFIX = '/day15'

/** The app used to live at build40for40.com/day15. Sends those addresses to the same path on its own host. */
export function legacyRedirect(url: URL): Response | null {
  if (!LEGACY_HOSTS.has(url.hostname)) return null
  if (url.pathname !== LEGACY_PREFIX && !url.pathname.startsWith(`${LEGACY_PREFIX}/`)) return null
  const moved = new URL(url)
  moved.protocol = 'https:'
  moved.hostname = APP_HOST
  moved.port = ''
  moved.pathname = url.pathname.slice(LEGACY_PREFIX.length) || '/'
  return Response.redirect(moved.href, 308)
}

export const isUnder = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`)
