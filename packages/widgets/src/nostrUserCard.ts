import { ensureNsEmbedStyles, nsEmbedStyles } from './styles.js';

export type NostrProfile = {
  pubkey: string;
  name?: string;
  display_name?: string;
  picture?: string;
  nip05?: string;
  about?: string;
};

export function renderNostrUserCard(profile: NostrProfile, target?: HTMLElement) {
  const el = target ?? document.createElement('div');
  ensureNsEmbedStyles(el.ownerDocument);
  if (!el.closest?.('.ns-theme')) el.classList.add('ns-theme');
  el.classList.add('ns', 'ns-user-card');

  const avatar = document.createElement('div');
  avatar.className = 'user-avatar';
  if (profile.picture) {
    avatar.style.backgroundImage = `url(${profile.picture})`;
  } else {
    avatar.textContent = (profile.display_name || profile.name || profile.pubkey || 'N')
      .slice(0, 1)
      .toUpperCase();
  }

  const body = document.createElement('div');
  body.className = 'user-body';

  const title = document.createElement('div');
  title.className = 'user-name';
  title.textContent = profile.display_name || profile.name || shortKey(profile.pubkey);

  const subtitle = document.createElement('div');
  subtitle.className = 'user-sub';
  subtitle.textContent = profile.nip05 || shortKey(profile.pubkey);

  const about = document.createElement('div');
  about.className = 'user-about';
  if (profile.about) about.textContent = profile.about;

  body.append(title, subtitle);
  if (profile.about) body.append(about);

  el.innerHTML = '';
  el.append(avatar, body);
  return el;
}

function shortKey(pk?: string) {
  return pk ? `${pk.slice(0, 6)}…${pk.slice(-4)}` : 'nostr user';
}

// For SSR / manual inclusion (includes tokens + base primitives + card styles).
export const nostrUserCardStyles = nsEmbedStyles;
