import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifyCredentials,
} from '@/lib/auth'

export async function POST(request: NextRequest) {
  let email = ''
  let password = ''
  try {
    const body = await request.json()
    email = String(body.email ?? '')
    password = String(body.password ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  if (!verifyCredentials(email, password)) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const token = await createSessionToken(email.trim().toLowerCase())
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
  return response
}
