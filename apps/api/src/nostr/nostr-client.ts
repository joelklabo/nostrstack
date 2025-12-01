import type { FastifyBaseLogger } from 'fastify';
import { type EventTemplate,finalizeEvent, getPublicKey } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';

export type PublishInput = {
  template: EventTemplate;
  relays: string[];
};

export class NostrClient {
  private readonly pubkey: string;

  constructor(private readonly sk: string, private readonly log: FastifyBaseLogger) {
    this.pubkey = getPublicKey(sk);
  }

  async publishRelayList(relays: string[]) {
    const tags = relays.map((r) => ['r', r]);
    return this.publish({
      template: {
        kind: 10002,
        content: '',
        tags,
        pubkey: this.pubkey
      },
      relays
    });
  }

  async publish({ template, relays }: PublishInput) {
    const event = finalizeEvent(
      {
        ...template,
        created_at: template.created_at ?? Math.floor(Date.now() / 1000),
        pubkey: template.pubkey ?? this.pubkey
      },
      this.sk
    );

    const results = await Promise.allSettled(
      relays.map(async (url) => {
        const relay = await Relay.connect(url);
        try {
          await new Promise<void>((resolve, reject) => {
            const pub = relay.publish(event);
            pub.on('ok', () => resolve());
            pub.on('failed', (reason) => reject(new Error(String(reason))));
          });
          return { url, ok: true };
        } finally {
          relay.close();
        }
      })
    );

    const successes = results.filter((r) => r.status === 'fulfilled').length;
    const failures = results.length - successes;
    this.log.info({ relays: results, successes, failures }, 'nostr publish results');
    if (successes === 0) throw new Error('Failed to publish to any relay');
    return { successes, failures };
  }
}
