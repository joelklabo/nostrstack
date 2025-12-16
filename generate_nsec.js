import { generatePrivateKey, nip19 } from 'nostr-tools';
import { getPublicKey } from 'nostr-tools';

let sk = generatePrivateKey();
let nsec = nip19.nsecEncode(sk);
let pk = getPublicKey(sk);

console.log(JSON.stringify({ nsec: nsec, pk: pk }));
