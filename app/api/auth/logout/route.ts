import { NextResponse } from 'next/server';
import { sessionCookieName } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url), 303);
  response.cookies.set(sessionCookieName, '', { path: '/', maxAge: 0 });
  return response;
}
