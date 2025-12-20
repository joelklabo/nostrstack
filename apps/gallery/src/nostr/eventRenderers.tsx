import type { Event } from 'nostr-tools';
import type { ReactNode } from 'react';
import { nip19 } from 'nostr-tools';

export type ProfileMeta = {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  website?: string;
  nip05?: string;
  lud16?: string;
};

export type RenderedEvent = {
  label: string;
  body: ReactNode;
  footer?: ReactNode;
};

const LINK_RE = /(nostr:[0-9a-z]+|https?:\/\/\S+)/gi;

export function parseProfileContent(content?: string): ProfileMeta | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as ProfileMeta;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function ProfileCard({ profile }: { profile: ProfileMeta }) {
  return (
    <div className="nostr-profile-card">
      {profile.picture && <img className="nostr-profile-avatar" src={profile.picture} alt="" />}
      <div className="nostr-profile-meta">
        <div className="nostr-profile-name">
          {profile.display_name || profile.name || 'Unnamed profile'}
        </div>
        {profile.nip05 && <div className="nostr-profile-nip05">{profile.nip05}</div>}
        {profile.about && <div className="nostr-profile-about">{profile.about}</div>}
        {profile.website && (
          <div className="nostr-profile-link">
            <a href={profile.website} target="_blank" rel="noreferrer">
              {profile.website}
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
  return event.tags.filter((t) => t[0] === tag).map((t) => t[1]).filter(Boolean);
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

function renderContentWithLinks(content: string) {
  if (!content) return <span>No content for this event.</span>;
  const parts = content.split(LINK_RE);
  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;
        if (part.toLowerCase().startsWith('nostr:')) {
          const id = part.slice(6);
          return (
            <a key={`nostr-${idx}`} href={`/nostr/${encodeURIComponent(id)}`} className="nostr-event-link">
              {part}
            </a>
          );
        }
        if (part.startsWith('http://') || part.startsWith('https://')) {
          return (
            <a key={`http-${idx}`} href={part} target="_blank" rel="noreferrer" className="nostr-event-link">
              {part}
            </a>
          );
        }
        return <span key={`text-${idx}`}>{part}</span>;
      })}
    </>
  );
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
                <a key={id} href={`/nostr/${encodeURIComponent(note)}`} className="nostr-event-chip">
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
                <a key={pk} href={`/nostr/${encodeURIComponent(npub)}`} className="nostr-event-chip">
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
      body: profile ? <ProfileCard profile={profile} /> : <span>Profile metadata unavailable.</span>,
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
    const url = getTagValue(event, 'url');
    const mime = getTagValue(event, 'm');
    const size = getTagValue(event, 'size');
    return {
      label,
      body: (
        <div className="nostr-event-text">
          {url && (
            <div>
              File: <a href={url} target="_blank" rel="noreferrer">{url}</a>
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
