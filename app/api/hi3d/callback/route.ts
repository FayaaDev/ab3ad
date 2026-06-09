import { NextResponse } from 'next/server';
import { getHi3DStatus, getHi3DTaskId } from '@/lib/hi3d-contract';
import { verifyHi3DCallbackSignature } from '@/lib/hi3d-security';
import { handleHi3DCallback } from '@/lib/job-runner';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!verifyHi3DCallbackSignature(rawBody, request.headers)) {
      return NextResponse.json({ error: 'Invalid callback signature.' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const taskId = getHi3DTaskId(payload);
    const status = getHi3DStatus(payload);

    if (!taskId || !status) {
      return NextResponse.json({ error: 'Invalid callback payload.' }, { status: 400 });
    }

    await handleHi3DCallback(taskId, status, payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Callback failed.' }, { status: 400 });
  }
}
