import { NextResponse } from 'next/server';
import { AuthError, requireCurrentUser } from '@/lib/auth';
import { getWalletBalance, listWalletEvents } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const [balance, events] = await Promise.all([getWalletBalance(user.id), listWalletEvents(user.id, 25)]);
    return NextResponse.json({ balance, events });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load wallet.' }, { status });
  }
}
