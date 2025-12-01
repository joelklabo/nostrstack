export function parseLnAddress(value?: string | null): { username: string; domain?: string } | null {
  if (!value) return null;
  const parts = value.split('@');
  if (parts.length === 1) {
    return { username: parts[0] };
  }
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { username: parts[0], domain: parts[1] };
  }
  return null;
}

export function parseRelays(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((r) => r.trim())
    .filter(Boolean);
}
