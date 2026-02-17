import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReplyModal } from './reply-modal';

// Mock PostEditor
vi.mock('./post-editor', () => ({
  PostEditor: ({ onSuccess }: { onSuccess: () => void }) => (
    <div data-testid="post-editor">
      <button type="button" onClick={onSuccess}>
        Post
      </button>
    </div>
  )
}));

// Mock HTMLDialogElement methods if missing in JSDOM
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
}

const mockEvent = {
  id: 'event1',
  pubkey: 'pubkey1',
  kind: 1,
  content: 'hello',
  created_at: 1000,
  tags: [],
  sig: 'sig'
};

describe('ReplyModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders correctly when open', () => {
    render(<ReplyModal isOpen={true} onClose={vi.fn()} parentEvent={mockEvent} />);
    expect(screen.getByTestId('post-editor')).toBeTruthy();
  });

  it('keeps pointer interception scoped to modal body', () => {
    render(<ReplyModal isOpen={true} onClose={vi.fn()} parentEvent={mockEvent} />);
    const modal = screen.getByRole('dialog');
    const content = modal.querySelector('.reply-modal-content') as HTMLElement;

    expect(modal).toHaveStyle({ pointerEvents: 'none' });
    expect(content).toHaveStyle({ pointerEvents: 'auto' });
  });

  it('closes on close button click', () => {
    const onClose = vi.fn();
    render(<ReplyModal isOpen={true} onClose={onClose} parentEvent={mockEvent} />);
    const btn = screen.getByLabelText('Close reply modal');
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on success from PostEditor', () => {
    const onClose = vi.fn();
    render(<ReplyModal isOpen={true} onClose={onClose} parentEvent={mockEvent} />);
    const btn = screen.getByText('Post');
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(<ReplyModal isOpen={true} onClose={onClose} parentEvent={mockEvent} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on cancel event', () => {
    const onClose = vi.fn();
    render(<ReplyModal isOpen={true} onClose={onClose} parentEvent={mockEvent} />);
    const dialog = screen.getByRole('dialog');
    fireEvent(
      dialog,
      new Event('cancel', {
        bubbles: true
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on native close event', () => {
    const onClose = vi.fn();
    render(<ReplyModal isOpen={true} onClose={onClose} parentEvent={mockEvent} />);
    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes the dialog when unmounted while open', () => {
    const closeSpy = vi.spyOn(HTMLDialogElement.prototype, 'close');

    const { unmount } = render(
      <ReplyModal isOpen={true} onClose={vi.fn()} parentEvent={mockEvent} />
    );

    expect(closeSpy).not.toHaveBeenCalled();

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });
});
