export async function copyToClipboard(text: string): Promise<void> {
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

  const copyWithVisibleSelection = (): void => {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = 'auto';
    textarea.style.height = 'auto';
    textarea.style.padding = '1rem';
    textarea.style.border = '1px solid #ccc';
    textarea.style.borderRadius = '4px';
    textarea.style.background = '#fff';
    textarea.style.color = '#000';
    textarea.style.fontSize = '14px';
    textarea.style.fontFamily = 'monospace';
    textarea.style.zIndex = '999999';
    textarea.style.maxWidth = '90vw';
    textarea.style.maxHeight = '50vh';
    textarea.style.overflow = 'auto';
    textarea.style.whiteSpace = 'pre-wrap';
    textarea.style.wordBreak = 'break-all';

    const selection = document.getSelection();
    const prevRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const hasExecCommand = typeof document.execCommand === 'function';
    const execCommandResult = hasExecCommand ? document.execCommand('copy') : false;

    setTimeout(() => {
      document.body.removeChild(textarea);
      if (selection && prevRange) {
        selection.removeAllRanges();
        selection.addRange(prevRange);
      }
    }, 10000);

    if (execCommandResult) return;

    const label = document.createElement('div');
    label.textContent = 'Press Ctrl+C (or Cmd+C) to copy, then click anywhere to close';
    label.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #333;
      color: #fff;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 1000000;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    document.body.appendChild(label);

    const cleanup = () => {
      document.removeEventListener('click', cleanup);
      setTimeout(() => {
        if (label.parentNode) label.parentNode.removeChild(label);
      }, 100);
    };
    document.addEventListener('click', cleanup);
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

  const canUseClipboardApi = () => {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.clipboard !== 'undefined' &&
      typeof navigator.clipboard.writeText === 'function'
    );
  };

  if (canUseClipboardApi()) {
    try {
      const permissionStatus = await navigator.permissions
        .query({ name: 'clipboard-write' as PermissionName })
        .catch(() => null);
      if (permissionStatus && permissionStatus.state === 'denied') {
        copyWithLegacyFallback();
        return;
      }
    } catch {
      // Permissions API not supported or error, try clipboard API directly
    }

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

  try {
    copyWithLegacyFallback();
  } catch {
    copyWithVisibleSelection();
  }
}
