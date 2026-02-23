import { navigateTo } from '../utils/navigation';

export function NotFoundScreen() {
  const handleGoHome = () => {
    navigateTo('/');
    window.location.reload(); // Force refresh to reset app state
  };

  return (
    <div
      className="not-found-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '2rem'
      }}
    >
      <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.5 }}>404</div>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          marginBottom: '0.5rem',
          color: 'var(--ns-color-text-default)'
        }}
      >
        Page Not Found
      </h1>
      <p
        style={{
          color: 'var(--ns-color-text-muted)',
          marginBottom: '1.5rem',
          maxWidth: '400px'
        }}
      >
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          className="action-btn"
          onClick={handleGoHome}
          type="button"
          style={{
            borderColor: 'var(--ns-color-accent-default)',
            color: 'var(--ns-color-accent-default)',
            padding: '0.5rem 1.5rem'
          }}
        >
          Go to Feed
        </button>
      </div>
      <div
        style={{
          marginTop: '2rem',
          fontSize: '0.85rem',
          color: 'var(--ns-color-text-muted)'
        }}
      >
        <p>Looking for something specific? Try:</p>
        <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
          <li>Use the search to find users</li>
          <li>Check your messages and notifications</li>
          <li>Browse the feed for new content</li>
        </ul>
      </div>
    </div>
  );
}
