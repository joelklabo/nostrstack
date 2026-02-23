import type { Event, Filter, SimplePool } from 'nostr-tools';

/**
 * Zap information extracted from a zap receipt event.
 */
export interface ZapInfo {
  /** Zapper's pubkey (who sent the zap) */
  senderPubkey: string;
  /** Amount in millisats (from bolt11) */
  amountMsats: number;
  /** Optional zap message */
  message?: string;
  /** Timestamp */
  createdAt: number;
  /** Original zap receipt event */
  event: Event;
}

export interface ZapData {
  zaps: ZapInfo[];
  totalAmount: number;
  loading: boolean;
}

type ZapSubscriber = (data: ZapData) => void;

interface PendingRequest {
  eventId: string;
  resolve: () => void;
}

/**
 * Parse amount from bolt11 invoice in zap receipt.
 * Bolt11 format: lnbc[amount][multiplier]...
 */
function parseBolt11Amount(bolt11: string): number {
  const match = bolt11.match(/^ln(?:bc|tb|tbs)(\d+)([munp])?/i);
  if (!match) return 0;

  const amount = parseInt(match[1], 10);
  const multiplier = match[2]?.toLowerCase();

  // Convert to millisats based on multiplier
  switch (multiplier) {
    case 'm': // milli-bitcoin (0.001 BTC)
      return amount * 100_000_000; // 1 mBTC = 100,000,000 msats
    case 'u': // micro-bitcoin (0.000001 BTC)
      return amount * 100_000; // 1 uBTC = 100,000 msats
    case 'n': // nano-bitcoin (0.000000001 BTC)
      return amount * 100; // 1 nBTC = 100 msats
    case 'p': // pico-bitcoin (0.000000000001 BTC)
      return amount / 10; // 1 pBTC = 0.1 msats
    default:
      // No multiplier means whole BTC (rare for Lightning)
      return amount * 100_000_000_000; // 1 BTC = 100,000,000,000 msats
  }
}

/**
 * Parse zap receipt event to extract zap info.
 */
function parseZapReceipt(event: Event): ZapInfo | null {
  try {
    // Get bolt11 invoice from tags
    const bolt11Tag = event.tags.find((t) => t[0] === 'bolt11');
    const bolt11 = bolt11Tag?.[1];
    if (!bolt11) return null;

    const amountMsats = parseBolt11Amount(bolt11);
    if (amountMsats === 0) return null;

    // Get sender pubkey from 'P' tag (uppercase P = zapper pubkey)
    // or from embedded 'description' tag which contains the zap request
    let senderPubkey = event.tags.find((t) => t[0] === 'P')?.[1];
    let message: string | undefined;

    // Try to get zapper info from the description (zap request)
    const descriptionTag = event.tags.find((t) => t[0] === 'description');
    if (descriptionTag?.[1]) {
      try {
        const zapRequest = JSON.parse(descriptionTag[1]) as Event;
        senderPubkey = senderPubkey || zapRequest.pubkey;
        message = zapRequest.content?.trim() || undefined;
      } catch {
        // Ignore parse errors
      }
    }

    if (!senderPubkey) return null;

    return {
      senderPubkey,
      amountMsats,
      message,
      createdAt: event.created_at,
      event
    };
  } catch {
    return null;
  }
}

/**
 * Batches zap subscription requests to reduce the number of WebSocket subscriptions.
 * Instead of N subscriptions for N event cards, this creates a single subscription
 * with batched event IDs.
 */
class ZapBatcher {
  /** Cache of zap data by event ID */
  private cache = new Map<string, ZapData>();

  /** Subscribers per event ID */
  private subscribers = new Map<string, Set<ZapSubscriber>>();

  /** Pending requests waiting to be batched */
  private pendingRequests: PendingRequest[] = [];

  /** Debounce timer for batching */
  private batchTimer: ReturnType<typeof setTimeout> | null = null;

  /** Active subscription cleanup */
  private activeSubscription: { close: () => void } | null = null;

  /** Event IDs currently being fetched */
  private fetchingEventIds = new Set<string>();

  /** Seen zap event IDs to dedupe */
  private seenZapIds = new Set<string>();
  /** Preserve insertion order for seen zap IDs */
  private seenZapOrder: string[] = [];

  /** Maximum number of event IDs to keep in cache */
  private readonly MAX_CACHE_SIZE = 500;

