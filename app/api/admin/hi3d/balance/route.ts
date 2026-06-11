import { NextResponse } from 'next/server';
import { AdminAuthError, AuthError, requireAdminUser } from '@/lib/auth';
import { queryBalance } from '@/lib/hi3d-client';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAdminUser();
    const balance = await queryBalance();
    return NextResponse.json(balance);
  } catch (error) {
    const status = error instanceof AuthError || error instanceof AdminAuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load Hi3D balance.' }, { status });
  }
}
