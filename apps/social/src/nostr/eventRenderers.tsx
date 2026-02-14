import { type Event, nip19 } from 'nostr-tools';
import type { ReactNode } from 'react';

export type ProfileMeta = {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  website?: string;
  nip05?: string;
  lud16?: string;
};

export type EventReferences = {
  root: string[];
  reply: string[];
  mention: string[];
  quote: string[];
  address: string[];
  profiles: string[];
};

export type RenderedEvent = {
  label: string;
  body: ReactNode;
  footer?: ReactNode;
};

const LINK_RE = /(nostr:[0-9a-z]+|https?:\/\/\S+)/gi;
const NOSTR_URI_RE = /nostr:([0-9a-z]+)/gi;

export function parseProfileContent(content?: string): ProfileMeta | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as ProfileMeta;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function uniq<T>(items: T[]) {
  return Array.from(new Set(items));
}

function parseInlineMentions(content?: string) {
  const events: string[] = [];
  const profiles: string[] = [];
  const addresses: string[] = [];
  if (!content) return { events, profiles, addresses };

  for (const match of content.matchAll(NOSTR_URI_RE)) {
    const token = match[1];
    if (!token) continue;
    try {
      const decoded = nip19.decode(token.toLowerCase());
      if (decoded.type === 'note') {
        events.push(decoded.data as string);
      } else if (decoded.type === 'nevent') {
        const data = decoded.data as { id: string };
        if (data?.id) events.push(data.id);
      } else if (decoded.type === 'npub') {
        profiles.push(decoded.data as string);
      } else if (decoded.type === 'nprofile') {
        const data = decoded.data as { pubkey: string };
        if (data?.pubkey) profiles.push(data.pubkey);
      } else if (decoded.type === 'naddr') {
        const data = decoded.data as { kind: number; pubkey: string; identifier: string };
        if (data?.pubkey && data?.identifier != null && data?.kind != null) {
          addresses.push(`${data.kind}:${data.pubkey}:${data.identifier}`);
        }
      }
    } catch {
      // ignore invalid mentions
    }
  }

  return {
    events: uniq(events),
    profiles: uniq(profiles),
    addresses: uniq(addresses)
  };
}

export function ProfileCard({ profile }: { profile: ProfileMeta }) {
  const website = safeExternalUrl(profile.website);
  return (
    <div className="nostr-profile-card">
      {profile.picture && <img className="nostr-profile-avatar" src={profile.picture} alt="" />}
      <div className="nostr-profile-meta">
        <div className="nostr-profile-name">
          {profile.display_name || profile.name || 'Unnamed profile'}
        </div>
        {profile.nip05 && <div className="nostr-profile-nip05">{profile.nip05}</div>}
        {profile.about && <div className="nostr-profile-about">{profile.about}</div>}
        {website && (
          <div className="nostr-profile-link">
            <a href={website} target="_blank" rel="noreferrer noopener">
              {website}
            </a>
          </div>
        )}
        {profile.lud16 && <div className="nostr-profile-nip05">Lightning: {profile.lud16}</div>}
      </div>
    </div>
  );
}

export function getEventKindLabel(kind: number) {
  switch (kind) {
    case 0:
      return 'Profile';
    case 1:
      return 'Note';
    case 6:
      return 'Repost';
    case 7:
      return 'Reaction';
    case 9734:
      return 'Zap Request';
    case 9735:
      return 'Zap Receipt';
    case 30023:
      return 'Longform';
    case 1063:
      return 'File Metadata';
    default:
      return `Kind ${kind}`;
  }
}

function getTagValue(event: Event, tag: string) {
  return event.tags.find((t) => t[0] === tag)?.[1];
}

function getTagValues(event: Event, tag: string) {
  return event.tags
    .filter((t) => t[0] === tag)
    .map((t) => t[1])
    .filter(Boolean);
}

function toNote(id: string) {
  try {
    return nip19.noteEncode(id);
  } catch {
    return id;
  }
}

function toNpub(pubkey: string) {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey;
  }
}

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|mov|webm)$/i;

