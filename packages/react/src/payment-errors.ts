const AUTH_REQUIRED_MESSAGE = 'Authentication required. Please sign in to continue.';

function findStatusCode(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;

  const obj = error as Record<string, unknown>;
  const statusValue = obj.status ?? obj.statusCode;
  if (typeof statusValue === 'number') return statusValue;
  if (typeof statusValue === 'string') {
    const parsed = Number.parseInt(statusValue, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    const candidateKeys = [
      'message',
      'error',
      'detail',
      'reason',
      'statusText',
      'description'
    ] as const;
    for (const key of candidateKeys) {
      const value = obj[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return '';
}

export function toAuthOrMessage(error: unknown, fallback = 'Failed to process payment'): string {
  const message = extractErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('access_denied') ||
    normalized.includes('access denied') ||
    normalized.includes('not authenticated') ||
    normalized.includes('authentication required')
  ) {
    return AUTH_REQUIRED_MESSAGE;
  }

  const status = findStatusCode(error);
  if (status === 401 || status === 403) return AUTH_REQUIRED_MESSAGE;
  if (normalized.includes(' 401') || normalized.includes('401 ') || normalized.includes(' 403')) {
    return AUTH_REQUIRED_MESSAGE;
  }

  const fallbackMessage = message.trim() || String(error ?? '').trim();
  return fallbackMessage || fallback;
}
