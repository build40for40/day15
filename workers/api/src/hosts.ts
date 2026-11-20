export const APP_HOST = 'a-line.build40for40.com'

const OLD_APP_HOST = 'day15.build40for40.com'
const OLD_SITE_HOSTS = new Set(['build40for40.com', 'www.build40for40.com'])
const OLD_SITE_PREFIX = '/day15'

export const isUnder = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`)

function oldPath(url: URL): string | null {
  if (url.hostname === OLD_APP_HOST) return url.pathname
  if (OLD_SITE_HOSTS.has(url.hostname) && isUnder(url.pathname, OLD_SITE_PREFIX)) {
    return url.pathname.slice(OLD_SITE_PREFIX.length) || '/'
  }
  return null
}

/** The app used to live at build40for40.com/day15, then at day15.build40for40.com. Sends both to the same path on its own host. */
export function legacyRedirect(url: URL): Response | null {
  const pathname = oldPath(url)
  if (pathname === null) return null
  const moved = new URL(url)
  moved.protocol = 'https:'
  moved.hostname = APP_HOST
  moved.port = ''
  moved.pathname = pathname
  return Response.redirect(moved.href, 308)
}
