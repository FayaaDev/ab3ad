import { NextResponse } from 'next/server';
import { AuthError, requireCurrentUser } from '@/lib/auth';
import { getWalletBalance, listWalletEvents, recordWalletEvent } from '@/lib/store';
import { walletTopUpSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const payload = walletTopUpSchema.parse(await request.json());
    const event = await recordWalletEvent({ userId: user.id, eventType: 'wallet_deposit', creditDelta: payload.amount });
    const [balance, events] = await Promise.all([getWalletBalance(user.id), listWalletEvents(user.id, 25)]);

    return NextResponse.json({ balance, events, event });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not add credits.' }, { status });
  }
}
