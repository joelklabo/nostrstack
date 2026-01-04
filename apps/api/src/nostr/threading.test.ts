import { type Event } from 'nostr-tools';
import { describe, expect, it } from 'vitest';

import { extractThreadReferences } from './threading.js';

const baseEvent: Event = {
  id: 'a'.repeat(64),
  pubkey: 'b'.repeat(64),
  created_at: 1710000000,
  kind: 1,
  tags: [],
  content: 'hello',
  sig: 'c'.repeat(128)
};

describe('extractThreadReferences', () => {
  it('returns empty arrays for empty tag lists', () => {
    const refs = extractThreadReferences({ ...baseEvent, tags: [] });
    expect(refs).toEqual({ root: [], reply: [], mention: [] });
  });

  it('falls back to unmarked tags for root/reply/mention', () => {
    const rootId = '1'.repeat(64);
    const mentionId = '2'.repeat(64);
    const replyId = '3'.repeat(64);
    const refs = extractThreadReferences({
      ...baseEvent,
      tags: [
        ['e', rootId],
        ['e', mentionId],
        ['e', replyId]
      ]
    });

    expect(refs.root).toEqual([rootId]);
    expect(refs.reply).toEqual([replyId]);
    expect(refs.mention).toEqual([mentionId]);
  });

  it('treats a single unmarked tag as root only', () => {
    const rootId = 'd'.repeat(64);
    const refs = extractThreadReferences({
      ...baseEvent,
      tags: [['e', rootId]]
    });

    expect(refs.root).toEqual([rootId]);
    expect(refs.reply).toEqual([]);
    expect(refs.mention).toEqual([]);
  });

  it('treats two unmarked tags as root + reply', () => {
    const rootId = 'e'.repeat(64);
    const replyId = 'f'.repeat(64);
    const refs = extractThreadReferences({
      ...baseEvent,
      tags: [
        ['e', rootId],
        ['e', replyId]
      ]
    });

    expect(refs.root).toEqual([rootId]);
    expect(refs.reply).toEqual([replyId]);
    expect(refs.mention).toEqual([]);
  });

  it('respects markers and dedupes overlaps', () => {
    const rootId = '4'.repeat(64);
    const replyId = '5'.repeat(64);
    const mentionId = '6'.repeat(64);
    const refs = extractThreadReferences({
      ...baseEvent,
      tags: [
        ['e', rootId, '', 'root'],
        ['e', replyId, '', 'reply'],
        ['e', mentionId, '', 'mention'],
        ['e', mentionId],
        ['e', rootId]
      ]
    });

    expect(refs.root).toEqual([rootId]);
    expect(refs.reply).toEqual([replyId]);
    expect(refs.mention).toEqual([mentionId]);
  });

  it('treats unknown markers as unmarked', () => {
    const rootId = 'b'.repeat(64);
    const mentionId = 'c'.repeat(64);
    const refs = extractThreadReferences({
      ...baseEvent,
      tags: [
        ['e', rootId, '', 'root'],
        ['e', mentionId, '', 'custom-marker']
      ]
    });

    expect(refs.root).toEqual([rootId]);
    expect(refs.reply).toEqual([]);
    expect(refs.mention).toEqual([mentionId]);
  });

  it('handles multiple root markers', () => {
    const firstRoot = '7'.repeat(64);
    const secondRoot = '8'.repeat(64);
    const refs = extractThreadReferences({
      ...baseEvent,
      tags: [
        ['e', firstRoot, '', 'root'],
        ['e', secondRoot, '', 'root']
      ]
    });

    expect(refs.root).toEqual([firstRoot, secondRoot]);
    expect(refs.reply).toEqual([]);
    expect(refs.mention).toEqual([]);
  });

  it('ignores invalid or self-referential ids', () => {
    const selfId = '9'.repeat(64);
    const rootId = 'a'.repeat(64);
    const refs = extractThreadReferences(
      {
        ...baseEvent,
        id: selfId,
        tags: [
          ['e', rootId, '', 'root'],
          ['e', selfId, '', 'reply'],
          ['e', 'bad']
        ]
      },
      { selfId }
    );

    expect(refs.root).toEqual([rootId]);
    expect(refs.reply).toEqual([]);
    expect(refs.mention).toEqual([]);
  });

  it('ignores address tags for threading', () => {
    const address = `30023:${'d'.repeat(64)}:my-note`;
    const refs = extractThreadReferences({
      ...baseEvent,
      tags: [['a', address, '', 'root']]
    });

    expect(refs).toEqual({ root: [], reply: [], mention: [] });
  });

  it('uses only event tags when address tags are present', () => {
    const rootId = 'e'.repeat(64);
    const replyId = 'f'.repeat(64);
    const address = `30023:${'1'.repeat(64)}:post`;
    const refs = extractThreadReferences({
      ...baseEvent,
      tags: [
        ['e', rootId, '', 'root'],
        ['a', address, '', 'root'],
        ['e', replyId, '', 'reply']
      ]
    });

    expect(refs.root).toEqual([rootId]);
    expect(refs.reply).toEqual([replyId]);
    expect(refs.mention).toEqual([]);
  });

  it('ignores invalid address tag formats', () => {
    const rootId = '2'.repeat(64);
    const refs = extractThreadReferences({
      ...baseEvent,
      tags: [
        ['a', 'not-a-coordinate', '', 'root'],
        ['e', rootId, '', 'root']
      ]
    });

    expect(refs.root).toEqual([rootId]);
    expect(refs.reply).toEqual([]);
    expect(refs.mention).toEqual([]);
  });
});
