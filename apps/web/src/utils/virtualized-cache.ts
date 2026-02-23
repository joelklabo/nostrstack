const VIRTUALIZED_CACHE_PREVIEW_LENGTH = 12;

export function buildListIdSignature(items: readonly string[]): string {
  return items
    .filter((item): item is string => Boolean(item))
    .slice(0, VIRTUALIZED_CACHE_PREVIEW_LENGTH)
    .map((id) => id.trim())
    .filter(Boolean)
    .join('::');
}

export function buildVirtualizedCacheKey(
  namespace: string,
  length: number,
  ids: readonly string[] = [],
  metadata: Record<string, string | number | boolean> = {}
): string {
  const signature = buildListIdSignature(ids);
  const metaParts = Object.entries(metadata)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('::');
  const signaturePart = signature ? `ids=${signature}` : 'ids=none';
  const metadataPart = metaParts ? `::${metaParts}` : '';
  return `${namespace}::len=${length}::${signaturePart}${metadataPart}`;
}
