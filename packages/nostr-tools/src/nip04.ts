import { nip04Decrypt, nip04Encrypt, PublicKey } from '@rust-nostr/nostr-sdk';

import { ensureSdk, toRustSecretKey } from './internal.js';

export function encrypt(secretKey: Uint8Array, pubkey: string, plaintext: string): string {
  ensureSdk();
  const sk = toRustSecretKey(secretKey);
  const pk = PublicKey.parse(pubkey);
  return nip04Encrypt(sk, pk, plaintext);
}

export function decrypt(secretKey: Uint8Array, pubkey: string, ciphertext: string): string {
  ensureSdk();
  const sk = toRustSecretKey(secretKey);
  const pk = PublicKey.parse(pubkey);
  return nip04Decrypt(sk, pk, ciphertext);
}