  /** Maximum number of seen zap IDs to keep */
  private readonly MAX_SEEN_ZAP_IDS = 5000;

  /** Batch delay in ms - wait for more requests before subscribing */
  private readonly BATCH_DELAY = 50;

  /** Max event IDs per subscription batch */
  private readonly MAX_BATCH_SIZE = 100;

  /** Pool and relays for subscriptions */
  private pool: SimplePool | null = null;
  private relays: string[] = [];
  private onRelayFailure?: (relayUrl: string) => void;

  /**
   * Configure the pool and relays for fetching.
   */
  configure(pool: SimplePool, relays: string[]) {
    this.configureWithFailureCallback(pool, relays, undefined);
  }

  configureWithFailureCallback(
    pool: SimplePool,
    relays: string[],
    onRelayFailure?: (relayUrl: string) => void
  ) {
    this.pool = pool;
    this.relays = relays;
    this.onRelayFailure = onRelayFailure;
  }

  /**
   * Subscribe to zap data for an event ID.
   * Returns an unsubscribe function.
   */
  subscribe(eventId: string, callback: ZapSubscriber): () => void {
    // Initialize subscriber set if needed
    if (!this.subscribers.has(eventId)) {
      this.subscribers.set(eventId, new Set());
    }
    this.subscribers.get(eventId)!.add(callback);

    // If we have cached data, send it immediately
    const cached = this.cache.get(eventId);
    if (cached) {
      this.touchCachedEvent(eventId);
      callback(cached);
    } else {
      // Notify subscriber that we're loading
      callback({ zaps: [], totalAmount: 0, loading: true });

      // Queue fetch if not already fetching
      if (!this.fetchingEventIds.has(eventId)) {
        this.queueFetch(eventId);
      }
    }

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(eventId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(eventId);
        }
      }
    };
  }

  /**
   * Queue an event ID for batched fetching.
   */
  private queueFetch(eventId: string) {
    this.fetchingEventIds.add(eventId);

    // Create a promise that resolves when batch is processed
    const request: PendingRequest = {
      eventId,
      resolve: () => {}
    };
    new Promise<void>((resolve) => {
      request.resolve = resolve;
    });
    this.pendingRequests.push(request);

    // Schedule batch processing
    this.scheduleBatch();
  }

  /**
   * Schedule batch processing with debounce.
   */
  private scheduleBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.BATCH_DELAY);
  }

  /**
   * Process queued requests as a batch.
   */
  private processBatch() {
    if (!this.pool || this.relays.length === 0) {
      // Not configured yet - reschedule
      this.scheduleBatch();
      return;
    }

    if (this.pendingRequests.length === 0) {
      return;
    }

    // Take up to MAX_BATCH_SIZE requests
    const batch = this.pendingRequests.splice(0, this.MAX_BATCH_SIZE);
    const eventIds = batch.map((r) => r.eventId);

    // Close any existing subscription
    if (this.activeSubscription) {
      try {
        this.activeSubscription.close();
      } catch {
        // Ignore close errors
      }
    }

    // Create batched filter
    const filter: Filter = {
      kinds: [9735],
      '#e': eventIds,
      limit: eventIds.length * 20 // ~20 zaps per event
    };

    // Track which events received data
    const receivedEventIds = new Set<string>();

    try {
      this.activeSubscription = this.pool.subscribeMany(this.relays, filter, {
        onclose: (reasons) => {
          if (!this.onRelayFailure) return;
          if (reasons.some((reason) => reason.toLowerCase() !== 'closed')) {
            this.relays.forEach((relay) => this.onRelayFailure?.(relay));
          }
        },
        onevent: (event) => {
          if (!this.markSeenZapId(event.id)) return;

          const zapInfo = parseZapReceipt(event);
          if (!zapInfo) return;

          // Find which event this zap is for
          const eTag = event.tags.find((t) => t[0] === 'e');
          const targetEventId = eTag?.[1];
          if (!targetEventId || !eventIds.includes(targetEventId)) return;

          receivedEventIds.add(targetEventId);

          // Update cache
          const existing = this.cache.get(targetEventId) || {
            zaps: [],
            totalAmount: 0,
            loading: true
          };
          const updatedZaps = [...existing.zaps, zapInfo];
          // Sort by amount descending
          updatedZaps.sort((a, b) => b.amountMsats - a.amountMsats);

          const totalAmount = updatedZaps.reduce((sum, z) => sum + z.amountMsats, 0);

          const newData: ZapData = {
            zaps: updatedZaps,
            totalAmount,
            loading: true // Still loading until EOSE
          };
          this.setCachedEvent(targetEventId, newData);

          // Notify subscribers
          this.notifySubscribers(targetEventId, newData);
        },
        oneose: () => {
          // Mark all batched events as done loading
          for (const eventId of eventIds) {
            const data = this.cache.get(eventId) || {
              zaps: [],
              totalAmount: 0,
              loading: false
            };
            const finalData = { ...data, loading: false };
            this.setCachedEvent(eventId, finalData);
            this.fetchingEventIds.delete(eventId);
            this.notifySubscribers(eventId, finalData);
          }

          // Resolve all pending promises
          batch.forEach((r) => r.resolve());
        }
      });
    } catch {
      // On error, mark all as done with empty data
      for (const eventId of eventIds) {
        const emptyData: ZapData = { zaps: [], totalAmount: 0, loading: false };
        this.setCachedEvent(eventId, emptyData);
        this.fetchingEventIds.delete(eventId);
        this.notifySubscribers(eventId, emptyData);
      }
      batch.forEach((r) => r.resolve());
    }

    // Set timeout fallback
    setTimeout(() => {
      for (const eventId of eventIds) {
        if (this.fetchingEventIds.has(eventId)) {
          const data = this.cache.get(eventId) || {
            zaps: [],
            totalAmount: 0,
            loading: false
          };
          const finalData = { ...data, loading: false };
          this.setCachedEvent(eventId, finalData);
          this.fetchingEventIds.delete(eventId);
          this.notifySubscribers(eventId, finalData);
        }
      }
    }, 5000);

    // If more pending requests, schedule another batch
    if (this.pendingRequests.length > 0) {
      this.scheduleBatch();
    }
  }

  /**
   * Notify all subscribers for an event ID.
   */
  private notifySubscribers(eventId: string, data: ZapData) {
    const subs = this.subscribers.get(eventId);
    if (subs) {
      subs.forEach((callback) => callback(data));
    }
  }

  /**
   * Get cached zap data for an event ID.
   */
  getCached(eventId: string): ZapData | undefined {
    const cached = this.cache.get(eventId);
    if (cached) {
      this.touchCachedEvent(eventId);
    }
    return cached;
  }

  /**
   * Track seen zap IDs with bounded memory.
   * Returns false if already seen, true if this is a new ID.
   */
  private markSeenZapId(eventId: string): boolean {
    if (this.seenZapIds.has(eventId)) {
      return false;
    }

    this.seenZapIds.add(eventId);
    this.seenZapOrder.push(eventId);

    if (this.seenZapOrder.length > this.MAX_SEEN_ZAP_IDS) {
      const overflow = this.seenZapOrder.length - this.MAX_SEEN_ZAP_IDS;
      const removed = this.seenZapOrder.splice(0, overflow);
      for (const id of removed) {
        this.seenZapIds.delete(id);
      }
    }

    return true;
  }

  private setCachedEvent(eventId: string, data: ZapData) {
    this.cache.delete(eventId);
    this.cache.set(eventId, data);
    this.evictCacheIfNeeded();
  }

  private touchCachedEvent(eventId: string) {
    const existing = this.cache.get(eventId);
    if (!existing) return;

    this.cache.delete(eventId);
    this.cache.set(eventId, existing);
  }

  private evictCacheIfNeeded() {
    if (this.cache.size <= this.MAX_CACHE_SIZE) return;

    for (const eventId of this.cache.keys()) {
      if (this.cache.size <= this.MAX_CACHE_SIZE) return;

      const hasActiveSubscriber = this.subscribers.get(eventId)?.size;
      if (hasActiveSubscriber) continue;

      this.cache.delete(eventId);
    }
  }

  /**
   * Clear all cached data and subscriptions.
   */
  clear() {
    this.cache.clear();
    this.subscribers.clear();
    this.pendingRequests = [];
    this.fetchingEventIds.clear();
    this.seenZapIds.clear();
    this.seenZapOrder = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.activeSubscription) {
      try {
        this.activeSubscription.close();
      } catch {
        // Ignore
      }
      this.activeSubscription = null;
    }
  }
}

/** Global singleton batcher instance */
export const zapBatcher = new ZapBatcher();
