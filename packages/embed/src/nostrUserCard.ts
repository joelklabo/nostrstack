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
  el.className = 'nostrstack-user-card';

  const avatar = document.createElement('div');
  avatar.className = 'user-avatar';
  if (profile.picture) {
    avatar.style.backgroundImage = `url(${profile.picture})`;
  } else {
    avatar.textContent = (profile.display_name || profile.name || profile.pubkey || 'N').slice(0, 1).toUpperCase();
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

export const nostrUserCardStyles = `
.nostrstack-user-card { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; }
.nostrstack-user-card .user-avatar { width: 48px; height: 48px; border-radius: 999px; background: #e2e8f0; background-size: cover; background-position: center; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; color: #0f172a; }
.nostrstack-user-card .user-body { display: flex; flex-direction: column; gap: 0.1rem; }
.nostrstack-user-card .user-name { font-weight: 700; color: #0f172a; }
.nostrstack-user-card .user-sub { font-size: 12px; color: #475569; }
.nostrstack-user-card .user-about { font-size: 12px; color: #475569; }
`;
