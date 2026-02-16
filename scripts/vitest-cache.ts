import path from 'node:path';

const cacheEnvRoot = process.env.VITEST_CACHE_DIR || process.env.VITEST_CACHE_ROOT;
const fallbackCacheRoot = path.join(
  process.env.XDG_CACHE_HOME ||
    process.env.CACHE_DIR ||
    process.env.TMPDIR ||
    process.env.TEMP ||
    process.env.TMP ||
    '/tmp',
  'nostrstack',
  'vitest'
);

const sanitizedScope = (scope: string) => scope.replace(/[^a-zA-Z0-9-_]/g, '-');

export function getVitestCacheDir(scope: string): string {
  return path.resolve(cacheEnvRoot || fallbackCacheRoot, sanitizedScope(scope));
}

export function getVitestCoverageDir(scope: string): string {
  return path.join(getVitestCacheDir(scope), 'coverage');
}
