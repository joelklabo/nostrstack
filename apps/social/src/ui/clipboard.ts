export async function copyToClipboard(text: string) {
  const value = String(text ?? '').trim();
  if (!value) throw new Error('Nothing to copy');

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

  const copyWithLegacyFallback = () => {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.fontSize = '16px';

    const selection = document.getSelection();
    const prevRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, value.length);

    const hasExecCommand = typeof document.execCommand === 'function';
    const ok = hasExecCommand ? document.execCommand('copy') : false;

    document.body.removeChild(textarea);
    if (selection && prevRange) {
      selection.removeAllRanges();
      selection.addRange(prevRange);
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
