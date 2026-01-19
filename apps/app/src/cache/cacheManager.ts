import { cleanupExpired, getCacheStats } from './eventCache';

const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
const STATS_LOG_INTERVAL = 5 * 60 * 1000; // 5 minutes

let cleanupTimer: number | null = null;
let statsTimer: number | null = null;

export function startCacheManager() {
  if (cleanupTimer) return; // Already started

  // Initial cleanup
  cleanupExpired().catch(console.error);

  // Periodic cleanup
  cleanupTimer = window.setInterval(() => {
    cleanupExpired()
      .then((count) => {
        if (count > 0) {
          console.log(`[Cache] Cleaned up ${count} expired entries`);
        }
      })
      .catch(console.error);
  }, CLEANUP_INTERVAL);

  // Periodic stats logging (development only)
  if (import.meta.env.DEV) {
    statsTimer = window.setInterval(() => {
      getCacheStats()
        .then((stats) => {
          const hitRate =
            stats.hits + stats.misses > 0
              ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)
              : '0.0';
          console.log(
            `[Cache Stats] Hits: ${stats.hits}, Misses: ${stats.misses}, Hit Rate: ${hitRate}%, Evictions: ${stats.evictions}`
          );
        })
        .catch(console.error);
    }, STATS_LOG_INTERVAL);
  }
}

export function stopCacheManager() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  if (statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
  }
}

// Warm cache with common queries on app start
export async function warmCommonQueries() {
  // This would be called with initial data from subscriptions
  // For now, it's a placeholder for future optimization
  console.log('[Cache] Ready for warming');
}
