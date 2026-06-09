import { NextResponse } from 'next/server';
import { AuthError, requireAdminUser } from '@/lib/auth';
import { checkReadiness } from '@/lib/ops';

export const runtime = 'nodejs';

function hasHealthcheckToken(request: Request) {
  const expected = process.env.HEALTHCHECK_TOKEN;
  if (!expected) {
    return false;
  }

  const authorization = request.headers.get('authorization');
  const direct = request.headers.get('x-healthcheck-token');
  return authorization === `Bearer ${expected}` || direct === expected;
}

export async function GET(request: Request) {
  try {
    if (!hasHealthcheckToken(request)) {
      await requireAdminUser();
    }

    const readiness = await checkReadiness();
    return NextResponse.json(readiness);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 503;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Readiness check failed.' }, { status });
  }
}
