import { NextResponse } from 'next/server';
import { assertPasswordPolicy } from '@/lib/auth-utils';
import { buildSessionCookieValue, getSessionCookieOptions, registerWithPassword } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { email?: string; name?: string; password?: string };
    const email = String(payload.email ?? '').trim();
    const name = String(payload.name ?? '').trim();
    const password = String(payload.password ?? '');

    if (!email || !name || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 });
    }

    assertPasswordPolicy(password);
    const user = await registerWithPassword({ email, name, password });
    const response = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
    response.cookies.set('ab3ad_session', buildSessionCookieValue(user.id), getSessionCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create account.' }, { status: 400 });
  }
}
