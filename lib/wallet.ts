import { getWalletBalance } from '@/lib/store';

export const GENERATION_CREDIT_COST = 1;
export const INSUFFICIENT_CREDITS_MESSAGE = 'Insufficient credits. Add more credits before starting this generation.';

export async function assertCanStartGeneration(userId: string, requiredCredits = GENERATION_CREDIT_COST) {
  const balance = await getWalletBalance(userId);
  if (balance < requiredCredits) {
    const error = new Error(INSUFFICIENT_CREDITS_MESSAGE);
    error.name = 'InsufficientCreditsError';
    throw error;
  }
  return balance;
}

export function isInsufficientCreditsError(error: unknown) {
  return error instanceof Error && error.name === 'InsufficientCreditsError';
}
