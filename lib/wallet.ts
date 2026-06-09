import { getWalletBalance } from '@/lib/store';

export const GENERATION_CREDIT_COST = 1;
export const INSUFFICIENT_CREDITS_MESSAGE = 'Insufficient credits. Add at least one credit before starting a generation.';

export async function assertCanStartGeneration(userId: string) {
  const balance = await getWalletBalance(userId);
  if (balance < GENERATION_CREDIT_COST) {
    const error = new Error(INSUFFICIENT_CREDITS_MESSAGE);
    error.name = 'InsufficientCreditsError';
    throw error;
  }
  return balance;
}

export function isInsufficientCreditsError(error: unknown) {
  return error instanceof Error && error.name === 'InsufficientCreditsError';
}
