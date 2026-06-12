import { NextResponse } from 'next/server';
import { listProviderCatalog } from '@/lib/providers';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ providers: listProviderCatalog() });
}
