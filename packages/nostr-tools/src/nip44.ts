import {
  generateSharedKey,
  nip44Decrypt,
  nip44Encrypt,
  NIP44Version,
  PublicKey
} from '@rust-nostr/nostr-sdk';

import { ensureSdk, toRustSecretKey } from './internal.js';

export type ConversationKey = {
  secretKey: Uint8Array;
  publicKey: string;
};

export function getConversationKey(secretKey: Uint8Array, publicKey: string): ConversationKey {
  ensureSdk();
  return { secretKey, publicKey };
}

export function encrypt(plaintext: string, key: ConversationKey): string {
  ensureSdk();
  const sk = toRustSecretKey(key.secretKey);
  const pk = PublicKey.parse(key.publicKey);
  return nip44Encrypt(sk, pk, plaintext, NIP44Version.V2);
}

export function decrypt(payload: string, key: ConversationKey): string {
  ensureSdk();
  const sk = toRustSecretKey(key.secretKey);
  const pk = PublicKey.parse(key.publicKey);
  return nip44Decrypt(sk, pk, payload);
}

export function generateConversationKey(secretKey: Uint8Array, publicKey: string): Uint8Array {
  ensureSdk();
  const sk = toRustSecretKey(secretKey);
  const pk = PublicKey.parse(publicKey);
  return generateSharedKey(sk, pk);
}
