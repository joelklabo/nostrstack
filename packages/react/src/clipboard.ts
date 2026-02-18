export async function copyToClipboard(text: string) {
  const value = String(text ?? '').trim();
  if (!value) throw new Error('Nothing to copy');

  const isClipboardPermissionError = (error: unknown): boolean => {
    return (
      error instanceof DOMException &&
      (error.name === 'NotAllowedError' || error.name === 'SecurityError')
    );
  };

  const copyWithLegacyFallback = () => {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';

    const selection = document.getSelection();
    const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;

    document.body.removeChild(textarea);
    if (selection && previousRange) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }

    if (!ok) throw new Error('Copy failed');
  };

  if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (error) {
      if (!isClipboardPermissionError(error)) {
        throw error;
      }
    }
  }

  if (typeof document === 'undefined') throw new Error('Clipboard not available');
  copyWithLegacyFallback();
}
