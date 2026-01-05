import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: CSSProperties;
}

export function Skeleton({ width, height, borderRadius, style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{
        width,
        height,
        borderRadius,
        ...style
      }}
      aria-hidden="true"
    />
  );
}

export function PostSkeleton() {
  return (
    <article className="post-card" aria-busy="true">
      <header className="post-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Skeleton width={40} height={40} borderRadius="50%" />
          <div style={{ flex: 1 }}>
            <Skeleton width={120} height={16} style={{ marginBottom: 4 }} />
            <Skeleton width={80} height={14} />
          </div>
        </div>
        <Skeleton width={60} height={14} />
      </header>
      <div className="post-content" style={{ paddingTop: '0.5rem' }}>
        <Skeleton width="100%" height={16} style={{ marginBottom: 8 }} />
        <Skeleton width="90%" height={16} style={{ marginBottom: 8 }} />
        <Skeleton width="75%" height={16} />
      </div>
      <footer className="post-footer">
        <Skeleton width={80} height={32} />
        <Skeleton width={80} height={32} />
      </footer>
    </article>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="profile-card" aria-busy="true">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <Skeleton width={80} height={80} borderRadius="50%" />
        <div style={{ flex: 1 }}>
          <Skeleton width={180} height={24} style={{ marginBottom: 8 }} />
          <Skeleton width={240} height={16} style={{ marginBottom: 8 }} />
          <Skeleton width={140} height={14} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <Skeleton width={100} height={36} />
        <Skeleton width={100} height={36} />
      </div>
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="notification-item" aria-busy="true">
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <Skeleton width={40} height={40} borderRadius="50%" />
        <div style={{ flex: 1 }}>
          <Skeleton width="100%" height={16} style={{ marginBottom: 6 }} />
          <Skeleton width="60%" height={14} />
        </div>
        <Skeleton width={50} height={14} />
      </div>
    </div>
  );
}