function renderContentWithLinks(content: string) {
  if (!content) return <span>No content for this event.</span>;
  const lines = content.split('\n');
  return (
    <>
      {lines.map((line, lineIdx) => {
        const parts = line.split(LINK_RE);
        return (
          <span key={`line-${lineIdx}`}>
            {parts.map((part, idx) => {
              if (!part) return null;
              if (part.toLowerCase().startsWith('nostr:')) {
                const id = part.slice(6);
                try {
                  const decoded = nip19.decode(id.toLowerCase());
                  if (!['note', 'nevent', 'npub', 'nprofile', 'naddr'].includes(decoded.type)) {
                    return <span key={`text-${lineIdx}-${idx}`}>{part}</span>;
                  }
                } catch {
                  return <span key={`text-${lineIdx}-${idx}`}>{part}</span>;
                }
                return (
                  <a
                    key={`nostr-${lineIdx}-${idx}`}
                    href={`/nostr/${encodeURIComponent(id)}`}
                    className="nostr-event-link"
                  >
                    {part}
                  </a>
                );
              }
              if (part.startsWith('http://') || part.startsWith('https://')) {
                try {
                  const url = new URL(part);
                  if (IMAGE_EXTENSIONS.test(url.pathname)) {
                    return (
                      <div key={`media-${lineIdx}-${idx}`} className="nostr-media-container">
                        <img
                          src={part}
                          alt="Embedded content"
                          loading="lazy"
                          className="nostr-media-img"
                        />
                      </div>
                    );
                  }
                  if (VIDEO_EXTENSIONS.test(url.pathname)) {
                    return (
                      <div key={`media-${lineIdx}-${idx}`} className="nostr-media-container">
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- User-generated content may not have captions */}
                        <video src={part} controls className="nostr-media-video" />
                      </div>
                    );
                  }
                } catch {
                  // ignore invalid URL
                }
                return (
                  <a
                    key={`http-${lineIdx}-${idx}`}
                    href={part}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="nostr-event-link"
                  >
                    {part}
                  </a>
                );
              }
              return <span key={`text-${lineIdx}-${idx}`}>{part}</span>;
            })}
            {lineIdx < lines.length - 1 && <br key={`br-${lineIdx}`} />}
          </span>
        );
      })}
    </>
  );
}

export function safeExternalUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeEventId(id: string) {
  return id.trim().toLowerCase();
}

function normalizeCoordinate(coord: string) {
  return coord.trim().toLowerCase();
}

function limitList(list: string[], limit?: number) {
  if (!limit || list.length <= limit) return list;
  return list.slice(0, limit);
}

export function extractEventReferences(event: Event, limit?: number): EventReferences {
  const root: string[] = [];
  const reply: string[] = [];
  const mention: string[] = [];
  const quote: string[] = [];
  const address: string[] = [];
  const profiles: string[] = [];

  const unmarked: string[] = [];
  for (const tag of event.tags) {
    if (tag[0] !== 'e') continue;
    const id = tag[1];
    if (!id) continue;
    const marker = tag[3];
    if (marker === 'root') root.push(id);
    else if (marker === 'reply') reply.push(id);
    else if (marker === 'mention') mention.push(id);
    else unmarked.push(id);
  }

  if (root.length === 0 && unmarked.length > 0) root.push(unmarked[0]);
  if (reply.length === 0 && unmarked.length > 1) reply.push(unmarked[unmarked.length - 1]);

  const used = new Set([...root, ...reply]);
  for (const id of unmarked) {
    if (!used.has(id)) mention.push(id);
  }

  quote.push(...getTagValues(event, 'q'));
  address.push(...getTagValues(event, 'a'));
  profiles.push(...getTagValues(event, 'p'));

  const inline = parseInlineMentions(event.content);
  mention.push(...inline.events);
  address.push(...inline.addresses);
  profiles.push(...inline.profiles);

  return {
    root: limitList(uniq(root.map(normalizeEventId)), limit),
    reply: limitList(uniq(reply.map(normalizeEventId)), limit),
    mention: limitList(uniq(mention.map(normalizeEventId)), limit),
    quote: limitList(uniq(quote.map(normalizeEventId)), limit),
    address: limitList(uniq(address.map(normalizeCoordinate)), limit),
    profiles: limitList(uniq(profiles.map(normalizeEventId)), limit)
  };
}

