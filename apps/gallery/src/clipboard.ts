export async function copyToClipboard(text: string) {
  const value = String(text ?? '');
  if (!value) throw new Error('Nothing to copy');

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') throw new Error('Clipboard not available');

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';

  const selection = document.getSelection();
  const prevRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;

  document.body.removeChild(textarea);
  if (selection && prevRange) {
    selection.removeAllRanges();
    selection.addRange(prevRange);
  }

  if (!ok) throw new Error('Copy failed');
}

