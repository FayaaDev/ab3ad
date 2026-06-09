type Hi3DStatus = 'created' | 'queueing' | 'processing' | 'success' | 'failed';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function getHi3DEnvelopeData(payload: Record<string, unknown>) {
  return asRecord(payload.data);
}

export function getHi3DTaskId(payload: Record<string, unknown>) {
  const data = getHi3DEnvelopeData(payload);
  const taskId = data.task_id ?? payload.task_id;
  return typeof taskId === 'string' ? taskId : '';
}

export function getHi3DStatus(payload: Record<string, unknown>): Hi3DStatus | null {
  const data = getHi3DEnvelopeData(payload);
  const rawStatus = data.state ?? payload.state ?? payload.status;
  if (typeof rawStatus !== 'string') {
    return null;
  }

  const status = rawStatus.toLowerCase();
  if (!['created', 'queueing', 'processing', 'success', 'failed'].includes(status)) {
    return null;
  }

  return status as Hi3DStatus;
}

export function getHi3DResult(payload: Record<string, unknown>) {
  const data = getHi3DEnvelopeData(payload);
  const modelUrl = data.url ?? payload.url ?? payload.model_url;
  const coverUrl = data.cover_url ?? payload.cover_url;

  return {
    modelUrl: typeof modelUrl === 'string' ? modelUrl : undefined,
    coverUrl: typeof coverUrl === 'string' ? coverUrl : undefined,
  };
}

export function getHi3DError(payload: Record<string, unknown>) {
  const data = getHi3DEnvelopeData(payload);
  const rawCode = data.error_code ?? payload.error_code;
  const rawMessage = data.error_message ?? payload.error_message;
  const envelopeCode = payload.code;
  const envelopeMessage = payload.msg ?? payload.message;

  return {
    errorCode:
      rawCode === undefined || rawCode === null
        ? envelopeCode !== undefined && envelopeCode !== null && String(envelopeCode) !== '200'
          ? String(envelopeCode)
          : undefined
        : String(rawCode),
    errorMessage:
      typeof rawMessage === 'string'
        ? rawMessage
        : envelopeCode !== undefined && envelopeCode !== null && String(envelopeCode) !== '200' && typeof envelopeMessage === 'string'
          ? envelopeMessage
          : undefined,
  };
}