function renderReferences(event: Event) {
  const eventRefs = getTagValues(event, 'e').slice(0, 6);
  const pubRefs = getTagValues(event, 'p').slice(0, 6);
  if (!eventRefs.length && !pubRefs.length) return null;

  return (
    <div className="nostr-event-refs">
      {eventRefs.length > 0 && (
        <div className="nostr-event-ref">
          <span className="nostr-event-label">References</span>
          <div className="nostr-event-chiplist">
            {eventRefs.map((id) => {
              const note = toNote(id);
              return (
                <a
                  key={id}
                  href={`/nostr/${encodeURIComponent(note)}`}
                  className="nostr-event-chip"
                >
                  {note}
                </a>
              );
            })}
          </div>
        </div>
      )}
      {pubRefs.length > 0 && (
        <div className="nostr-event-ref">
          <span className="nostr-event-label">Mentions</span>
          <div className="nostr-event-chiplist">
            {pubRefs.map((pk) => {
              const npub = toNpub(pk);
              return (
                <a
                  key={pk}
                  href={`/nostr/${encodeURIComponent(npub)}`}
                  className="nostr-event-chip"
                >
                  {npub}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function renderEvent(event: Event): RenderedEvent {
  const label = getEventKindLabel(event.kind);

  if (event.kind === 0) {
    const profile = parseProfileContent(event.content);
    return {
      label,
      body: profile ? (
        <ProfileCard profile={profile} />
      ) : (
        <span>Profile metadata unavailable.</span>
      ),
      footer: renderReferences(event) ?? undefined
    };
  }

  if (event.kind === 6) {
    let repostPreview = 'Repost event';
    try {
      const parsed = JSON.parse(event.content || '{}') as Event;
      if (parsed?.id) {
        repostPreview = `Repost of ${toNote(parsed.id)} (kind ${parsed.kind})`;
      }
    } catch {
      // ignore
    }
    return {
      label,
      body: <div className="nostr-event-text">{repostPreview}</div>,
      footer: renderReferences(event) ?? undefined
    };
  }

  if (event.kind === 7) {
    const reaction = event.content?.trim() || '+';
    return {
      label,
      body: <div className="nostr-event-text">Reaction: {reaction}</div>,
      footer: renderReferences(event) ?? undefined
    };
  }

  if (event.kind === 9734 || event.kind === 9735) {
    const amountMsat = Number(getTagValue(event, 'amount') || 0);
    const amountSats = amountMsat ? Math.round(amountMsat / 1000) : null;
    const bolt11 = getTagValue(event, 'bolt11');
    const target = getTagValue(event, 'e');
    return {
      label,
      body: (
        <div className="nostr-event-text">
          <div>{event.kind === 9734 ? 'Zap request' : 'Zap receipt'}</div>
          {amountSats != null && <div>Amount: {amountSats} sats</div>}
          {target && <div>Target: {toNote(target)}</div>}
          {bolt11 && <div>Invoice: {bolt11.slice(0, 32)}…</div>}
        </div>
      ),
      footer: renderReferences(event) ?? undefined
    };
  }

  if (event.kind === 30023) {
    const title = getTagValue(event, 'title') || getTagValue(event, 'subject');
    const summary = getTagValue(event, 'summary');
    return {
      label,
      body: (
        <div className="nostr-event-text">
          {title && <div className="nostr-event-longform-title">{title}</div>}
          {summary && <div className="nostr-event-longform-summary">{summary}</div>}
          {renderContentWithLinks(event.content)}
        </div>
      ),
      footer: renderReferences(event) ?? undefined
    };
  }

  if (event.kind === 1063) {
    const url = safeExternalUrl(getTagValue(event, 'url'));
    const mime = getTagValue(event, 'm');
    const size = getTagValue(event, 'size');
    return {
      label,
      body: (
        <div className="nostr-event-text">
          {url && (
            <div>
              File:{' '}
              <a href={url} target="_blank" rel="noreferrer noopener">
                {url}
              </a>
            </div>
          )}
          {mime && <div>Type: {mime}</div>}
          {size && <div>Size: {size} bytes</div>}
        </div>
      ),
      footer: renderReferences(event) ?? undefined
    };
  }

  return {
    label,
    body: <div className="nostr-event-text">{renderContentWithLinks(event.content || '')}</div>,
    footer: renderReferences(event) ?? undefined
  };
}
