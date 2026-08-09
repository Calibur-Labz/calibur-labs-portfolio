import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'

/**
 * Gate the /buddhima admin area. Unauthenticated visitors are redirected to
 * the login page; the login page itself and its API stay public.
 *
 * (In Next.js 16 the former `middleware` convention is renamed to `proxy`.)
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public: the login page and the auth API endpoints.
  if (pathname === '/buddhima/login' || pathname.startsWith('/api/buddhima/login')) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = await verifySessionToken(token)

  if (!session) {
    // API calls get a 401; page navigations get redirected to login.
    if (pathname.startsWith('/api/buddhima')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/buddhima/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/buddhima/:path*', '/api/buddhima/:path*'],
}
