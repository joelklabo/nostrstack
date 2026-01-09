import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NotificationSkeleton, PostSkeleton, ProfileSkeleton, Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders with default text variant', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('.ns-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies circular variant class', () => {
    const { container } = render(<Skeleton variant="circular" />);
    const skeleton = container.querySelector('.ns-skeleton');
    expect(skeleton).toHaveClass('ns-skeleton--circle');
  });

  it('applies text variant class', () => {
    const { container } = render(<Skeleton variant="text" />);
    const skeleton = container.querySelector('.ns-skeleton');
    expect(skeleton).toHaveClass('ns-skeleton--text');
  });

  it('applies rectangular variant (no special class)', () => {
    const { container } = render(<Skeleton variant="rectangular" />);
    const skeleton = container.querySelector('.ns-skeleton');
    expect(skeleton).not.toHaveClass('ns-skeleton--circle');
    expect(skeleton).not.toHaveClass('ns-skeleton--text');
  });

  it('applies custom width and height as numbers', () => {
    const { container } = render(<Skeleton width={100} height={50} />);
    const skeleton = container.querySelector('.ns-skeleton');
    expect(skeleton).toHaveStyle({ width: '100px', height: '50px' });
  });

  it('applies custom width and height as strings', () => {
    const { container } = render(<Skeleton width="50%" height="2rem" />);
    const skeleton = container.querySelector('.ns-skeleton');
    expect(skeleton).toHaveStyle({ width: '50%', height: '2rem' });
  });

  it('allows custom border radius', () => {
    const { container } = render(<Skeleton borderRadius={10} />);
    const skeleton = container.querySelector('.ns-skeleton');
    expect(skeleton).toHaveStyle({ borderRadius: '10px' });
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="custom-skeleton" />);
    const skeleton = container.querySelector('.ns-skeleton');
    expect(skeleton).toHaveClass('ns-skeleton');
    expect(skeleton).toHaveClass('custom-skeleton');
  });

  it('applies custom style', () => {
    const { container } = render(<Skeleton style={{ opacity: 0.5 }} />);
    const skeleton = container.querySelector('.ns-skeleton');
    expect(skeleton).toHaveStyle({ opacity: '0.5' });
  });
});

describe('PostSkeleton', () => {
  it('renders with aria-busy attribute', () => {
    render(<PostSkeleton />);
    const article = screen.getByRole('article');
    expect(article).toHaveAttribute('aria-busy', 'true');
  });

  it('renders with correct class name', () => {
    render(<PostSkeleton />);
    const article = screen.getByRole('article');
    expect(article).toHaveClass('ns-card');
  });

  it('contains multiple skeleton elements', () => {
    const { container } = render(<PostSkeleton />);
    const skeletons = container.querySelectorAll('.ns-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('ProfileSkeleton', () => {
  it('renders with aria-busy attribute', () => {
    const { container } = render(<ProfileSkeleton />);
    const card = container.querySelector('.ns-card');
    expect(card).toHaveAttribute('aria-busy', 'true');
  });

  it('renders with correct class name', () => {
    const { container } = render(<ProfileSkeleton />);
    expect(container.querySelector('.ns-card')).toBeInTheDocument();
  });

  it('contains multiple skeleton elements', () => {
    const { container } = render(<ProfileSkeleton />);
    const skeletons = container.querySelectorAll('.ns-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('NotificationSkeleton', () => {
  it('renders with aria-busy attribute', () => {
    const { container } = render(<NotificationSkeleton />);
    const card = container.querySelector('.ns-card');
    expect(card).toHaveAttribute('aria-busy', 'true');
  });

  it('renders with correct class name', () => {
    const { container } = render(<NotificationSkeleton />);
    expect(container.querySelector('.ns-card')).toBeInTheDocument();
  });

  it('contains multiple skeleton elements', () => {
    const { container } = render(<NotificationSkeleton />);
    const skeletons = container.querySelectorAll('.ns-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
