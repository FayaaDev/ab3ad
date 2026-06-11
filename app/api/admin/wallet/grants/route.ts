import { NextResponse } from 'next/server';
import { AdminAuthError, AuthError, requireAdminUser } from '@/lib/auth';
import { getUser, getUserByEmail, getWalletBalance, listWalletEvents, recordWalletEvent } from '@/lib/store';
import { adminCreditGrantSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await requireAdminUser();
    const payload = adminCreditGrantSchema.parse(await request.json());
    const targetUser = payload.userId ? await getUser(payload.userId) : await getUserByEmail(payload.email ?? '');

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user was not found.' }, { status: 404 });
    }

    const currentBalance = await getWalletBalance(targetUser.id);
    if (payload.amount < 0 && currentBalance + payload.amount < 0) {
      return NextResponse.json({ error: 'Cannot deduct more credits than the user currently has.' }, { status: 400 });
    }

    const event = await recordWalletEvent({ userId: targetUser.id, eventType: 'admin_credit_grant', creditDelta: payload.amount });
    const [balance, events] = await Promise.all([getWalletBalance(targetUser.id), listWalletEvents(targetUser.id, 25)]);

    return NextResponse.json({ user: { id: targetUser.id, email: targetUser.email, name: targetUser.name }, balance, events, event });
  } catch (error) {
    const status = error instanceof AuthError || error instanceof AdminAuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not adjust credits.' }, { status });
  }
}
