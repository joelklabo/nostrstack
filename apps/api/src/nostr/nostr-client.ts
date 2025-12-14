import type { FastifyBaseLogger } from 'fastify';
import { finalizeEvent, type EventTemplate } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';
import { hexToBytes } from 'nostr-tools/utils';

export type PublishTemplate = Pick<EventTemplate, 'kind' | 'tags' | 'content'> &
  Partial<Pick<EventTemplate, 'created_at'>>;

export type PublishInput = {
  template: PublishTemplate;
  relays: string[];
};

export class NostrClient {
  private readonly secretKeyBytes: Uint8Array;

  constructor(secretKey: string, private readonly log: FastifyBaseLogger) {
    this.secretKeyBytes = hexToBytes(secretKey);
  }

  async publishRelayList(relays: string[]) {
    const tags = relays.map((r) => ['r', r]);
    return this.publish({
      template: {
        kind: 10002,
        content: '',
        tags
      },
      relays
    });
  }

  async publish({ template, relays }: PublishInput) {
    const event = finalizeEvent(
      {
        kind: template.kind,
        content: template.content,
        tags: template.tags,
        created_at: template.created_at ?? Math.floor(Date.now() / 1000)
      },
      this.secretKeyBytes
    );

    const results = await Promise.allSettled(
      relays.map(async (url) => {
        const relay = await Relay.connect(url);
        try {
          await relay.publish(event);
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
