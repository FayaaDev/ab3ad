import { NextResponse } from 'next/server';
import { AuthError, buildSessionCookieValue, getSessionCookieOptions, loginWithPassword } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { email?: string; password?: string };
    const email = String(payload.email ?? '').trim();
    const password = String(payload.password ?? '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const user = await loginWithPassword({ email, password });
    const response = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
    response.cookies.set('ab3ad_session', buildSessionCookieValue(user.id), getSessionCookieOptions());
    return response;
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not sign in.' }, { status });
  }
}
