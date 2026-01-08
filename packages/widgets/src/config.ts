/**
 * Configuration constants for embed widgets
 */

// Invoice and payment constants
export const INVOICE_TTL_SECS = 120;
export const MIN_SEND_AMOUNT_MSAT = 1000;
export const RING_CIRCUMFERENCE = 188.5; // 2 * PI * 30 (SVG circle)

// Reconnection settings
export const MAX_RECONNECT_DELAY_MS = 30000;
export const RECONNECT_BASE_MS = 1000;

// Feed and display limits
export const DEFAULT_FEED_ITEMS = 25;
export const MIN_FEED_ITEMS = 5;
export const MAX_FEED_ITEMS = 60;

// Payment status states
export const PAID_STATES = new Set(['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED']);

// Relay configuration
export const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.snort.social'];
export const LOCAL_RELAY_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
export const RELAY_CONNECT_TIMEOUT_MS = 5000;
