import { Keys, SecretKey } from '@rust-nostr/nostr-sdk';

import {
  ensureSdk,
  eventToPlain,
  hexToBytes,
  toRustEvent,
  toRustEventBuilder,
  toRustSecretKey
} from './internal.js';
import type { Event, EventTemplate } from './types.js';

export function generateSecretKey(): Uint8Array {
  ensureSdk();
  return hexToBytes(SecretKey.generate().toHex());
}

export function getPublicKey(secretKey: Uint8Array): string {
  ensureSdk();
  const keys = new Keys(toRustSecretKey(secretKey));
  return keys.publicKey.toHex();
}

export function finalizeEvent(template: EventTemplate, secretKey: Uint8Array): Event {
  ensureSdk();
  const keys = new Keys(toRustSecretKey(secretKey));
  const builder = toRustEventBuilder(
    {
      ...template,
      tags: template.tags ?? []
    },
    keys.publicKey.toHex()
  );
  const event = builder.signWithKeys(keys);
  return eventToPlain(event);
}

export function validateEvent(event: Event): boolean {
  try {
    const rust = toRustEvent(event);
    return rust.verifyId();
  } catch {
    return false;
  }
}

export function verifyEvent(event: Event): boolean {
  try {
    const rust = toRustEvent(event);
    return rust.verifySignature();
  } catch {
    return false;
  }
}
