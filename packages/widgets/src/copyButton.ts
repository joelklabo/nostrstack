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

function bubbleTextFromLabel(label: string) {
  const trimmed = (label ?? '').trim();
  if (!trimmed) return 'Copied';
  const lower = trimmed.toLowerCase();
  if (lower === 'copy') return 'Copied';
  if (lower.startsWith('copy ')) return `Copied ${trimmed.slice(5)}`;
  return `${trimmed} copied`;
}

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

  const isClipboardPermissionError = (error: unknown): boolean => {
    if (!(error instanceof DOMException)) return false;
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    return (
      name === 'notallowederror' ||
      name === 'securityerror' ||
      message.includes('clipboard') ||
      message.includes('permission')
    );
  };

  // cspell:ignore notallowederror securityerror

  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(trimmed);
      return;
    } catch (error) {
      if (!isClipboardPermissionError(error)) {
        throw error;
      }
    }
  }

  // Fallback for older browsers / restricted clipboard APIs.
  const el = document.createElement('textarea');
  el.value = trimmed;
  el.setAttribute('readonly', 'true');
  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = '2em';
  el.style.height = '2em';
  el.style.padding = '0';
  el.style.border = 'none';
  el.style.outline = 'none';
  el.style.boxShadow = 'none';
  el.style.background = 'transparent';
  el.style.fontSize = '16px';
  document.body.appendChild(el);
  try {
    el.focus();
    el.setSelectionRange(0, trimmed.length);
    const hasExecCommand = typeof document.execCommand === 'function';
    if (!hasExecCommand || !document.execCommand('copy')) {
      throw new Error('Copy failed');
    }
  } finally {
    el.remove();
  }
}

export function createCopyButton(opts: CopyButtonOptions) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = [
    'ns-btn',
    opts.size === 'sm' ? 'ns-btn--sm' : '',
    'ns-copybtn',
    opts.variant === 'icon' ? 'ns-copybtn--icon' : ''
  ]
    .filter(Boolean)
    .join(' ');
  btn.dataset.copyState = 'idle';
  btn.dataset.variant = opts.variant ?? 'default';
  btn.disabled = Boolean(opts.disabled);
  if (opts.ariaLabel) btn.setAttribute('aria-label', opts.ariaLabel);

  const bubble = document.createElement('span');
  bubble.className = 'ns-copybtn__bubble';
  bubble.setAttribute('aria-hidden', 'true');
  bubble.textContent = bubbleTextFromLabel(opts.label);

  const icon = document.createElement('span');
  icon.className = 'ns-copybtn__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = COPY_ICON;

  const label = document.createElement('span');
  label.className = 'ns-copybtn__label';
  label.textContent = opts.label;

  btn.appendChild(bubble);
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
      label.textContent =
        next === 'idle' ? baseLabel : next === 'copied' ? 'Copied' : 'Copy failed';
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
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function')
          navigator.vibrate(10);
      } catch {
        /* ignore */
      }
      setState('copied');
    } catch {
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function')
          navigator.vibrate([15, 25, 15]);
      } catch {
        /* ignore */
      }
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
    bubble.textContent = bubbleTextFromLabel(next);
  };

  return { el: btn, reset, setLabel };
}
