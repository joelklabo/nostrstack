import { renderRelayBadge, updateRelayBadge } from '../relayBadge.js';
import { connectRelays, normalizeRelayUrls, type RelayConnection } from '../relays.js';
import { ensureNsRoot } from '../styles.js';
import type { CommentWidgetOptions, NostrEvent } from '../types.js';

export async function renderCommentWidget(container: HTMLElement, opts: CommentWidgetOptions = {}) {
  ensureNsRoot(container);
  container.classList.add('ns-card', 'ns-comments');
  container.replaceChildren();

  const maxItems = Math.max(1, Math.min(200, opts.maxItems ?? 50));
  const maxAgeDays =
    typeof opts.maxAgeDays === 'number' && opts.maxAgeDays > 0 ? opts.maxAgeDays : null;
  const since = maxAgeDays
    ? Math.floor(Date.now() / 1000) - Math.round(maxAgeDays * 86400)
    : undefined;
  const lazyConnect = opts.lazyConnect ?? false;
  const validateEvents = opts.validateEvents ?? false;

  const threadId = opts.threadId ?? location?.href ?? 'thread';

  const header = document.createElement('div');
  header.className = 'ns-comments-header';

  const headerText = document.createElement('div');
  headerText.className = 'ns-comments-title';
  headerText.textContent = opts.headerText ?? 'Comments';

  const relayBadge = renderRelayBadge([]);
  relayBadge.classList.add('ns-comments-relays');

  const notice = document.createElement('div');
  notice.className = 'ns-status ns-status--muted ns-comments__notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.hidden = true;

  const list = document.createElement('div');
  list.className = 'ns-comments-list';

  const actions = document.createElement('div');
  actions.className = 'ns-comments-actions';

  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.type = 'button';
  loadMoreBtn.className = 'ns-btn ns-btn--ghost ns-comments-more';
  loadMoreBtn.textContent = lazyConnect ? 'Load comments' : 'Load more';

  actions.append(loadMoreBtn);

  const status = document.createElement('div');
  status.className = 'ns-status ns-status--muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const form = document.createElement('form');
  form.className = 'ns-comments-form';
  const textarea = document.createElement('textarea');
  textarea.className = 'ns-textarea';
  textarea.name = 'comment';
  textarea.placeholder = opts.placeholder ?? 'Add a comment (Nostr)';
  textarea.required = true;
  textarea.rows = 3;
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'ns-btn ns-btn--primary';
  submit.textContent = 'Post';
  form.appendChild(textarea);
  form.appendChild(submit);

  const setStatus = (text: string, tone: 'muted' | 'success' | 'danger') => {
    status.textContent = text;
    status.classList.remove('ns-status--muted', 'ns-status--success', 'ns-status--danger');
    status.classList.add(`ns-status--${tone}`);
  };

  const setNotice = (text: string, tone: 'muted' | 'danger') => {
    notice.textContent = text;
    notice.hidden = !text;
    notice.classList.remove('ns-status--muted', 'ns-status--danger');
    notice.classList.add(`ns-status--${tone}`);
  };

  const setFormEnabled = (enabled: boolean) => {
    textarea.disabled = !enabled;
    submit.disabled = !enabled;
  };

  const verifySignature =
    typeof window !== 'undefined' ? window.NostrTools?.verifySignature : undefined;
  const validateEvent =
    typeof window !== 'undefined' ? window.NostrTools?.validateEvent : undefined;
  if (validateEvents && !verifySignature && !validateEvent) {
    setNotice('Signature validation unavailable in this environment.', 'muted');
  }

  let relays: RelayConnection[] = [];
  const subs: Array<{ un: () => void }> = [];
  const seen = new Set<string>();
  let oldestTimestamp: number | null = null;
  let hasMore = false;
  let loading = false;
  let connected = false;
  let destroyed = false;

  const updateActions = () => {
    if (lazyConnect && !connected) {
      loadMoreBtn.hidden = false;
      loadMoreBtn.textContent = loading ? 'Loading…' : 'Load comments';
      loadMoreBtn.disabled = loading;
      return;
    }
    if (!hasMore) {
      loadMoreBtn.hidden = true;
      return;
    }
    loadMoreBtn.hidden = false;
    loadMoreBtn.textContent = loading ? 'Loading…' : 'Load more';
    loadMoreBtn.disabled = loading;
  };

  const isValidEvent = (ev: NostrEvent) => {
    if (!ev || !ev.id) return false;
    if (validateEvents) {
      if (!ev.sig) return false;
      if (verifySignature && !verifySignature(ev)) return false;
      if (validateEvent && !validateEvent(ev)) return false;
    }
    return true;
  };

  const appendEvent = (ev: NostrEvent, relayUrl?: string) => {
    if (!isValidEvent(ev)) return;
    if (seen.has(ev.id!)) return;
    seen.add(ev.id!);
    if (typeof ev.created_at === 'number') {
      oldestTimestamp =
        oldestTimestamp === null ? ev.created_at : Math.min(oldestTimestamp, ev.created_at);
    }
    const row = document.createElement('div');
    row.className = 'ns-comment';
    row.textContent = ev.content;
    list.appendChild(row);
    opts.onEvent?.(ev, relayUrl ?? undefined);
  };

  const startLiveSubscriptions = () => {
    if (!relays.length) return;
    loading = true;
    updateActions();
    setStatus('Loading…', 'muted');
    const filters = [
      {
        kinds: [1],
        '#t': [threadId],
        limit: maxItems,
        ...(since ? { since } : {})
      }
    ];
    let pending = relays.length;
    let received = 0;
    relays.forEach((relay) => {
      const sub = relay.sub(filters);
      subs.push(sub);
      sub.on('event', (ev: NostrEvent) => {
        const before = seen.size;
        appendEvent(ev, relay.url ?? undefined);
        if (seen.size > before) received += 1;
      });
      let eoseHandled = false;
      const handleEose = () => {
        if (eoseHandled) return;
        eoseHandled = true;
        pending -= 1;
        if (pending <= 0) {
          hasMore = received >= maxItems;
          loading = false;
          updateActions();
          setStatus('', 'muted');
        }
      };
      sub.on('eose', handleEose);
      if (typeof window !== 'undefined') {
        window.setTimeout(handleEose, 1500);
      } else {
        handleEose();
      }
    });
  };

  const loadMore = async () => {
    if (!relays.length || loading) return;
    if (since && oldestTimestamp !== null && oldestTimestamp <= since) {
      hasMore = false;
      updateActions();
      return;
    }
    loading = true;
    updateActions();
    const until = oldestTimestamp ? oldestTimestamp - 1 : Math.floor(Date.now() / 1000);
    const filters = [
      {
        kinds: [1],
        '#t': [threadId],
        limit: maxItems,
        ...(since ? { since } : {}),
        until
      }
    ];
    let received = 0;
    await Promise.all(
      relays.map(
        (relay) =>
          new Promise<void>((resolve) => {
            const sub = relay.sub(filters);
            const handleEvent = (ev: NostrEvent) => {
              const before = seen.size;
              appendEvent(ev, relay.url ?? undefined);
              if (seen.size > before) received += 1;
            };
            sub.on('event', handleEvent);
            let eoseHandled = false;
            const handleEose = () => {
              if (eoseHandled) return;
              eoseHandled = true;
              sub.un();
              resolve();
            };
            sub.on('eose', handleEose);
            if (typeof window !== 'undefined') {
              window.setTimeout(handleEose, 1500);
            } else {
              handleEose();
            }
          })
      )
    );
    hasMore = received >= maxItems;
    loading = false;
    updateActions();
  };

  const connectAndLoad = async () => {
    if (connected || destroyed) return;
    const { valid, invalid } = normalizeRelayUrls(opts.relays);
    if (invalid.length) {
      setNotice(
        `Ignored ${invalid.length} invalid relay${invalid.length === 1 ? '' : 's'}.`,
        'muted'
      );
    }
    if (!valid.length) {
      setNotice('No relays configured.', 'danger');
      updateActions();
      return;
    }
    relays = await connectRelays(valid);
    if (!relays.length) {
      setNotice('No relays reachable.', 'danger');
      updateActions();
      return;
    }
    connected = true;
    updateRelayBadge(relayBadge, relays.map((r) => r.url ?? '').filter(Boolean));
    opts.onRelayInfo?.({
      relays: relays.map((r) => r.url ?? '').filter(Boolean),
      mode: 'real'
    });
    setFormEnabled(true);
    startLiveSubscriptions();
  };

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!window.nostr) {
      setStatus('Nostr signer (NIP-07) required to post', 'danger');
      return;
    }
    if (!relays.length) {
      setStatus('Connect to a relay to post', 'danger');
      return;
    }
    const content = textarea.value.trim();
    if (!content) return;
    submit.disabled = true;
    setStatus('', 'muted');
    try {
      const nostr = window.nostr;
      if (!nostr?.getPublicKey || !nostr.signEvent) {
        throw new Error('Nostr signer unavailable');
      }
      const pubkey = await nostr.getPublicKey();
      const unsigned: NostrEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', threadId]],
        content,
        pubkey,
        id: '',
        sig: ''
      };
      const signed = await nostr.signEvent(unsigned);
      await Promise.all(relays.map((relay) => relay.publish(signed)));
      appendEvent(signed);
      textarea.value = '';
    } catch (err) {
      console.error('nostr post failed', err);
      setStatus('Failed to post comment', 'danger');
    } finally {
      submit.disabled = false;
    }
  };

  const handleLoadMoreClick = () => {
    if (lazyConnect && !connected) {
      void connectAndLoad();
      return;
    }
    void loadMore();
  };

  loadMoreBtn.addEventListener('click', handleLoadMoreClick);

  form.addEventListener('submit', handleSubmit);

  if (lazyConnect) {
    setFormEnabled(false);
    setStatus('Click "Load comments" to connect', 'muted');
  } else {
    await connectAndLoad();
  }

  updateActions();

  header.append(headerText, relayBadge);
  container.appendChild(header);
  container.appendChild(notice);
  container.appendChild(list);
  container.appendChild(actions);
  container.appendChild(status);
  container.appendChild(form);

  return {
    el: container,
    destroy: () => {
      destroyed = true;
      form.removeEventListener('submit', handleSubmit);
      loadMoreBtn.removeEventListener('click', handleLoadMoreClick);
      subs.forEach((s) => s.un());
      relays.forEach((r) => r.close());
    }
  };
}
