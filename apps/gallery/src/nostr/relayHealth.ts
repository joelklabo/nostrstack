import { normalizeURL } from 'nostr-tools/utils';

export type RelayStats = {
  attempts: number;
  successes: number;
  failures: number;
  consecutiveFailures: number;
  lastAttemptAt: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  averageLatencyMs?: number;
};

const STATS_KEY = 'nostrstack.relayStats.v2';

class RelayMonitor {
  private stats: Map<string, RelayStats> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  private load() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [key, value] of Object.entries(parsed)) {
            this.stats.set(key, value as RelayStats);
        }
      }
    } catch (e) {
      console.warn('Failed to load relay stats', e);
    }
  }

  private save() {
    if (typeof window === 'undefined') return;
    try {
      const obj = Object.fromEntries(this.stats);
      localStorage.setItem(STATS_KEY, JSON.stringify(obj));
    } catch {
        // ignore
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private normalize(url: string): string | null {
      try {
          return normalizeURL(url);
      } catch {
          return null;
      }
  }

  private getStats(url: string): RelayStats {
    const normalized = this.normalize(url);
    if (!normalized) throw new Error(`Invalid relay URL: ${url}`);
    
    if (!this.stats.has(normalized)) {
      this.stats.set(normalized, {
        attempts: 0,
        successes: 0,
        failures: 0,
        consecutiveFailures: 0,
        lastAttemptAt: 0
      });
    }
    return this.stats.get(normalized)!;
  }

  reportAttempt(url: string) {
    try {
        const stat = this.getStats(url);
        stat.attempts++;
        stat.lastAttemptAt = Date.now();
        this.save();
    } catch { /* ignore invalid urls */ }
  }

  reportSuccess(url: string, latencyMs?: number) {
    try {
        const stat = this.getStats(url);
        stat.successes++;
        stat.consecutiveFailures = 0;
        stat.lastSuccessAt = Date.now();
        
        if (latencyMs !== undefined) {
          if (stat.averageLatencyMs === undefined) {
            stat.averageLatencyMs = latencyMs;
          } else {
            // Exponential moving average (weight recent more)
            stat.averageLatencyMs = (stat.averageLatencyMs * 0.7) + (latencyMs * 0.3);
          }
        }
        this.save();
    } catch { /* ignore */ }
  }

  reportFailure(url: string) {
    try {
        const stat = this.getStats(url);
        stat.failures++;
        stat.consecutiveFailures++;
        stat.lastFailureAt = Date.now();
        this.save();
    } catch { /* ignore */ }
  }

  isHealthy(url: string): boolean {
    try {
        const normalized = this.normalize(url);
        if (!normalized) return false;
        
        const stat = this.stats.get(normalized);
        if (!stat) return true; // Assume innocent

        // If explicitly flagged as failed recently
        if (stat.consecutiveFailures >= 3) {
            // Exponential backoff: 2^failures seconds.
            // 3 failures -> 8s
            // 4 failures -> 16s
            // ...
            // Cap at 5 minutes (300000ms)
            const backoffMs = Math.min(300000, Math.pow(2, stat.consecutiveFailures) * 1000);
            const elapsed = Date.now() - (stat.lastFailureAt || 0);
            
            // If we are within the backoff period, it's unhealthy
            if (elapsed < backoffMs) return false;
        }

        return true;
    } catch {
        return false;
    }
  }

  getBestRelays(candidates: string[], count: number = 5): string[] {
      const unique = Array.from(new Set(candidates.map(c => this.normalize(c)).filter(Boolean) as string[]));
      
      const scored = unique.map(url => {
          const stat = this.stats.get(url);
          let score = 100;
          if (stat) {
              score -= (stat.consecutiveFailures * 20);
              if (stat.averageLatencyMs) {
                  // Penalize high latency. e.g. 1000ms -> -10 points?
                  // Let's say -1 point per 50ms over 200ms
                  const latencyPenalty = Math.max(0, (stat.averageLatencyMs - 200) / 50);
                  score -= latencyPenalty;
              }
              
              // Bonus for reliability?
              const successRate = stat.attempts > 0 ? stat.successes / stat.attempts : 0.5;
              score += (successRate * 20); // up to +20 points
          }
          return { url, score };
      });

      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(s => s.url);
  }

  getStatsSnapshot() {
      return Object.fromEntries(this.stats);
  }
}

export const relayMonitor = new RelayMonitor();
