export type CopyButtonState = 'idle' | 'copied' | 'error';

type CopyButtonOptions = {
  label: string;
  getText: () => string | null | undefined;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  variant?: 'default' | 'icon';
  successDurationMs?: number;
  disabled?: boolean;
};

const COPY_ICON = `
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">
  <rect x="9" y="9" width="11" height="11" rx="2" ry="2" />
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
</svg>
`;

const CHECK_ICON = `
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">
  <path d="M20 6 9 17l-5-5" />
</svg>
`;

const ERROR_ICON = `
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">
  <path d="M18 6 6 18" />
  <path d="M6 6 18 18" />
</svg>
`;

export async function copyToClipboard(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(trimmed);
    return;
  }

  // Fallback for older browsers / restricted clipboard APIs.
  const el = document.createElement('textarea');
  el.value = trimmed;
  el.setAttribute('readonly', 'true');
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.top = '0';
  document.body.appendChild(el);
  try {
    el.select();
    document.execCommand('copy');
  } finally {
    el.remove();
  }
}

export function createCopyButton(opts: CopyButtonOptions) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = [
    'nostrstack-btn',
    opts.size === 'sm' ? 'nostrstack-btn--sm' : '',
    'nostrstack-copybtn',
    opts.variant === 'icon' ? 'nostrstack-copybtn--icon' : ''
  ]
    .filter(Boolean)
    .join(' ');
  btn.dataset.copyState = 'idle';
  btn.dataset.variant = opts.variant ?? 'default';
  btn.disabled = Boolean(opts.disabled);
  if (opts.ariaLabel) btn.setAttribute('aria-label', opts.ariaLabel);

  const icon = document.createElement('span');
  icon.className = 'nostrstack-copybtn__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = COPY_ICON;

  const label = document.createElement('span');
  label.className = 'nostrstack-copybtn__label';
  label.textContent = opts.label;

  btn.appendChild(icon);
  if ((opts.variant ?? 'default') !== 'icon') btn.appendChild(label);

  let state: CopyButtonState = 'idle';
  let timeoutId: number | null = null;
  let baseLabel = opts.label;

  const setState = (next: CopyButtonState) => {
    state = next;
    btn.dataset.copyState = next;
    icon.innerHTML = next === 'copied' ? CHECK_ICON : next === 'error' ? ERROR_ICON : COPY_ICON;
    if ((opts.variant ?? 'default') !== 'icon') {
      label.textContent = next === 'idle' ? baseLabel : next === 'copied' ? 'Copied' : 'Copy failed';
    }
  };

  const reset = () => {
    if (timeoutId && typeof window !== 'undefined') window.clearTimeout(timeoutId);
    timeoutId = null;
    setState('idle');
  };

  btn.addEventListener('click', async () => {
    try {
      if (timeoutId && typeof window !== 'undefined') window.clearTimeout(timeoutId);
      const value = (opts.getText?.() ?? '').trim();
      if (!value) return;
      await copyToClipboard(value);
      setState('copied');
    } catch (err) {
      console.warn('copy failed', err);
      setState('error');
    } finally {
      if (typeof window !== 'undefined') {
        const ms = opts.successDurationMs ?? 1200;
        timeoutId = window.setTimeout(() => setState('idle'), ms);
      } else {
        setState('idle');
      }
    }
  });

  const setLabel = (next: string) => {
    baseLabel = next;
    if (state === 'idle') label.textContent = baseLabel;
  };

  return { el: btn, reset, setLabel };
}

