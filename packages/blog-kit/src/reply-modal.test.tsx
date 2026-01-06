import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReplyModal } from './reply-modal';

// Mock PostEditor
vi.mock('./post-editor', () => ({
  PostEditor: ({ onSuccess }: any) => (
    <div data-testid="post-editor">
      <button onClick={onSuccess}>Post</button>
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
  tags: []
};

describe('ReplyModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders correctly when open', () => {
    render(<ReplyModal isOpen={true} onClose={vi.fn()} parentEvent={mockEvent} />);
    expect(screen.getByTestId('post-editor')).toBeTruthy();
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
});
