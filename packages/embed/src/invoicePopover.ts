export function renderInvoicePopover(pr: string) {
  const overlay = document.createElement('div');
  overlay.className = 'nostrstack-popover-overlay';
  const pop = document.createElement('div');
  pop.className = 'nostrstack-popover';

  const title = document.createElement('div');
  title.className = 'popover-title';
  title.textContent = 'Lightning Invoice';

  const qr = document.createElement('img');
  qr.alt = 'Invoice QR';
  qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pr)}`;

  const code = document.createElement('pre');
  code.className = 'popover-code';
  code.textContent = pr;

  const actions = document.createElement('div');
  actions.className = 'popover-actions';
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(pr);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    } catch (e) {
      alert('Copy failed');
    }
  };
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.onclick = () => overlay.remove();
  actions.append(copyBtn, closeBtn);

  pop.append(title, qr, code, actions);
  overlay.appendChild(pop);
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  document.body.appendChild(overlay);
  return overlay;
}

export const invoicePopoverStyles = `
.nostrstack-popover-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.45); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.nostrstack-popover { background: #fff; color: #0f172a; border-radius: 16px; padding: 1.2rem; max-width: 420px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.2); text-align: center; }
.nostrstack-popover .popover-title { font-weight: 700; margin-bottom: 0.75rem; }
.nostrstack-popover img { border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px; background: #f8fafc; }
.nostrstack-popover .popover-code { white-space: pre-wrap; word-break: break-all; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.75rem; border-radius: 12px; font-size: 12px; margin: 0.75rem 0; text-align: left; }
.nostrstack-popover .popover-actions { display: flex; gap: 0.5rem; justify-content: center; }
.nostrstack-popover button { border: 1px solid #e2e8f0; background: #0f172a; color: #fff; border-radius: 10px; padding: 0.45rem 0.9rem; cursor: pointer; }
.nostrstack-popover button:hover { opacity: 0.9; }
`;
