import { useAuth } from '@nostrstack/blog-kit';
import { type Event } from 'nostr-tools';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRelays } from './useRelays';
import { useSimplePool } from './useSimplePool';

export interface DMMessage extends Event {
  decryptedContent?: string;
  isMine: boolean;
}

export interface Conversation {
  peer: string;
  messages: DMMessage[];
  lastMessageAt: number;
}

export function useDMs() {
  const { pubkey, signEvent, encrypt, decrypt } = useAuth();
  const { relays } = useRelays();
  const pool = useSimplePool();
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch messages
  useEffect(() => {
    if (!pubkey) return;
    setLoading(true);
    
    const seenIds = new Set<string>();
    const pendingMessages: DMMessage[] = [];
    let batchTimer: number | null = null;
    
    const flushBatch = () => {
      if (pendingMessages.length === 0) return;
      const batch = [...pendingMessages];
      pendingMessages.length = 0;
      
      setMessages(prev => {
        const combined = [...prev, ...batch];
        return combined;
      });
    };
    
    // Subscribe to incoming and outgoing DMs
    const onEvent = (event: Event) => {
      if (seenIds.has(event.id)) return;
      seenIds.add(event.id);
      
      const isMine = event.pubkey === pubkey;
      pendingMessages.push({ ...event, isMine });
      
      if (batchTimer !== null) return;
      batchTimer = window.setTimeout(() => {
        flushBatch();
        batchTimer = null;
      }, 300);
    };

    const sub1 = pool.subscribeMany(relays, { kinds: [4], '#p': [pubkey] }, { onevent: onEvent, oneose: () => setLoading(false) });
    const sub2 = pool.subscribeMany(relays, { kinds: [4], authors: [pubkey] }, { onevent: onEvent });

    return () => {
      if (batchTimer !== null) {
        clearTimeout(batchTimer);
        flushBatch();
      }
      try { sub1.close(); } catch { /* ignore */ }
      try { sub2.close(); } catch { /* ignore */ }
    };
  }, [pubkey, relays, pool]);

  // Group into conversations
  const conversations = useMemo(() => {
    if (!pubkey) return [];
    const map = new Map<string, DMMessage[]>();

    for (const msg of messages) {
      // If I sent it, peer is the 'p' tag. If I received it, peer is the author.
      const pTag = msg.tags.find(t => t[0] === 'p')?.[1];
      const peer = msg.pubkey === pubkey ? pTag : msg.pubkey;
      
      if (!peer) continue;

      if (!map.has(peer)) {
        map.set(peer, []);
      }
      map.get(peer)?.push(msg);
    }

    const convs: Conversation[] = [];
    map.forEach((msgs, peer) => {
      // Sort messages by time
      msgs.sort((a, b) => a.created_at - b.created_at);
      convs.push({
        peer,
        messages: msgs,
        lastMessageAt: msgs[msgs.length - 1].created_at
      });
    });

    // Sort conversations by last message
    return convs.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }, [messages, pubkey]);

  const sendDM = useCallback(async (peerPubkey: string, text: string) => {
    if (!pubkey) throw new Error('Not logged in');
    
    const ciphertext = await encrypt(peerPubkey, text);
    const event = {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', peerPubkey]],
      content: ciphertext,
    };

    const signed = await signEvent(event);
    await Promise.any(pool.publish(relays, signed));
    
    // Optimistic update
    const dmMessage: DMMessage = { ...signed, isMine: true, decryptedContent: text };
    setMessages(prev => [...prev, dmMessage]);
  }, [pubkey, encrypt, signEvent, relays, pool]);

  const decryptMessage = useCallback(async (message: DMMessage) => {
    if (message.decryptedContent) return message.decryptedContent;
    
    // If I sent it, I encrypt for the peer, so I can't easily decrypt it with my private key 
    // unless I encrypted it to myself too, or I stored the plaintext.
    // Wait, NIP-04: "The ciphertext is the result of encryption of the plaintext... using the shared secret"
    // Shared secret (ECDH) is same for (myPrv, peerPub) and (peerPrv, myPub).
    // So I CAN decrypt my own sent messages using the peer's pubkey.
    
    if (!pubkey) return '???';

    const peer = message.pubkey === pubkey 
      ? message.tags.find(t => t[0] === 'p')?.[1] // I sent it, use recipient pubkey
      : message.pubkey; // I received it, use sender pubkey

    if (!peer) return 'Unknown Peer';

    try {
      return await decrypt(peer, message.content);
    } catch {
      return '[Decryption Failed]';
    }
  }, [pubkey, decrypt]);

  return { conversations, loading, sendDM, decryptMessage };
}
