import { Skeleton } from './Skeleton';

export function PostSkeleton() {
  return (
    <div className="post-card" style={{ pointerEvents: 'none' }}>
      <div className="post-header" style={{ marginBottom: '1rem', borderBottom: 'none', paddingBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
          <Skeleton variant="circular" width={32} height={32} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <Skeleton variant="text" width={120} height={14} />
            <Skeleton variant="text" width={60} height={12} />
          </div>
        </div>
      </div>
      <div className="post-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Skeleton variant="text" width="100%" height={16} />
        <Skeleton variant="text" width="90%" height={16} />
        <Skeleton variant="text" width="70%" height={16} />
      </div>
      <div className="post-actions" style={{ gap: '0.5rem', marginTop: '1rem', display: 'flex' }}>
        <Skeleton variant="rectangular" width={60} height={32} style={{ borderRadius: '6px' }} />
        <Skeleton variant="rectangular" width={60} height={32} style={{ borderRadius: '6px' }} />
      </div>
    </div>
  );
}
