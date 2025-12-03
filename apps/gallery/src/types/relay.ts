export type RelayLimits = {
  max_message_length?: number;
  max_subscriptions?: number;
  max_filters?: number;
  max_limit?: number;
  max_subid_length?: number;
  max_past_seconds?: number;
  auth_required?: boolean;
  payment_required?: boolean;
  restricted_writes?: boolean;
};

export type RelayStat = {
  recv: number;
  recvPerMin?: number;
  recvHistory?: Array<{ ts: number }>;
  last?: number;
  lastSentAt?: number;
  name?: string;
  description?: string;
  software?: string;
  version?: string;
  supportedNips?: number[];
  contact?: string;
  pubkey?: string;
  icon?: string;
  paymentsUrl?: string;
  language?: string;
  tags?: string[];
  limitation?: RelayLimits;
  paymentRequired?: boolean;
  authRequired?: boolean;
  online?: boolean;
  latencyMs?: number;
  lastProbeAt?: number;
  sendStatus?: 'idle' | 'sending' | 'ok' | 'error';
  sendMessage?: string;
  updatedAt?: number;
};

export type RelayStats = Record<string, RelayStat>;
