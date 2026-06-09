import { NextResponse } from 'next/server';
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
    const taskId = String(payload.task_id ?? '');
    const status = String(payload.status ?? '') as 'created' | 'queueing' | 'processing' | 'success' | 'failed';

    if (!taskId || !['created', 'queueing', 'processing', 'success', 'failed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid callback payload.' }, { status: 400 });
    }

    await handleHi3DCallback(taskId, status, payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Callback failed.' }, { status: 400 });
  }
}
