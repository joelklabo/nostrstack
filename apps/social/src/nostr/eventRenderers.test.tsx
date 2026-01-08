import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderEvent } from './eventRenderers';

describe('eventRenderers', () => {
  afterEach(() => {
    cleanup();
  });

  describe('renderEvent (media)', () => {
    it('renders images inline', () => {
      const event = {
        kind: 1,
        content: 'Check this out: https://example.com/image.jpg',
        tags: [],
        created_at: 0,
        pubkey: 'pk',
        id: 'id',
        sig: 'sig'
      };

      const result = renderEvent(event);
      render(result.body);

      const img = screen.getByRole('img');
      expect(img).toBeDefined();
      expect(img.getAttribute('src')).toBe('https://example.com/image.jpg');
      expect(img.getAttribute('loading')).toBe('lazy');
    });

    it('renders videos inline', () => {
      const event = {
        kind: 1,
        content: 'Check this video: https://example.com/video.mp4',
        tags: [],
        created_at: 0,
        pubkey: 'pk',
        id: 'id',
        sig: 'sig'
      };

      const result = renderEvent(event);
      render(result.body);

      const video = document.querySelector('video');
      expect(video).toBeDefined();
      expect(video?.getAttribute('src')).toBe('https://example.com/video.mp4');
      expect(video?.hasAttribute('controls')).toBe(true);
    });

    it('handles mixed content', () => {
      const event = {
        kind: 1,
        content: 'Text before https://example.com/image.png text after',
        tags: [],
        created_at: 0,
        pubkey: 'pk',
        id: 'id',
        sig: 'sig'
      };

      const result = renderEvent(event);
      render(result.body);

      expect(screen.getByText(/Text before/)).toBeDefined();
      expect(screen.getByRole('img')).toBeDefined();
      expect(screen.getByText(/text after/)).toBeDefined();
    });

    it('ignores non-media links', () => {
        const event = {
          kind: 1,
          content: 'Link: https://example.com',
          tags: [],
          created_at: 0,
          pubkey: 'pk',
          id: 'id',
          sig: 'sig'
        };
  
        const result = renderEvent(event);
        render(result.body);
  
        const link = screen.getByRole('link');
        expect(link.getAttribute('href')).toBe('https://example.com');
        expect(document.querySelector('img')).toBeNull();
    });
  });
});